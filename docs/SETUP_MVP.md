# Configuração do MVP

## 1. Banco
No SQL Editor do projeto Supabase, execute uma vez todo o arquivo
`supabase/migrations/202610060001_mvp.sql`. Ele cria tabelas, constraints e RLS
em uma transação. Não execute sobre tabelas preexistentes com os mesmos nomes.

Em um MVP já instalado, execute **somente** a nova migration
`supabase/migrations/202610060002_leader_onboarding.sql`, uma vez, no SQL Editor.
Ela adiciona um trigger de onboarding e uma função de verificação; não modifica
as políticas RLS existentes, dados ou permissões das tabelas do MVP.

## 2. Pastor e líderes no Auth
Em Authentication → Providers → Email, mantenha email/senha habilitado.
Em Authentication → configuração de cadastro, desative **Allow new users to sign up**.
Isso impede cadastro público também pela API.
Em Authentication → Users → Add user → Create new user, crie manualmente o
pastor inicial, com email e senha definidos fora do código.
Confirme os emails (Auto Confirm, quando disponível). Copie o UUID de cada usuário.

## 3. Profiles
Execute no SQL Editor, substituindo os placeholders antes de executar:

```sql
insert into public.profiles (id, name, role) values
  ('UUID_DO_PASTOR', 'Pastor', 'pastor'),
  ('UUID_DO_LIDER_1', 'Líder 1', 'lider');
```

Para cadastros manuais legados, o ID precisa ser exatamente o ID de
Authentication → Users. Perfis não são criados automaticamente. Um usuário
sem perfil recebe uma mensagem e não acessa os dashboards. **Novos líderes devem
ser convidados em `/pastor/lideres`**; perfil e célula são criados automaticamente.
Não recrie os usuários, profiles ou células que já funcionam.

## 4. Células manuais legadas (referência)
Execute no SQL Editor, substituindo cada UUID pelo líder correspondente:

```sql
insert into public.cells (name, leader_id) values
  ('Célula 1', 'UUID_DO_LIDER_1'),
  ('Célula 2', 'UUID_DO_LIDER_2'),
  ('Célula 3', 'UUID_DO_LIDER_3'),
  ('Célula 4', 'UUID_DO_LIDER_4'),
  ('Célula 5', 'UUID_DO_LIDER_5'),
  ('Célula 6', 'UUID_DO_LIDER_6'),
  ('Célula 7', 'UUID_DO_LIDER_7'),
  ('Célula 8', 'UUID_DO_LIDER_8'),
  ('Célula 9', 'UUID_DO_LIDER_9');
```

Edite nomes, `location`, `weekday` (0 domingo a 6 sábado) e `meeting_time`
(`19:30`, por exemplo) no Table Editor. Os três últimos são opcionais.
Cada líder tem uma célula e somente profiles `lider` podem ser associados.
`active` inicia como true. Células inativas mantêm histórico, mas não aceitam
novos relatórios. O fluxo abaixo substitui o cadastro manual de novos líderes/células.

## 5. Executar localmente
O `.env.local` deve conter `NEXT_PUBLIC_SUPABASE_URL` e
`NEXT_PUBLIC_SUPABASE_ANON_KEY` do projeto, além das duas novas variáveis:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://SEU_PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=SUA_CHAVE_ANON
SUPABASE_SERVICE_ROLE_KEY=SUA_CHAVE_SERVICE_ROLE
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Os valores acima são placeholders. Não copie credenciais para documentação, Git,
logs ou Client Components. `.env.local` é ignorado pelo Git. A service role só é
lida em `lib/supabase/admin.ts`, protegido por `import "server-only"`, sem cookies,
persistência ou refresh de sessão. Nunca use prefixo `NEXT_PUBLIC_` nessa chave.
A página e a Server Action administrativas validam sessão e `profiles.role=pastor`
**antes** de criar o cliente Admin.

`NEXT_PUBLIC_SITE_URL` deve conter apenas a origem, sem caminho, query ou credenciais.
Em `next dev`, a ausência permite fallback para `http://localhost:3000`.
Em produção (`next build` + `next start` e Vercel), informe uma origem HTTPS explícita;
o envio falha de forma segura se a URL estiver ausente ou inválida. Não usamos o
header Host fornecido pelo visitante para construir links de convite.

```sh
npm ci
npm run dev
```

