import { BookOpenText, ClipboardList, GraduationCap, PlaySquare, type LucideIcon } from "lucide-react";

export interface ModuleInfo {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
  phase: number;
}

/** Dört ana modül — ana sayfa kartları ve "yakında" sayfaları bu listeyi kullanır. */
export const modules: ModuleInfo[] = [
  {
    href: "/konular",
    title: "Konu Anlatımı",
    description: "Her konu için seçilmiş YouTube anlatımları. İzlediklerini işaretle, ilerlemeni gör.",
    icon: PlaySquare,
    phase: 2,
  },
  {
    href: "/soru-bankasi",
    title: "Soru Bankası",
    description: "Konuya ve zorluğa göre filtrelenen sorular, çözümler ve yanlış defterin.",
    icon: BookOpenText,
    phase: 3,
  },
  {
    href: "/sinavlar",
    title: "Geçmiş Sınavlar",
    description: "Çıkmış sorularla süreli deneme. Net hesabı ve konu bazlı analiz.",
    icon: ClipboardList,
    phase: 4,
  },
  {
    href: "/tercih",
    title: "YKS Tercih",
    description: "Puanını hesapla, taban puan ve başarı sırasına göre programları keşfet, listeni oluştur.",
    icon: GraduationCap,
    phase: 5,
  },
];
