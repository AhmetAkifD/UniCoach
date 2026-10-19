import { redirect } from "next/navigation";

// Kayıt artık giriş akışının bir adımı (e-posta kayıtlı değilse açılır). Eski bağlantılar için yönlendirme.
export default function RegisterPage() {
  redirect("/giris");
}
