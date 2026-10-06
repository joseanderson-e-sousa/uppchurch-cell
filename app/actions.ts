"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createSupabaseClient } from "@/lib/supabase/server";
import { parseReport } from "@/lib/reports";

export type FormState = { error?: string; success?: string };
export async function login(_: FormState, data: FormData): Promise<FormState> {
  const email = String(data.get("email") ?? "").trim(), password = String(data.get("password") ?? "");
  if (!email || !password) return { error: "Informe email e senha." };
  const supabase = await createSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "Não foi possível entrar. Confira email e senha e tente novamente." };
  const { profile } = await requireProfile();
  redirect(profile.role === "pastor" ? "/pastor" : "/lider");
}
export async function logout() {
  const supabase = await createSupabaseClient();
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) throw new Error("Não foi possível sair. Tente novamente.");
  redirect("/login");
}
export async function registerReport(_: FormState, data: FormData): Promise<FormState> {
  const { supabase, user } = await requireProfile("lider");
  const report = parseReport(data);
  if (!report) return { error: "Informe uma data válida e quantidades inteiras maiores ou iguais a zero." };
  const { data: cell, error: cellError } = await supabase.from("cells").select("id").eq("leader_id", user.id).eq("active", true).maybeSingle();
  if (cellError || !cell) return { error: "Nenhuma célula ativa vinculada. Procure o responsável." };
  const { error } = await supabase.from("weekly_reports").insert({ ...report, cell_id: cell.id, created_by: user.id });
  if (error) return { error: error.code === "23505" ? "Já existe uma reunião registrada para essa data." : "Não foi possível salvar a reunião. Tente novamente." };
  revalidatePath("/lider"); revalidatePath("/pastor");
  return { success: "Reunião registrada com sucesso." };
}
