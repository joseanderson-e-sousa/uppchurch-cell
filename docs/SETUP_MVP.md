# Configuração do MVP

## 1. Banco
No SQL Editor do projeto Supabase, execute uma vez todo o arquivo
`supabase/migrations/202610060001_mvp.sql`. Ele cria tabelas, constraints e RLS
em uma transação. Não execute sobre tabelas preexistentes com os mesmos nomes.

## 2. Pastor e líderes no Auth
Em Authentication → Providers → Email, mantenha email/senha habilitado.
Em Authentication → configuração de cadastro, desative **Allow new users to sign up**.
Isso impede cadastro público também pela API.
Em Authentication → Users → Add user → Create new user, crie manualmente o
pastor e os nove líderes, com emails e senhas definidos fora do código.
Confirme os emails (Auto Confirm, quando disponível). Copie o UUID de cada usuário.

## 3. Profiles
Execute no SQL Editor, substituindo os placeholders antes de executar:

```sql
insert into public.profiles (id, name, role) values
  ('UUID_DO_PASTOR', 'Pastor', 'pastor'),
  ('UUID_DO_LIDER_1', 'Líder 1', 'lider');
```

Repita a linha de líder para os nove UUIDs. O ID precisa ser exatamente o ID de
Authentication → Users. Perfis não são criados automaticamente. Um usuário
sem perfil recebe uma mensagem e não acessa os dashboards.

## 4. Nove células
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
novos relatórios. Administração de usuários/células é manual neste MVP.

## 5. Executar localmente
O `.env.local` deve conter `NEXT_PUBLIC_SUPABASE_URL` e
`NEXT_PUBLIC_SUPABASE_ANON_KEY` do projeto. Não use service_role.

```sh
npm ci
npm run dev
```

Abra http://localhost:3000. Para verificar: `npm run lint` e `npm run build`.
Testes de validação e períodos: `node --experimental-strip-types --test tests/reports.test.mjs`.

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
