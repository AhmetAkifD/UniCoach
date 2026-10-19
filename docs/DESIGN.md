# UniCoach Tasarım Sistemi: "Modern & sakin"

> Bu belge, UniCoach'ın **web ve mobil** uygulamalarının ortak tasarım sözleşmesidir.
> Arayüzle ilgili her işten önce okunmalıdır. Kararlar burada değişir; kod bunu izler.
>
> **Token'ların tek kaynağı:** [`packages/design/src/tokens.ts`](../packages/design/src/tokens.ts)
> - Web: `npm run build -w @unicoach/design` komutu `dist/theme.css` dosyasını üretir, Tailwind sınıfları bu dosyadan gelir.
> - Mobil: `import { semantic, spacing, radius } from "@unicoach/design"` ile değerler doğrudan kullanılır.

Kabul tarihi: 2026-10-19

---

## 1. İlkeler

1. **Sakin ve odaklı.** Öğrenci uzun süre çalışacak. Bol beyaz alan, düşük kontrastlı yüzeyler kullan. Bir ekranda tek bir birincil eylem olsun.
2. **İlerleme görünür olsun.** Yüzdeler, ilerleme çubukları ve net değerleri ön planda olur. Öğrenci nerede olduğunu hep görür.
3. **İki platformda aynı his.** Web ve mobilde renk, yarıçap, tipografi ve bileşen davranışları aynıdır. Yalnızca gezinme düzeni platforma göre değişir (bkz. §7).
4. **Renk anlam taşır.** İndigo eylemi, yeşil doğruyu, kırmızı yanlışı, amber uyarı ya da boş bırakılanı, ders renkleri de dersi gösterir. Renk tek başına bilgi taşımaz; yanında ikon veya metin olur.

## 2. Renkler

Bileşenlerde **yalnızca anlamsal (semantic) renkler** kullanılır, ham palet kullanılmaz. Koyu tema bu değişkenlerin değeriyle otomatik gelir.

| Token | Tailwind sınıfı | Açık | Koyu | Kullanım |
|---|---|---|---|---|
| `bg` | `bg-bg` | `#F8FAFC` | `#0B1020` | Sayfa zemini |
| `surface` | `bg-surface` | `#FFFFFF` | `#121831` | Kart, modal, header |
| `surfaceMuted` | `bg-surface-muted` | `#F1F5F9` | `#1A2140` | İkincil alan, input zemini, iz (track) |
| `border` | `border-border` | `#E2E8F0` | `#263056` | Kart/ayraç çizgisi |
| `borderStrong` | `border-border-strong` | `#CBD5E1` | `#475569` | Input kenarı, hover |
| `text` | `text-text` | `#0F172A` | `#E2E8F0` | Ana metin |
| `textMuted` | `text-text-muted` | `#64748B` | `#94A3B8` | Açıklama, etiket |
| `textSubtle` | `text-text-subtle` | `#94A3B8` | `#64748B` | Yer tutucu, pasif |
| `primary` | `bg-primary` / `text-primary` | `#4F46E5` | `#818CF8` | Birincil buton, link, aktif sekme |
| `primaryHover` | `bg-primary-hover` | `#4338CA` | `#A5B4FC` | Hover/pressed |
| `primarySoft` | `bg-primary-soft` | `#EEF2FF` | `#1E1B4B` | Seçili öğe zemini, ikincil buton |
| `primarySoftText` | `text-primary-soft-text` | `#4338CA` | `#C7D2FE` | `primarySoft` üzerindeki metin |
| `onPrimary` | `text-on-primary` | `#FFFFFF` | `#0B1020` | `primary` üzerindeki metin |
| `accent` / `accentSoft` | `bg-accent` | `#8B5CF6` | `#A78BFA` | Vurgu, rozet, grafik ikinci seri |
| `focusRing` | `ring-focus-ring` | `#A5B4FC` | `#6366F1` | Klavye odağı |
| `success` / `successSoft` | `text-success` | `#15803D` | `#22C55E` | Doğru cevap, tamamlandı |
| `warning` / `warningSoft` | `text-warning` | `#B45309` | `#F59E0B` | Boş bırakılan, süre azaldı |
| `danger` / `dangerSoft` | `text-danger` | `#DC2626` | `#EF4444` | Yanlış cevap, hata, silme |
| `info` / `infoSoft` | `text-info` | `#0369A1` | `#0EA5E9` | Bilgi notu |

