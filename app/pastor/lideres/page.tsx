import Link from "next/link";
import { Dashboard } from "@/app/components/dashboard";
import { requireProfile } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { InviteForm } from "./invite-form";

export default async function LeadersPage() {
  const { supabase, profile } = await requireProfile("pastor");
  const [leaders, cells] = await Promise.all([
    supabase.from("profiles").select("id,name").eq("role", "lider").order("name"),
    supabase.from("cells").select("name,leader_id,active"),
  ]);
  if (leaders.error || cells.error) throw new Error("Não foi possível carregar os líderes.");
  // Only minimal display fields leave the server, never the Auth user object.
  let admin: ReturnType<typeof createSupabaseAdmin> | undefined;
  try { admin = createSupabaseAdmin(); } catch { /* Existing leaders still render. */ }
  const rows = [];
  for (const leader of leaders.data) {
    let email = "Indisponível", status = "Estado do acesso indisponível";
    if (admin) {
      try {
        const { data, error } = await admin.auth.admin.getUserById(leader.id);
        if (!error && data.user) {
          email = data.user.email ?? "Não informado";
          status = data.user.email_confirmed_at ? "Email confirmado"
            : data.user.invited_at ? "Convite enviado; aguardando aceite"
            : "Envio não confirmado; suporte necessário";
        }
      } catch { /* Never expose raw administrative errors. */ }
    }
    rows.push({ ...leader, email, status, cell: cells.data.find(cell => cell.leader_id === leader.id) });
  }
  return <Dashboard name={profile.name} title="Líderes">
    <Link href="/pastor" className="underline">Voltar ao dashboard</Link>
    <section className="panel"><h2 className="mb-4 text-xl font-semibold">Líderes cadastrados</h2>
      {!rows.length ? <p>Nenhum líder cadastrado.</p> : <div className="overflow-x-auto"><table>
        <thead><tr><th>Nome</th><th>E-mail</th><th>Célula</th><th>Estado do acesso</th></tr></thead>
        <tbody>{rows.map(row => <tr key={row.id}><td>{row.name}</td><td>{row.email}</td><td>{row.cell ? `${row.cell.name}${row.cell.active ? "" : " (inativa)"}` : "Sem célula"}</td><td>{row.status}</td></tr>)}</tbody>
      </table></div>}
    </section>
    <details className="panel"><summary className="cursor-pointer text-lg font-semibold">Convidar líder</summary><InviteForm /></details>
  </Dashboard>;
}
