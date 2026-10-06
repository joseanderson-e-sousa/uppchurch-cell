// Disposable PostgreSQL (PGlite), never connects to the project's Supabase.
// Install the optional runner as documented in docs/SETUP_MVP.md.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const require = createRequire(import.meta.url);
const { PGlite } = require(require.resolve('@electric-sql/pglite', {
  paths: [fileURLToPath(new URL('../node_modules/.onboarding-test/', import.meta.url))],
}));
const db = new PGlite();
let checks = 0;
const pastor = randomUUID(), leader = randomUUID(), other = randomUUID();
const metadata = overrides => ({ uppchurch_onboarding: {
  version: 1, pastor_id: pastor, name: 'Novo líder', cell_name: 'Nova célula',
  location: null, weekday: 0, meeting_time: '19:30', ...overrides,
} });

try {
  // Minimal Auth schema/API role stand-in. Both real migrations run unchanged.
  await db.exec(`
    create role anon;
    create role authenticated;
    create role supabase_auth_admin;
    create schema auth;
    create table auth.users (
      id uuid primary key, email text unique, raw_app_meta_data jsonb default '{}',
      raw_user_meta_data jsonb default '{}'
    );
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;
    grant usage on schema auth to authenticated, supabase_auth_admin;
    grant all on auth.users to supabase_auth_admin;
  `);
  for (const migration of ['202610060001_mvp.sql', '202610060002_leader_onboarding.sql']) {
    await db.exec(readFileSync(new URL(`../supabase/migrations/${migration}`, import.meta.url), 'utf8'));
  }
  await db.query('insert into auth.users(id,email) values ($1,$2)', [pastor, 'pastor@example.test']);
  await db.query("insert into public.profiles(id,name,role) values ($1,'Pastor','pastor')", [pastor]);

  async function createAuth(id, payload, insertMetadata = false) {
    // GoTrue adminUserCreate: INSERT, then UPDATE app_metadata in one transaction.
    await db.transaction(async tx => {
      await tx.exec('set local role supabase_auth_admin');
      await tx.query('insert into auth.users(id,email,raw_app_meta_data) values ($1,$2,$3)',
        [id, `${id}@example.test`, insertMetadata ? payload : {}]);
      if (!insertMetadata) await tx.query('update auth.users set raw_app_meta_data=$1 where id=$2', [payload, id]);
    });
  }
  await createAuth(leader, metadata({}));
  await createAuth(other, metadata({ name: 'Outro líder', cell_name: 'Outra célula' }), true);
  assert.equal((await db.query('select role from public.profiles where id=$1', [leader])).rows[0].role, 'lider');
  const cell = (await db.query('select * from public.cells where leader_id=$1', [leader])).rows[0];
  const otherCell = (await db.query('select * from public.cells where leader_id=$1', [other])).rows[0];
  assert.equal(cell.weekday, 0);
  assert.equal(cell.meeting_time, '19:30:00');
  checks++;

  // Both failed profile and failed cell must undo the preceding Auth INSERT.
  for (const invalid of [{ name: '' }, { cell_name: null }, { weekday: 7 }, { pastor_id: leader }]) {
    const id = randomUUID();
    await assert.rejects(createAuth(id, metadata(invalid)));
    assert.equal((await db.query('select * from auth.users where id=$1', [id])).rows.length, 0);
    assert.equal((await db.query('select * from public.profiles where id=$1', [id])).rows.length, 0);
    assert.equal((await db.query('select * from public.cells where leader_id=$1', [id])).rows.length, 0);
    checks++;
  }

  // User-editable metadata cannot provision a role or a cell.
  const forged = randomUUID();
  await db.query('insert into auth.users(id,email,raw_user_meta_data) values ($1,$2,$3)',
    [forged, 'forged@example.test', metadata({ role: 'pastor' })]);
  assert.equal((await db.query('select * from public.profiles where id=$1', [forged])).rows.length, 0);
  await db.query('update auth.users set raw_app_meta_data=raw_app_meta_data where id=$1', [leader]);
  assert.equal((await db.query('select * from public.cells where leader_id=$1', [leader])).rows.length, 1);
  checks++;

  async function asUser(id, callback) {
    return db.transaction(async tx => {
      await tx.exec('set local role authenticated');
      await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [id]);
      return callback(tx);
    });
  }
  await asUser(leader, async tx => {
    assert.equal((await tx.query('select * from public.profiles')).rows.length, 1);
    assert.equal((await tx.query('select * from public.cells')).rows.length, 1);
    assert.equal((await tx.query('select public.leader_onboarding_ready() as ready')).rows[0].ready, false);
    await tx.query('insert into public.weekly_reports(cell_id,meeting_date,participants,visitors,created_by) values ($1,$2,3,1,$3)', [cell.id, '2026-10-06', leader]);
  });
  checks++;
  for (const query of [
    tx => tx.query('insert into public.weekly_reports(cell_id,meeting_date,participants,visitors,created_by) values ($1,$2,3,1,$3)', [otherCell.id, '2026-10-06', leader]),
    tx => tx.query("update public.profiles set role='pastor' where id=$1", [leader]),
    tx => tx.query("insert into public.profiles(id,name,role) values ($1,'Fake','pastor')", [forged]),
  ]) { await assert.rejects(asUser(leader, query), error => error.code === '42501'); checks++; }
  await asUser(other, async tx => assert.equal((await tx.query('select * from public.weekly_reports')).rows.length, 0));
  await asUser(pastor, async tx => {
    assert.equal((await tx.query('select * from public.cells')).rows.length, 2);
    assert.equal((await tx.query('select * from public.weekly_reports')).rows.length, 1);
    assert.equal((await tx.query('select public.leader_onboarding_ready() as ready')).rows[0].ready, true);
  });
  checks++;
  await db.exec('alter table auth.users disable trigger uppchurch_provision_invited_leader');
  await asUser(pastor, async tx => assert.equal((await tx.query('select public.leader_onboarding_ready() as ready')).rows[0].ready, false));
  await assert.rejects(db.transaction(async tx => {
    await tx.exec('set local role anon');
    await tx.query('select public.leader_onboarding_ready()');
  }), error => error.code === '42501');
  checks++;
  console.log(`${checks} PostgreSQL checks passed: migrations, atomic rollback, metadata trust, readiness, RLS and reports.`);
} finally {
  await db.close();
}