Abra http://localhost:3000. Para verificar: `npm run lint` e `npm run build`.
Testes de validação e períodos: `node --experimental-strip-types --test tests/reports.test.mjs`.

Testes de onboarding e segurança: `node --experimental-strip-types --test tests/invitations.test.mjs`.

Para testar as duas migrations, rollback e RLS em um PostgreSQL descartável
(sem acessar seu Supabase), instale opcionalmente o executor dentro de node_modules:

```sh
npm install --prefix node_modules/.onboarding-test --no-package-lock --no-save --no-audit --no-fund @electric-sql/pglite@0.5.8
node tests/onboarding-db.mjs
```

O teste simula as operações SQL de Auth; não substitui o teste de email real.
Não adiciona dependências ao aplicativo nem altera o banco remoto.

## 6. Testar os fluxos
- Sem login, abra `/lider` e `/pastor`: ambos devem levar ao login.
- Entre como líder: veja apenas sua célula; registre data, participantes e
  visitantes (inclusive zero). Verifique confirmação, cards e histórico.
- Tente repetir a data: deve aparecer erro de duplicidade. Valores negativos,
  fracionários e campos vazios devem ser recusados.
- Entre como outro líder em janela privada: o relatório anterior não deve aparecer.
- Entre como pastor: veja as nove células, participações e visitantes. Alterne
  Semana/Mês e confira Realizada/Pendente. Semana é segunda a domingo e mês é
  o mês atual, em America/Sao_Paulo, filtrados pela data da reunião.
- O último lançamento da tabela é a última **data da reunião no período**.
  Indicadores de relatórios incluem células inativas; o card de ativas conta
  somente `active=true`. Participações são somas, não pessoas únicas.
- Abra a rota do outro perfil: deve redirecionar para a rota do seu perfil.
- Saia e tente reabrir o dashboard: deve exigir login.
- Teste usuário sem profile e líder sem célula: devem receber orientação.

## 7. Verificar RLS diretamente
Use o SQL Editor com os UUIDs reais de teste, em uma transação que será desfeita:

```sql
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'UUID_DO_LIDER_1', true);
select * from public.profiles; -- apenas o próprio perfil
select * from public.cells; -- apenas sua célula
select * from public.weekly_reports; -- apenas sua célula
rollback;
```

Repita trocando pelo pastor: deve visualizar todos. Em transações separadas,
sob o papel authenticated e UUID de líder, tente inserir relatório usando o
`cell_id` de outro líder ou `created_by` de outra pessoa: RLS deve negar.
Tente alterar `profiles.role`, atualizar/excluir relatórios ou inserir como
pastor: deve negar. Não teste apenas como postgres no SQL Editor, pois ele
ignora RLS. Cadastros e testes autenticados dependem da configuração acima.

## 8. Configurar o convite no Supabase Auth

1. Mantenha Email/senha habilitado e **Allow new users to sign up desativado**.
   O usuário nunca escolhe seu papel. Só o pastor autenticado aciona a Admin API.
2. Em Authentication → URL Configuration, configure Site URL como
   `http://localhost:3000` no ambiente de desenvolvimento e adicione a Redirect URL
   exata `http://localhost:3000/auth/callback`.
3. Em Authentication → Emails → Templates → **Invite user**, configure o link:

```html
<h2>Convite para UppChurch Cell</h2>
<p>Você foi convidado para liderar uma célula.</p>
<p><a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&amp;type=invite">Aceitar convite</a></p>
```

