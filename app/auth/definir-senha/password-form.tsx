"use client";
import { useActionState } from "react";
import { setInvitePassword } from "../actions";

export function PasswordForm() {
  const [state, action, pending] = useActionState(setInvitePassword, {});
  return <form action={action} className="space-y-4">
    <label className="field">Nova senha<input name="password" type="password" minLength={8} maxLength={128} required autoComplete="new-password" /></label>
    <label className="field">Confirmar senha<input name="confirmation" type="password" minLength={8} maxLength={128} required autoComplete="new-password" /></label>
    {state.error && <p role="alert" className="text-red-700">{state.error}</p>}
    <button className="button" disabled={pending}>{pending ? "Salvando…" : "Salvar senha e acessar minha célula"}</button>
  </form>;
}
