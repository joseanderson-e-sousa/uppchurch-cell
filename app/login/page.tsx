import { LoginForm } from "@/app/components/forms";
import { createSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { logout } from "@/app/actions";

export default async function LoginPage() {
  const supabase = await createSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: profile, error } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (error) throw new Error("Não foi possível carregar o perfil.");
    if (profile?.role === "pastor" || profile?.role === "lider") redirect(`/${profile.role}`);
  }
  return <main className="flex min-h-screen items-center justify-center p-4"><section className="panel w-full max-w-md space-y-6">
    <div><p className="text-sm font-semibold text-emerald-800">Gestão de Células</p><h1 className="mt-2 text-2xl font-bold">Bem-vindo</h1><p className="mt-2 text-slate-600">Acesse com o email e a senha fornecidos pela igreja.</p></div>
    {user ? <><p role="alert">Seu usuário ainda não possui um perfil válido. Solicite a configuração ao responsável.</p><form action={logout}><button className="button">Sair</button></form></> : <LoginForm />}
  </section></main>;
}
