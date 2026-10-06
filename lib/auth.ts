import { redirect } from "next/navigation";
import { createSupabaseClient } from "@/lib/supabase/server";

export async function requireProfile(role?: "pastor" | "lider") {
  const supabase = await createSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile, error } = await supabase.from("profiles").select("id,name,role").eq("id", user.id).maybeSingle();
  if (error) throw new Error("Não foi possível carregar o perfil.");
  if (!profile || !["pastor", "lider"].includes(profile.role)) redirect("/login?erro=perfil");
  if (role && profile.role !== role) redirect(profile.role === "pastor" ? "/pastor" : "/lider");
  return { supabase, profile, user };
}