Não use o link padrão `{{ .ConfirmationURL }}` neste fluxo: ele retorna tokens
em fragmento, que o servidor não recebe. O template acima usa a
[verificação de token documentada pelo Supabase](https://supabase.com/docs/guides/auth/auth-email-templates).
O callback guarda o token por até dez minutos em cookie HttpOnly e redireciona
para uma URL sem token. O botão **Aceitar convite** verifica o token com
`verifyOtp({ token_hash, type: "invite" })`, estabelece cookies de sessão via SSR
e abre `/auth/definir-senha`. O líder salva a senha com `auth.updateUser` na própria
sessão e segue para `/lider`. GET não consome o token (proteção contra scanners).

**Limitação do serviço de email:** o serviço padrão do Supabase só envia para
endereços autorizados da equipe do projeto e tem limites baixos de envio.
Use um email novo no Auth que esteja autorizado como destinatário para o teste.
Se o projeto já tem SMTP configurado, valem as restrições desse serviço.
Sem um serviço de envio já habilitado para outros destinatários, não é possível
validar convites para emails arbitrários neste ciclo; não há integração de provedor
adicional no código. Veja as [restrições oficiais de email](https://supabase.com/docs/guides/auth/auth-smtp).

## 9. Como testar o convite localmente

1. Aplique a migration 002 e configure as variáveis, URLs e template acima.
2. Reinicie `npm run dev`. Entre com o pastor já existente.
3. No dashboard, clique **Líderes**, depois **Convidar líder**.
4. Informe nome, um email novo no Auth e nome da célula. Local, dia e horário são
   opcionais. Envie e confira a mensagem de envio e a linha na lista de líderes.
5. Abra o email em outro navegador ou janela privada para preservar a sessão do
   pastor. Clique no link e em **Aceitar convite**. Defina e confirme a senha.
6. Confira `/lider`: nome e dados da célula devem ser os informados pelo pastor.
   Registre uma reunião, saia e entre novamente com email/senha.
7. Como líder, tente `/pastor/lideres`: deve voltar para `/lider`. Sem sessão,
   a página deve exigir login. Refaça os testes de RLS e de relatórios da seção 7.
8. Como pastor, confira a nova célula no dashboard. Tente convidar novamente o
   mesmo email (inclusive antes do aceite): deve haver conflito, sem alterações.
9. Teste campos inválidos, confirmação de senha diferente e um link inválido ou
   já utilizado. Não deve haver cadastro parcial nem acesso indevido.

## 10. Consistência e falhas

Antes de qualquer criação, a aplicação verifica a migration/trigger via RPC
autenticada. `createUser` recusa emails existentes, inclusive não confirmados.
Os dados de onboarding são enviados em **app_metadata**, modificável apenas pela
Admin API, nunca em user_metadata. O trigger valida o pastor de origem e fixa
`role='lider'`; não existe parâmetro de papel no formulário.

O Auth insere o usuário e aplica app_metadata na mesma transação; o trigger cobre
INSERT e UPDATE desses metadados. Perfil e célula são inseridos nessa transação.
Se qualquer inserção falhar, PostgreSQL desfaz Auth + profile + cell automaticamente.
Isso evita compensação por exclusões via múltiplas APIs e não apaga preexistentes.
Referência da implementação: [Supabase Auth adminUserCreate](https://github.com/supabase/auth/blob/master/internal/api/admin.go).

Após esse commit, `inviteUserByEmail` envia o convite ao usuário recém-criado e
ainda não confirmado. A [API aceita usuários não confirmados](https://github.com/supabase/auth/blob/master/internal/api/invite.go).
Se o envio falhar ou sua resposta for perdida, o cadastro **completo** é preservado
e a ação informa expressamente que não confirmou o envio. Um email entregue não
deve apontar para uma conta apagada. O status da lista usa `invited_at` e
`email_confirmed_at`; não garante entrega na caixa de entrada nem senha definida.
Em timeout da criação, a lista deve ser atualizada antes de repetir a operação.

Não há reenvio na interface neste ciclo. Em falha de envio, o responsável técnico
deve conferir os logs de Auth/configuração de email; se o usuário permanece não
confirmado, pode reenviar o convite pelo painel/API administrativa do Supabase,
usando a mesma URL de callback. Não apagar cadastros para tentar novamente.
No fluxo normal, o pastor não usa o painel do Supabase.

## 11. Posteriormente na Vercel (sem deploy neste ciclo)

- Configure `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY` (variável secreta, sem prefixo público) e
  `NEXT_PUBLIC_SITE_URL=https://SEU_DOMINIO` nos ambientes necessários.
- No Supabase, atualize Site URL e adicione `https://SEU_DOMINIO/auth/callback`
  à lista de redirects. Cada preview usado para convites precisa de origem e URL
  autorizada explícitas; evite autorizações amplas de domínios de terceiros.
- Repita a configuração do template de convite e confira as restrições de email.
  Em outro projeto Supabase, aplique migrations 001 e 002; no mesmo projeto já
  migrado, não execute migrations novamente. Mantenha cadastro público desligado.
- Reinicie/recompile após configurar as variáveis e repita o teste completo da
  seção 9 com um novo email autorizado.