**Ders renkleri** (`bg-subject-matematik`, `subjectColors.matematik` …): matematik `#6366F1`, geometri `#8B5CF6`, fizik `#0EA5E9`, kimya `#10B981`, biyoloji `#84CC16`, türkçe `#F43F5E`, edebiyat `#EC4899`, tarih `#F59E0B`, coğrafya `#14B8A6`, felsefe `#A855F7`, din `#06B6D4`, ingilizce `#3B82F6`, fen `#22C55E`, inkılap `#EA580C`. Bu renkler kartın sol şeridinde, ikon arka planında (%12 opaklık) ve grafiklerde kullanılır; uzun metin rengi olarak kullanılmaz.

## 3. Tipografi

- **Yazı tipi:** Inter (web: `next/font/google`, mobil: `@expo-google-fonts/inter`). Sayısal veri (net, puan, süre) için `tabular-nums` kullanılır.
- **Ölçek** (px, boyut/satır):

| Ad | Boyut | Kullanım |
|---|---|---|
| `xs` | 12/16 | Rozet, yardımcı etiket |
| `sm` | 14/20 | Açıklama, tablo, ikincil metin |
| `base` | 16/24 | Gövde metni, buton |
| `lg` | 18/28 | Kart başlığı |
| `xl` | 20/28 | Bölüm başlığı |
| `2xl` | 24/32 | Sayfa başlığı (mobil) |
| `3xl` | 30/36 | Sayfa başlığı (web) |
| `4xl` | 36/40 | Büyük istatistik (net, puan) |

- **Ağırlıklar:** 400 gövde · 500 etiket/buton · 600 başlık · 700 yalnızca büyük sayılar.
- Başlıklarda `tracking-tight`. Tüm metinler Türkçe, büyük harf dönüşümü `tr` yereliyle yapılır.

## 4. Boşluk, yarıçap, gölge

- **Boşluk:** 4px tabanlı (`spacing` = Tailwind ölçeği). Kart iç boşluğu **20px** (`p-5`), kartlar arası **16px** (`gap-4`), bölümler arası **32px** (`gap-8`). Sayfa kenar boşluğu mobilde 16px, masaüstünde 32px.
- **Yarıçap:**

| Token | px | Kullanım |
|---|---|---|
| `sm` | 8 | Küçük öğe, checkbox, tooltip |
| `md` | 12 | Buton, input, şık (A/B/C…) |
| `lg` | 16 | **Kart**, modal, panel |
| `xl` | 24 | Büyük hero kartı, alt sayfa (bottom sheet) |
| `full` | — | Çip, rozet, avatar, ilerleme çubuğu |

- **Gölge:** `shadow-card` (varsayılan kart, mobilde `elevation: 2`), `shadow-raised` (hover, açılır menü, modal; mobilde `elevation: 6`). Koyu temada gölge yerine `border` öne çıkar.
- **Hareket:** 150ms (hover/basma), 250ms (açılma), `cubic-bezier(0.2, 0, 0, 1)`. `prefers-reduced-motion` açıksa animasyon kapatılır.

## 5. Bileşenler

Her bileşenin web (`apps/web/components/ui`) ve mobil (`apps/mobile/components/ui`) karşılığı **aynı ad ve aynı prop'larla** yazılır.

