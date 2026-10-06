"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createSupabaseClient } from "@/lib/supabase/server";
import { validPassword } from "@/lib/invitations";
import type { FormState } from "@/app/actions";

export async function acceptInvite(): Promise<void> {
  const store = await cookies();
  const token = store.get("uppchurch_invite")?.value;
  if (!token) redirect("/auth/convite?erro=convite");
  const supabase = await createSupabaseClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash: token, type: "invite" });
  store.set("uppchurch_invite", "", { httpOnly: true, path: "/auth", maxAge: 0 });
  if (error) redirect("/auth/convite?erro=convite");
  redirect("/auth/definir-senha");
}

export async function setInvitePassword(_: FormState, form: FormData): Promise<FormState> {
  const { supabase } = await requireProfile("lider");
  const password = String(form.get("password") ?? "");
  if (!validPassword(password, String(form.get("confirmation") ?? ""))) {
    return { error: "Use uma senha de 8 a 128 caracteres e repita a mesma senha na confirmação." };
  }
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: "Não foi possível salvar a senha. Confira os requisitos de senha da igreja e tente novamente; se a sessão expirou, entre novamente." };
  redirect("/lider");
}
