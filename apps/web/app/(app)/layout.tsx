import { SiteHeader } from "@/components/site-header";
import { requireUser } from "@/lib/session";

// Oturum her istekte kontrol edilir.
export const dynamic = "force-dynamic";

/** Giriş gerektiren tüm sayfalar. Oturum yoksa /giris'e yönlendirilir. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto max-w-[1200px] px-4 py-8 md:px-8 md:py-10">{children}</main>
    </>
  );
}
