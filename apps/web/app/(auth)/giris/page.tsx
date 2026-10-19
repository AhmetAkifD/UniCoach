import { redirect } from "next/navigation";
import { AuthFlow } from "@/components/auth-flow";
import { getSession } from "@/lib/session";

export const metadata = { title: "Giriş yap" };

export default async function LoginPage() {
  if (await getSession()) redirect("/");
  return <AuthFlow />;
}
