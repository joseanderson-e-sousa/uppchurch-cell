import Link from "next/link";
import { cookies } from "next/headers";
import { acceptInvite } from "../actions";

export default async function AcceptInvitePage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const error = (await searchParams).erro;
  const hasToken = Boolean((await cookies()).get("uppchurch_invite")?.value);
  return <main className="mx-auto max-w-md p-6"><section className="panel space-y-5">
    <h1 className="text-2xl font-bold">Convite para UppChurch Cell</h1>
    {error || !hasToken ? <><p role="alert">Convite inválido, expirado ou já utilizado. Se você já definiu sua senha, entre normalmente. Caso contrário, procure o pastor.</p><Link href="/login" className="underline">Ir para o login</Link></>
      : <><p>Ao aceitar, você acessará a conta convidada e poderá definir sua senha.</p><form action={acceptInvite}><button className="button">Aceitar convite</button></form></>}
  </section></main>;
}
