import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { parseLeader, siteUrl, validPassword } from '../lib/invitations.ts';

function form(overrides = {}) {
  const result = new FormData();
  for (const [key, value] of Object.entries({ name: ' Líder ', email: ' TEST@example.com ', cell_name: ' Célula ', ...overrides })) result.set(key, value);
  return result;
}

function loadModule(file, mocks) {
  const source = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(source, { exports, URL, process: { env: { NODE_ENV: 'development' } }, require(name) {
    assert.ok(name in mocks, `Unexpected dependency: ${name}`);
    return mocks[name];
  } });
  return exports;
}

test('leader validation rejects malformed/oversized fields and ignores role and IDs', () => {
  assert.deepEqual(parseLeader(form({ role: 'pastor', leader_id: 'forged', weekday: '0', meeting_time: '19:30' })), {
    name: 'Líder', email: 'test@example.com', cell_name: 'Célula', location: null, weekday: 0, meeting_time: '19:30',
  });
  for (const override of [{ name: ' ' }, { name: 'x'.repeat(121) }, { cell_name: '' }, { cell_name: 'x'.repeat(121) },
    { email: 'a@b' }, { email: 'a b@c.com' }, { email: 'x'.repeat(250) + '@b.com' }, { weekday: '7' }, { weekday: '-1' },
    { weekday: '1.5' }, { meeting_time: '24:00' }, { meeting_time: '19:60' }, { location: 'x'.repeat(241) }]) {
    assert.equal(parseLeader(form(override)), null);
  }
});

test('redirect origin requires explicit production HTTPS and rejects hostile URLs', () => {
  assert.equal(siteUrl(undefined, true), 'http://localhost:3000');
  assert.equal(siteUrl('https://church.example/', false), 'https://church.example');
  for (const url of [undefined, 'http://localhost:3000', 'https://user:pass@church.example', 'https://church.example/evil',
    'https://church.example?next=evil', 'https://church.example/#token', 'javascript:alert(1)']) assert.throws(() => siteUrl(url, false));
});

test('password must match and respect size limits', () => {
  assert.equal(validPassword('abcdefgh', 'abcdefgh'), true);
  for (const [value, confirmation] of [['short', 'short'], ['abcdefgh', 'different'], ['a'.repeat(129), 'a'.repeat(129)]]) {
    assert.equal(validPassword(value, confirmation), false);
  }
});

function inviteHarness({ denied = false, ready = true, createError, inviteError, createThrows = false, inviteThrows = false } = {}) {
  const events = [];
  const admin = { auth: { admin: {
    async createUser(payload) {
      events.push(['create', payload]);
      if (createThrows) throw new Error('sensitive transport details');
      return { data: { user: createError ? null : { id: 'new-user' } }, error: createError };
    },
    async inviteUserByEmail(email, options) {
      events.push(['invite', email, options]);
      if (inviteThrows) throw new Error('sensitive transport details');
      return { data: { user: { id: 'new-user' } }, error: inviteError };
    },
    async deleteUser() { assert.fail('Must never delete existing or potentially invited users'); },
  } } };
  const actions = loadModule('../app/pastor/lideres/actions.ts', {
    'next/cache': { revalidatePath(path) { events.push(['revalidate', path]); } },
    '@/lib/auth': { async requireProfile(role) {
      events.push(['authorize', role]);
      if (denied) throw new Error('denied');
      return { user: { id: 'pastor-id' }, supabase: { async rpc(name) { events.push(['rpc', name]); return { data: ready, error: null }; } } };
    } },
    '@/lib/supabase/admin': { createSupabaseAdmin() { events.push(['admin']); return admin; } },
    '@/lib/invitations': { parseLeader, siteUrl },
  });
  return { events, invite: data => actions.inviteLeader({}, data) };
}

test('direct unauthorized action cannot instantiate Admin or mutate Auth', async () => {
  const h = inviteHarness({ denied: true });
  await assert.rejects(h.invite(form()), /denied/);
  assert.deepEqual(h.events, [['authorize', 'pastor']]);
});

test('invalid input or absent migration prevents account creation and mail', async () => {
  for (const [h, input] of [[inviteHarness(), form({ email: '' })], [inviteHarness({ ready: false }), form()]]) {
    assert.ok((await h.invite(input)).error);
    assert.equal(h.events.some(event => event[0] === 'create' || event[0] === 'invite'), false);
  }
});

