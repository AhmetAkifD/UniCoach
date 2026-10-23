import { BookOpenText, ClipboardList, GraduationCap, NotebookPen, PlaySquare, type LucideIcon } from "lucide-react-native";

export interface ModuleInfo {
  /** Sekme adı (src/app/(app) altındaki dosya); sekmesi olmayan modülde null */
  route: "konular" | "soru-bankasi" | "sinavlar" | "tercih" | null;
  title: string;
  description: string;
  icon: LucideIcon;
  /** Mobilde hazır mı? Değilse "Yakında" gösterilir (web'de çalışır). */
  ready: boolean;
}

/** Web'deki components/modules.ts ile aynı modüller ve açıklamalar. */
export const modules: ModuleInfo[] = [
  {
    route: "konular",
    title: "Konu Anlatımı",
    description: "Takip ettiğin YouTube videoları ve oynatma listeleri. Nerede kaldığını unutma.",
    icon: PlaySquare,
    ready: true,
  },
  {
    route: "soru-bankasi",
    title: "Soru Bankası",
    description: "Soru kitaplarının PDF'leri, derslerine ve konularına göre. Kaldığın sayfadan devam et.",
    icon: BookOpenText,
    ready: true,
  },
  {
    route: null,
    title: "Çalışma Alanı",
    description: "Videonu izlerken PDF'inden çalış, defterine kalemle ya da klavyeyle not al.",
    icon: NotebookPen,
    ready: false,
  },
  {
    route: "sinavlar",
    title: "Geçmiş Sınavlar",
    description: "Soru Bankası'ndan çıkardığın testlerle süreli deneme. Netini gör, yanlışlarını gözden geçir.",
    icon: ClipboardList,
    ready: true,
  },
  {
    route: "tercih",
    title: "YKS Tercih",
    description: "Puanını ekle, taban puan ve başarı sırasına göre programları keşfet, listeni oluştur.",
    icon: GraduationCap,
    ready: false,
  },
];
