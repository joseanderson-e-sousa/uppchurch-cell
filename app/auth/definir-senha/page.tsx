import { requireProfile } from "@/lib/auth";
import { PasswordForm } from "./password-form";

export default async function SetPasswordPage() {
  const { profile } = await requireProfile("lider");
  return <main className="mx-auto max-w-md p-6"><section className="panel space-y-5">
    <h1 className="text-2xl font-bold">Defina sua senha</h1>
    <p>{profile.name}, escolha uma senha com pelo menos 8 caracteres para entrar com seu email nas próximas visitas.</p>
    <PasswordForm />
  </section></main>;
}
