import { BookOpenText, ClipboardList, GraduationCap, PlaySquare, type LucideIcon } from "lucide-react";

export interface ModuleInfo {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
  phase: number;
  /** Kullanıma açık mı? Değilse kartta "Yakında" rozeti görünür. */
  ready?: boolean;
}

/** Dört ana modül — ana sayfa kartları ve "yakında" sayfaları bu listeyi kullanır. */
export const modules: ModuleInfo[] = [
  {
    href: "/konular",
    title: "Konu Anlatımı",
    description: "Takip ettiğin YouTube videoları ve oynatma listeleri. Nerede kaldığını unutma.",
    icon: PlaySquare,
    phase: 2,
    ready: true,
  },
  {
    href: "/soru-bankasi",
    title: "Soru Bankası",
    description: "Soru kitaplarının PDF'leri, derslerine ve konularına göre. Kaldığın sayfadan devam et.",
    icon: BookOpenText,
    phase: 3,
    ready: true,
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
