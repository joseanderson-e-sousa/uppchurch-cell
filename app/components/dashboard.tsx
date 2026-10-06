import { logout } from "@/app/actions";
export function Dashboard({ name, title, children }: { name: string; title: string; children: React.ReactNode }) {
  return <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-10">
    <header className="flex items-start justify-between gap-4 border-b border-slate-200 pb-5">
      <div><p className="text-sm font-medium text-emerald-800">Gestão de Células</p><h1 className="mt-1 text-2xl font-bold">{title}</h1><p className="mt-1 text-slate-600">{name}</p></div>
      <form action={logout}><button className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-medium">Sair</button></form>
    </header>{children}
  </main>;
}
export function Stat({ label, value }: { label: string; value: number | string }) {
  return <div className="panel"><p className="text-sm text-slate-600">{label}</p><p className="mt-2 text-3xl font-semibold">{value}</p></div>;
}
