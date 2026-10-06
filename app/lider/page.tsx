import { requireProfile } from "@/lib/auth";
import { formatDate, todayInSaoPaulo } from "@/lib/reports";
import { Dashboard, Stat } from "@/app/components/dashboard";
import { ReportForm } from "@/app/components/forms";
import Link from "next/link";
const weekdays = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
export default async function LeaderPage({ searchParams }: { searchParams: Promise<{ pagina?: string }> }) {
  const requestedPage = Number((await searchParams).pagina ?? 1);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 && requestedPage < 100000 ? requestedPage : 1;
  const { supabase, profile } = await requireProfile("lider");
  const { data: cell, error } = await supabase.from("cells").select("id,name,location,weekday,meeting_time,active").eq("leader_id", profile.id).maybeSingle();
  if (error) throw new Error("Não foi possível carregar a célula.");
  if (!cell) return <Dashboard name={profile.name} title="Minha célula"><p className="panel">Você ainda não possui uma célula vinculada. Procure o responsável.</p></Dashboard>;
  const { data: reports, error: reportsError, count } = await supabase.from("weekly_reports").select("id,meeting_date,participants,visitors", { count: "exact" }).eq("cell_id", cell.id).order("meeting_date", { ascending: false }).range((page - 1) * 20, page * 20 - 1);
  if (reportsError) throw new Error("Não foi possível carregar o histórico.");
  const { data: last, error: lastError } = await supabase.from("weekly_reports").select("meeting_date,participants,visitors").eq("cell_id", cell.id).order("meeting_date", { ascending: false }).limit(1).maybeSingle();
  if (lastError) throw new Error("Não foi possível carregar a última reunião.");
  return <Dashboard name={profile.name} title={cell.name}>
    <div className="text-slate-600">{cell.location && <p>{cell.location}</p>}<p>{cell.weekday !== null ? weekdays[cell.weekday] : ""}{cell.meeting_time ? ` • ${cell.meeting_time.slice(0, 5)}` : ""}</p></div>
    <section aria-label="Última reunião" className="grid gap-4 sm:grid-cols-2"><Stat label="Participantes da última reunião" value={last?.participants ?? "—"} /><Stat label="Visitantes da última reunião" value={last?.visitors ?? "—"} /></section>
    {last && <p className="text-sm text-slate-600">Última reunião: {formatDate(last.meeting_date)}</p>}
    <section className="panel"><h2 className="mb-4 text-xl font-semibold">Registrar reunião</h2>{cell.active ? <ReportForm today={todayInSaoPaulo()} /> : <p>Esta célula está inativa. Novos lançamentos estão desabilitados.</p>}</section>
    <section className="panel"><h2 className="mb-4 text-xl font-semibold">Histórico de reuniões</h2>
      {!reports?.length ? <p className="text-slate-600">Nenhuma reunião nesta página.</p> : <><p className="mb-3 text-sm text-slate-600">Página {page} · {count} reuniões</p><div className="overflow-x-auto"><table><thead><tr><th>Data</th><th>Participantes</th><th>Visitantes</th></tr></thead><tbody>{reports.map(report => <tr key={report.id}><td>{formatDate(report.meeting_date)}</td><td>{report.participants}</td><td>{report.visitors}</td></tr>)}</tbody></table></div></>}
      <nav aria-label="Páginas do histórico" className="mt-4 flex gap-4">{page > 1 && <Link className="underline" href={`/lider?pagina=${page - 1}`}>Anterior</Link>}{page * 20 < (count ?? 0) && <Link className="underline" href={`/lider?pagina=${page + 1}`}>Próxima</Link>}</nav>
    </section>
  </Dashboard>;
}
