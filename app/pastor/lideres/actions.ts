"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { parseLeader, siteUrl } from "@/lib/invitations";
import type { FormState } from "@/app/actions";

export async function inviteLeader(_: FormState, form: FormData): Promise<FormState> {
  const { supabase, user } = await requireProfile("pastor");
  const input = parseLeader(form);
  if (!input) return { error: "Confira nome, email, célula, dia (0 a 6) e horário (HH:MM)." };

  let admin: ReturnType<typeof createSupabaseAdmin>, redirectTo: string;
  try {
    redirectTo = `${siteUrl(process.env.NEXT_PUBLIC_SITE_URL, process.env.NODE_ENV === "development")}/auth/callback`;
    admin = createSupabaseAdmin();
  } catch {
    return { error: "Convites indisponíveis. Solicite a configuração das variáveis de ambiente ao responsável técnico." };
  }
  const { data: ready, error: migrationError } = await supabase.rpc("leader_onboarding_ready");
  if (migrationError || ready !== true) return { error: "Convites indisponíveis. A migration de onboarding precisa estar instalada." };

  // createUser rejects existing emails (including unconfirmed users). The trigger
  // provisions profile + cell in this same Auth transaction, before any email.
  // Never pass role or arbitrary metadata from FormData.
  let created;
  try {
    created = await admin.auth.admin.createUser({
      email: input.email,
      email_confirm: false,
      app_metadata: { uppchurch_onboarding: { ...input, version: 1, pastor_id: user.id } },
    });
  } catch {
    return { error: "Não foi possível confirmar o cadastro. Atualize a lista e peça ao responsável técnico para verificar antes de tentar novamente." };
  }
  if (created.error || !created.data.user) {
    return { error: ["email_exists", "user_already_exists"].includes(created.error?.code ?? "")
      ? "Este email já possui um cadastro. Nenhum usuário existente foi alterado."
      : "Não foi possível confirmar o cadastro. Atualize a lista; se ele não aparecer, peça ao responsável técnico para verificar a configuração antes de repetir." };
  }

  let sent = false;
  try {
    const result = await admin.auth.admin.inviteUserByEmail(input.email, { redirectTo });
    sent = !result.error && result.data.user?.id === created.data.user.id;
  } catch { /* A timeout can occur after delivery: do not delete a usable account. */ }
  revalidatePath("/pastor/lideres");
  revalidatePath("/pastor");
  return sent
    ? { success: "Líder e célula cadastrados. Convite enviado; peça ao líder para verificar o email." }
    : { error: "Líder e célula foram cadastrados, mas não foi possível confirmar o envio do convite. Não cadastre novamente. Peça ao responsável técnico para verificar o envio no Supabase Auth." };
}
