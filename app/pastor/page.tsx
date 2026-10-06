import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { formatDate, periodBounds } from "@/lib/reports";
import { Dashboard, Stat } from "@/app/components/dashboard";
export default async function PastorPage({ searchParams }: { searchParams: Promise<{ periodo?: string }> }) {
  const { supabase, profile } = await requireProfile("pastor");
  const period = (await searchParams).periodo === "mes" ? "mes" : "semana";
  const { start, end } = periodBounds(period);
  const [cellsResult, profilesResult, reportsResult] = await Promise.all([
    supabase.from("cells").select("id,name,leader_id,active").order("name"),
    supabase.from("profiles").select("id,name"),
    supabase.from("weekly_reports").select("cell_id,participants,visitors,meeting_date").gte("meeting_date", start).lt("meeting_date", end).order("meeting_date", { ascending: false }),
  ]);
  if (cellsResult.error || profilesResult.error || reportsResult.error) throw new Error("Não foi possível carregar o dashboard.");
  const cells = cellsResult.data ?? [], reports = reportsResult.data ?? [];
  const names = new Map(profilesResult.data?.map(p => [p.id, p.name]));
  return <Dashboard name={profile.name} title="Visão geral">
    <nav aria-label="Período" className="flex gap-2">{(["semana", "mes"] as const).map(value => <Link key={value} href={`/pastor?periodo=${value}`} aria-current={period === value ? "page" : undefined} className={period === value ? "button" : "rounded-lg border border-slate-300 bg-white px-4 py-2"}>{value === "semana" ? "Semana" : "Mês"}</Link>)}</nav>
    <p className="text-sm text-slate-600">{period === "semana" ? "Semana atual (segunda a domingo)" : "Mês atual"} · A partir de {formatDate(start)} · Horário de São Paulo</p>
    <section aria-label="Indicadores" className="grid grid-cols-2 gap-4 lg:grid-cols-4"><Stat label="Células ativas" value={cells.filter(c => c.active).length} /><Stat label="Células com lançamento no período" value={new Set(reports.map(r => r.cell_id)).size} /><Stat label="Participações" value={reports.reduce((sum, r) => sum + r.participants, 0)} /><Stat label="Visitantes" value={reports.reduce((sum, r) => sum + r.visitors, 0)} /></section>
    <section className="panel"><h2 className="text-xl font-semibold">Acompanhamento das células</h2><p className="my-3 text-sm text-slate-600">Quantidades somadas no período. Último lançamento indica a data da reunião mais recente no período.</p>
      {!cells.length ? <p>Nenhuma célula cadastrada.</p> : <div className="overflow-x-auto"><table><thead><tr><th>Célula</th><th>Líder</th><th>Participantes</th><th>Visitantes</th><th>Último lançamento</th><th>Status</th></tr></thead><tbody>{cells.map(cell => {
        const entries = reports.filter(r => r.cell_id === cell.id);
        return <tr key={cell.id}><td className="font-medium">{cell.name}{!cell.active && <span className="block text-xs text-slate-500">Inativa</span>}</td><td>{names.get(cell.leader_id) ?? "Sem líder"}</td><td>{entries.reduce((sum, r) => sum + r.participants, 0)}</td><td>{entries.reduce((sum, r) => sum + r.visitors, 0)}</td><td>{entries[0] ? formatDate(entries[0].meeting_date) : "—"}</td><td><span className={`rounded-full px-3 py-1 text-xs font-semibold ${entries.length ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{entries.length ? "Realizada" : "Pendente"}</span></td></tr>;
      })}</tbody></table></div>}
    </section>
  </Dashboard>;
}
