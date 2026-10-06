import { requireProfile } from "@/lib/auth";
import { redirect } from "next/navigation";
export default async function Home() {
  const { profile } = await requireProfile();
  redirect(profile.role === "pastor" ? "/pastor" : "/lider");
}
