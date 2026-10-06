"use client";
import { useActionState } from "react";
import { login, registerReport } from "@/app/actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, {});
  return <form action={action} className="space-y-5">
    <label className="field">Email<input name="email" type="email" autoComplete="username" required /></label>
    <label className="field">Senha<input name="password" type="password" autoComplete="current-password" required /></label>
    {state.error && <p role="alert" className="text-red-700">{state.error}</p>}
    <button className="button w-full" disabled={pending}>{pending ? "Entrando…" : "Entrar"}</button>
  </form>;
}
export function ReportForm({ today }: { today: string }) {
  const [state, action, pending] = useActionState(registerReport, {});
  return <form action={action} className="space-y-4">
    <label className="field">Data da reunião<input name="meeting_date" type="date" defaultValue={today} required /></label>
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="field">Participantes<input name="participants" type="number" min="0" max="2147483647" step="1" required /></label>
      <label className="field">Visitantes<input name="visitors" type="number" min="0" max="2147483647" step="1" required /></label>
    </div>
    {state.error && <p role="alert" className="text-red-700">{state.error}</p>}
    {state.success && <p role="status" className="text-emerald-800">{state.success}</p>}
    <button className="button" disabled={pending}>{pending ? "Salvando…" : "Registrar reunião"}</button>
  </form>;
}
