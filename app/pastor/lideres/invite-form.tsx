"use client";

import { useActionState } from "react";
import { inviteLeader } from "./actions";

export function InviteForm() {
  const [state, action, pending] = useActionState(inviteLeader, {});
  return <form action={action} className="mt-5 space-y-4">
    <label className="field">Nome do líder<input name="name" required maxLength={120} autoComplete="name" /></label>
    <label className="field">E-mail<input name="email" type="email" required maxLength={254} autoComplete="email" /></label>
    <label className="field">Nome da célula<input name="cell_name" required maxLength={120} /></label>
    <label className="field">Local (opcional)<input name="location" maxLength={240} /></label>
    <label className="field">Dia da semana (opcional)<select name="weekday" className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-2">
      <option value="">Não informado</option>
      {["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"].map((day, index) => <option key={day} value={index}>{day}</option>)}
    </select></label>
    <label className="field">Horário (opcional)<input name="meeting_time" type="time" /></label>
    {state.error && <p role="alert" className="text-red-700">{state.error}</p>}
    {state.success && <p role="status" className="text-emerald-800">{state.success}</p>}
    <button className="button" disabled={pending}>{pending ? "Enviando…" : "Convidar líder"}</button>
  </form>;
}
