import { redirect } from "next/navigation";
import { AuthFlow } from "@/components/auth-flow";
import { serverApi } from "@/lib/api";
import { getSession } from "@/lib/session";

export const metadata = { title: "Giriş yap" };
// API durumu her istekte sorulur; yoksa derlemede (API kapalıyken) "ulaşılamadı" hâli sabitlenir.
export const dynamic = "force-dynamic";

/** Sayfa açılırken API'ye ulaşılabiliyor mu? Ulaşılamıyorsa kullanıcı e-postasını yazmadan önce uyarılır. */
async function isApiReachable(): Promise<boolean> {
  try {
    await serverApi.health({ cache: "no-store", signal: AbortSignal.timeout(2000) });
    return true;
  } catch {
    return false;
  }
}

export default async function LoginPage() {
  const apiReachable = await isApiReachable();
  if (apiReachable && (await getSession())) redirect("/");
  return <AuthFlow apiReachable={apiReachable} />;
}