test('provision precedes invitation, role cannot be supplied by the caller', async () => {
  const h = inviteHarness();
  assert.ok((await h.invite(form({ role: 'pastor', pastor_id: 'forged' }))).success);
  assert.deepEqual(h.events.map(e => e[0]), ['authorize', 'admin', 'rpc', 'create', 'invite', 'revalidate', 'revalidate']);
  const payload = h.events.find(e => e[0] === 'create')[1];
  assert.equal(payload.email_confirm, false);
  assert.equal(payload.app_metadata.uppchurch_onboarding.pastor_id, 'pastor-id');
  assert.equal(payload.app_metadata.uppchurch_onboarding.role, undefined);
  assert.equal(h.events.find(e => e[0] === 'invite')[2].redirectTo, 'http://localhost:3000/auth/callback');
});

test('existing email and failed Auth transaction never invite or delete anyone', async () => {
  for (const code of ['email_exists', 'user_already_exists', 'unexpected_failure']) {
    const h = inviteHarness({ createError: { code } });
    const result = await h.invite(form());
    assert.ok(result.error);
    if (code !== 'unexpected_failure') assert.match(result.error, /já possui/);
    assert.equal(h.events.some(e => e[0] === 'invite'), false);
  }
});

test('delivery failures/timeouts are explicit and preserve complete accounts', async () => {
  for (const options of [{ inviteError: { code: 'over_email_send_rate_limit' } }, { inviteThrows: true }]) {
    const h = inviteHarness(options);
    const result = await h.invite(form());
    assert.match(result.error, /Líder e célula foram cadastrados/);
    assert.doesNotMatch(result.error, /sensitive/);
    assert.equal(h.events.some(e => e[0] === 'revalidate'), true);
  }
  const h = inviteHarness({ createThrows: true });
  assert.match((await h.invite(form())).error, /confirmar o cadastro/);
  assert.equal(h.events.some(e => e[0] === 'invite'), false);
});

test('existing profile guard denies anonymous, missing profiles and wrong roles', async () => {
  for (const [user, profile, destination] of [[null, null, '/login'], [{ id: 'u' }, null, '/login?erro=perfil'],
    [{ id: 'u' }, { role: 'lider' }, '/lider']]) {
    const query = { select() { return this; }, eq() { return this; }, async maybeSingle() { return { data: profile, error: null }; } };
    const { requireProfile } = loadModule('../lib/auth.ts', {
      'next/navigation': { redirect(path) { throw new Error(path); } },
      '@/lib/supabase/server': { async createSupabaseClient() { return { auth: { async getUser() { return { data: { user } }; } }, from() { return query; } }; } },
    });
    await assert.rejects(requireProfile('pastor'), { message: destination });
  }
});

test('callback accepts only invite tokens, keeps them HttpOnly and never consumes on GET', async () => {
  const { GET } = loadModule('../app/auth/callback/route.ts', {
    'next/server': { NextResponse: { redirect(url) {
      const cookies = new Map();
      return { url: String(url), headers: new Map(), cookies: { values: cookies, set(name, value, options) { cookies.set(name, { value, options }); } } };
    } } },
  });
  for (const [query, valid] of [[`type=invite&token_hash=${'a'.repeat(64)}`, true],
    [`type=recovery&token_hash=${'a'.repeat(64)}`, false], ['type=invite&token_hash=bad', false]]) {
    const url = new URL(`https://church.example/auth/callback?${query}&next=https://evil.example`);
    const response = await GET({ url: url.href, nextUrl: url });
    assert.equal(response.url, `https://church.example/auth/convite${valid ? '' : '?erro=convite'}`);
    const cookie = response.cookies.values.get('uppchurch_invite');
    assert.equal(cookie.options.httpOnly, true);
    assert.equal(cookie.options.secure, true);
    assert.equal(cookie.options.path, '/auth');
    assert.equal(cookie.options.maxAge, valid ? 600 : 0);
    assert.equal(response.headers.get('Referrer-Policy'), 'no-referrer');
  }
});

test('acceptance verifies only the invite token and invalid links never establish access', async () => {
  for (const [token, fail, destination] of [[undefined, false, '/auth/convite?erro=convite'],
    ['token', true, '/auth/convite?erro=convite'], ['token', false, '/auth/definir-senha']]) {
    let verified = false;
    const { acceptInvite } = loadModule('../app/auth/actions.ts', {
      'next/headers': { async cookies() { return { get() { return token ? { value: token } : undefined; }, set() {} }; } },
      'next/navigation': { redirect(path) { throw new Error(path); } },
      '@/lib/auth': { requireProfile() { assert.fail('Token acceptance must verify OTP'); } },
      '@/lib/supabase/server': { async createSupabaseClient() { return { auth: { async verifyOtp(params) {
        assert.equal(params.type, 'invite'); assert.equal(params.token_hash, token); verified = true;
        return { error: fail ? { code: 'otp_expired' } : null };
      } } }; } },
      '@/lib/invitations': { validPassword },
    });
    await assert.rejects(acceptInvite(), { message: destination });
    assert.equal(verified, Boolean(token));
  }
});