| Bileşen | Varyantlar / Prop'lar | Kurallar |
|---|---|---|
| **Button** | `variant`: `primary` · `secondary` (primarySoft zemin) · `ghost` · `danger`; `size`: `sm` (36px) · `md` (44px) · `lg` (52px) | Yarıçap `md`, ağırlık 500. Ekranda tek `primary` olur. Yükleniyorsa spinner gösterilir ve buton devre dışı kalır. |
| **Card** | `as`, `interactive` | `bg-surface`, `border-border`, `rounded-lg`, `shadow-card`, `p-5`. `interactive` ise hover'da `shadow-raised` ve 1px yukarı kalkar. |
| **Badge** | `tone`: `neutral` · `primary` · `success` · `warning` · `danger` · `info` | `rounded-full`, `text-xs`, `px-2.5 py-0.5`, soft zemin ve koyu metin. |
| **ProgressBar** | `value` (0-100), `tone`, `size` | İz `surface-muted`, dolgu `primary` (veya ders rengi), `rounded-full`, yükseklik 8px. Yanında yüzde metni olur. |
| **StatCard** | `label`, `value`, `hint`, `icon` | Büyük sayı `text-4xl font-bold tabular-nums`. Net ve puan gösterimi için kullanılır. |
| **Input / Select** | `label`, `error`, `hint` | Yükseklik 44px, `rounded-md`, `bg-surface`, `border-border-strong`. Odakta `ring-2 ring-focus-ring`. Etiket her zaman üstte olur. |
| **OptionButton** (soru şıkkı) | `letter`, `state`: `idle` · `selected` · `correct` · `wrong` | Sol tarafta harf dairesi olur. `selected` → primarySoft, `correct` → successSoft ve ✓, `wrong` → dangerSoft ve ✕. |
| **VideoCard** | `title`, `channel`, `duration`, `watched` | 16:9 küçük resim `rounded-md`. İzlenenlerde köşede ✓ rozeti bulunur. |
| **EmptyState** | `icon`, `title`, `action` | Ortalanmış, ikon `text-text-subtle`, en fazla tek buton. |

**İkonlar:** [Lucide](https://lucide.dev) kullanılır (web: `lucide-react`, mobil: `lucide-react-native`). Çizgi kalınlığı 1.75, boyut 20px (metin içinde 16px).

## 6. Koyu tema

- Varsayılan olarak sistem tercihi izlenir. Kullanıcı header'daki ◐ düğmesiyle `açık / koyu` seçebilir (`<html data-theme="…">`, web'de `localStorage`, mobilde `AsyncStorage`).
- Bileşenler `dark:` varyantına neredeyse hiç ihtiyaç duymaz, çünkü anlamsal renkler kendiliğinden değişir. `dark:` yalnızca istisnalarda kullanılır.

## 7. Düzen (platforma göre)

| | Web | Mobil |
|---|---|---|
| Gezinme | Üstte sabit header (64px): logo, ana menü, tema düğmesi, profil | Altta sekme çubuğu: **Ana Sayfa · Konular · Soru Bankası · Sınavlar · Tercih** |
| İçerik | Ortalanmış, en fazla 1200px. Izgara: 1 → 2 (md) → 3/4 (lg) sütun | Tek sütun, kenar boşluğu 16px |
| Ana sayfa | Selamlama, ilerleme kartları ızgarası, "Soru Çöz" birincil butonu | Aynı içerik, dikey akış |
| Sınav ekranı | Solda soru, sağda soru haritası ve süre | Soru tam ekran, alttan açılan soru haritası |

## 8. Ses ve dil

- Arayüz **Türkçe** ve **"sen"** diliyle yazılır: samimi, kısa ve cesaretlendirici. Örnekler: "Merhaba Ahmet 👋", "Harika gidiyorsun!", "Bu konuya biraz daha çalışalım".
- Sınav terimleri standart haliyle kullanılır: *net, deneme, TYT, AYT, LGS, taban puan, başarı sırası, OBP*.
- Emoji yalnızca selamlama ve kutlamada kullanılır; buton ve başlıklarda kullanılmaz.

## 9. Erişilebilirlik

- Metin/zemin kontrastı en az WCAG AA (4.5:1) olur. `textSubtle` yalnızca yer tutucu ve pasif öğede kullanılır.
- Dokunma alanı en az 44×44px olur.
- Her etkileşimli öğenin görünür bir klavye odağı vardır (`focus-visible:ring-2 ring-focus-ring ring-offset-2`).
- Durum yalnızca renkle değil, ikon ve metinle de bildirilir (doğru ✓, yanlış ✕).

## 10. Yapılmayacaklar

- Ham hex değeri veya Tailwind'in ham paleti (`bg-indigo-600`) bileşen içinde kullanılmaz; anlamsal token kullanılır.
- Bir ekranda birden fazla birincil buton olmaz.
- Doygun, tam renkli büyük zeminler kullanılmaz (hero dahil). Vurgu küçük alanlarda kalır.
- Web ve mobilde aynı bileşen farklı yarıçap, renk veya boyutla yazılmaz.

---

Önizleme: web uygulamasında **`/tasarim`** sayfası tüm token'ları ve bileşenleri canlı gösterir.
