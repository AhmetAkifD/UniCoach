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

**Koyu tema nötr koyu gridir** (2026-10-19 kararı): zemin, yüzey ve kenarlar renk tonu taşımaz. Renk yalnızca vurgu öğelerinde (birincil buton, link, durum renkleri) görünür; `primarySoft`/`accentSoft` bile gri ağırlıklıdır.

| Token | Tailwind sınıfı | Açık | Koyu | Kullanım |
|---|---|---|---|---|
| `bg` | `bg-bg` | `#F8FAFC` | `#121212` | Sayfa zemini |
| `surface` | `bg-surface` | `#FFFFFF` | `#1A1A1A` | Kart, modal, header |
| `surfaceMuted` | `bg-surface-muted` | `#F1F5F9` | `#242424` | İkincil alan, input zemini, iz (track) |
| `border` | `border-border` | `#E2E8F0` | `#2E2E2E` | Kart/ayraç çizgisi |
| `borderStrong` | `border-border-strong` | `#CBD5E1` | `#3D3D3D` | Input kenarı, hover |
| `text` | `text-text` | `#0F172A` | `#EDEDED` | Ana metin |
| `textMuted` | `text-text-muted` | `#64748B` | `#A3A3A3` | Açıklama, etiket |
| `textSubtle` | `text-text-subtle` | `#94A3B8` | `#737373` | Yer tutucu, pasif |
| `primary` | `bg-primary` / `text-primary` | `#4F46E5` | `#818CF8` | Birincil buton, link, aktif sekme |
| `primaryHover` | `bg-primary-hover` | `#4338CA` | `#A5B4FC` | Hover/pressed |
| `primarySoft` | `bg-primary-soft` | `#EEF2FF` | `#262633` | Seçili öğe zemini, ikincil buton |
| `primarySoftText` | `text-primary-soft-text` | `#4338CA` | `#C7D2FE` | `primarySoft` üzerindeki metin |
| `onPrimary` | `text-on-primary` | `#FFFFFF` | `#121212` | `primary` üzerindeki metin |
| `accent` / `accentSoft` | `bg-accent` | `#8B5CF6` | `#A78BFA` | Vurgu, rozet, grafik ikinci seri |
| `focusRing` | `ring-focus-ring` | `#A5B4FC` | `#6366F1` | Klavye odağı |
| `success` / `successSoft` | `text-success` | `#15803D` | `#4ADE80` | Doğru cevap, tamamlandı |
| `warning` / `warningSoft` | `text-warning` | `#B45309` | `#FBBF24` | Boş bırakılan, süre azaldı |
| `danger` / `dangerSoft` | `text-danger` | `#B91C1C` | `#F87171` | Yanlış cevap, hata, silme |
| `info` / `infoSoft` | `text-info` | `#0369A1` | `#38BDF8` | Bilgi notu |

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
| **Card** | `as`, `interactive` | `bg-surface`, `border-border`, `rounded-lg`, `shadow-card`, `p-5` (`className` içinde `p-0` verilirse iç boşluk hiç eklenmez; tablo ve bölmeli kartlar için). `interactive` ise hover'da `shadow-raised` ve 1px yukarı kalkar. |
| **Badge** | `tone`: `neutral` · `primary` · `success` · `warning` · `danger` · `info` | `rounded-full`, `text-xs`, `px-2.5 py-0.5`, soft zemin ve koyu metin. |
| **ProgressBar** | `value` (0-100), `tone`, `size` | İz `surface-muted`, dolgu `primary` (veya ders rengi), `rounded-full`, yükseklik 8px. Yanında yüzde metni olur. |
| **StatCard** | `label`, `value`, `hint`, `icon` | Büyük sayı `text-4xl font-bold tabular-nums`. Net ve puan gösterimi için kullanılır. |
| **Input / Select** | `label?`, `error`, `hint` | Yükseklik 44px, `rounded-md`, `bg-surface`, `border-border-strong`. Odakta `ring-2 ring-focus-ring`. Giriş/kayıt formlarında **etiket yoktur**, alanın adı placeholder'dadır (ekran okuyucu için `aria-label` olarak da verilir). Uzun formlarda etiket üstte kullanılabilir. Hata mesajı alanın altında görünür. |
| **PasswordChecklist** | `password` | Yalnızca şifre alanı odaktayken ve boş değilken alanın altında görünür. Kurallar `PASSWORD_RULES` (packages/shared): 6–16 karakter, 1 büyük harf, 1 rakam. Karşılanan kural `success` rengi ve ✓, karşılanmayan `textMuted` ve ✕. |
| **OptionButton** (soru şıkkı) | `letter`, `state`: `idle` · `selected` · `correct` · `wrong` | Sol tarafta harf dairesi olur. `selected` → primarySoft, `correct` → successSoft ve ✓, `wrong` → dangerSoft ve ✕. |
| **SourceCard** (Konu Anlatımı kaynak grubu) | `source`, `color` | 16:9 küçük resim kartın üstünde, sağ altta "N video" etiketi; altında ad (en fazla 2 satır), kanal, ders rengiyle ilerleme çubuğu ve "x/y izlendi". Hepsi izlendiyse sol üstte "Bitti" rozeti. |
| **UserAvatar** | `user`, `className` | Profil fotoğrafı (yuvarlak, `object-cover`); yoksa `primarySoft` daire içinde ad-soyad baş harfleri. Boyut ve yazı büyüklüğü `className` ile (üst bar 36px, profil 80px). |
| **ToolButton / ToolGroup** | `label`, `onClick`, `active`, `disabled` | 36px yalnızca ikonlu araç düğmesi (`textMuted`, hover `surfaceMuted`, seçili `primarySoft`); etiket ipucu ve ekran okuyucu adıdır. ToolGroup ilişkili düğmeleri ince `border` çizgisiyle ayırır. PDF görüntüleyici ve not defteri araç çubukları. |
| **BookCard** (Soru Bankası PDF'i) | `book`, `color`, `showTopic` | Solda ders rengiyle (%16 karışım zemin) 44px dosya ikonu; yanında ad (en fazla 2 satır) ve konu rozeti (konu başlıkları gösteriliyorsa gizlenir). Altta ders rengiyle ilerleme çubuğu, "Sayfa x/y" (henüz açılmadıysa "Henüz açılmadı") ve sağda dosya boyutu ("150 MB"). |
| **PDF görüntüleyici** | `book` | pdf.js; sayfalar beyaz zemin + `rounded-md shadow-card`, aralarında 12px boşluk. Header'ın altına yapışık araç çubuğu: önceki · sayfa kutusu ("5 / 40", sayı yazıp Enter) · sonraki; sağda üç grup (aralarında ince çizgi): **akış** (aşağı kaydırarak / sayfa sayfa) · **düzen** (tek sayfa / yan yana iki sayfa, yan yanayken "kapak ayrı" düğmesi: açıkken 1 tek başına sağda, sonra 2–3, 4–5…; kapalıyken 1–2, 3–4…) · **yakınlaştırma** (− · yüzde · + (%50–%300, genişliğe göre) · genişliğe sığdır · sayfaya sığdır). Kaydırma görünümünde yalnızca ekrana yakın sayfalar çizilir, diğerleri aynı boyutta beyaz yer tutucudur; geçerli sayfa ekranın ortasındaki sayfadır. Kısayollar ← → (ve PageUp/PageDown) bir sonraki sayfaya/çifte geçer. Akış ve düzen tarayıcıda, kapak ayarı kitap başına hatırlanır. Kalınan sayfa kaydedilir, açılışta oradan devam edilir. Başlıkta ilerleme çubuğu yoktur. |
| **Video satırı** (oynatıcı yanındaki liste) | `item`, `active` | Sıra no · başlık (2 satır) · süre ya da "kalınan / süre"; sağda yuvarlak ✓ düğmesi (izlendi: `success` dolgu). Çalan satır `primarySoft` zemin ve ▶ ikonu. |
| **VideoControls** (sade oynatıcı) | `playing`, `fullscreen`, `hasPrev/hasNext` | YouTube oynatıcısı `controls=0` ile, kontroller videonun **altında** `bg-surface` şeritte (YouTube politikası oynatıcının üstüne öğe koymayı yasaklar). Üstte 4px ilerleme çubuğu (hover'da 6px, `primary` dolgu, tamponlanan kısım `borderStrong`, tutamaç yalnızca hover/sürüklemede). Altında: önceki · oynat/duraklat · sonraki · −10 · +10 · süre; sağda ses (düğme + 80px kaydırıcı, mobilde yalnızca düğme) · hız (0.5×–2×; YouTube 2× üstünü desteklemez) · tam ekran. Hız ve ses tarayıcıda hatırlanır. Kısayollar yalnızca Boşluk ve F. Tarayıcı tam ekrana izin vermezse (iPhone Safari, uygulama içi tarayıcılar) "pencere içi tam ekran"a geçilir (sayfayı kaplar, Esc/F ile çıkılır). **Tam ekranda istisna:** video tüm alanı kaplar, panel videonun **üstünde** alttan koyu geçişle (`from-black/85`, beyaz metin; video hep koyu olduğu için ham beyaz/siyah kullanılır) durur; fare hareketinde görünür, oynarken 2,5 sn hareketsizlikte imleçle birlikte kaybolur, duraklatılmışken ya da üzerindeyken açık kalır. Videoya tıklama oynat/duraklat, çift tıklama tam ekran. Bu, YouTube'un "gömülü oynatıcının üstüne öğe koyma" yasağına **bilinçli olarak** aykırıdır (kullanıcı kararı, 2026-10-20); normal görünümde kontroller videonun altında kalır. |
| **FilterChip** (filtre satırı) | `label`, `count`, `active` | `h-8`, `rounded-full`, kenarlıklı; seçili çip `border-primary` + `primarySoft` zemin. Etiketten sonra küçük sayı (`text-xs`, `textSubtle`). Satırın solunda 48px genişlikte satır adı ("Sınav", "Ders"); çipler alt satıra kendi sütunlarında sarılır. Her satırın ilk çipi "Tümü". Seçim URL'de tutulur. |
| **SegmentedControl** | `label`, `options`, `value`, `error` | `surface-muted` zeminli tek satır düğme grubu; seçili seçenek `bg-surface` + `shadow-card`. Ekran okuyucuda radyo grubu. YKS/LGS seçimi gibi 2–4 seçenek için. |
| **Dialog** | — | Yerel `<dialog>` + `showModal()`; `rounded-xl`, `shadow-raised`, arka plan `black/50`. Açılınca odak ilk giriş alanına verilir. İşlem sürerken kapatılamaz. Onay/soru için tarayıcının `confirm`/`prompt`/`alert` kutuları **kullanılmaz** (uygulama içi tarayıcılar göstermeyip "iptal" sayabiliyor); yerine `useDialog()` (`components/ui/use-dialog.tsx`): başlık, açıklama, "Vazgeç" + onay düğmesi (silmede `danger`). |
| **EmptyState** | `icon`, `title`, `action` | Ortalanmış, ikon `text-text-subtle`, en fazla tek buton. |

**İkonlar:** [Lucide](https://lucide.dev) kullanılır (web: `lucide-react`, mobil: `lucide-react-native`). Çizgi kalınlığı 1.75, boyut 20px (metin içinde 16px).

## 6. Koyu tema

- Varsayılan olarak sistem tercihi izlenir. Kullanıcı header'daki ◐ düğmesiyle `açık / koyu` seçebilir (`<html data-theme="…">`, web'de `localStorage`, mobilde `AsyncStorage`).
- Bileşenler `dark:` varyantına neredeyse hiç ihtiyaç duymaz, çünkü anlamsal renkler kendiliğinden değişir. `dark:` yalnızca istisnalarda kullanılır.

## 7. Düzen (platforma göre)

| | Web | Mobil |
|---|---|---|
| Gezinme | Üstte sabit header (64px): **logo ikonu = menü düğmesi** (üzerine gelince ikon üç çizgiye döner, tıklayınca modüller açılır menüde listelenir), "UniCoach" yazısı (ana sayfa), **arama çubuğu** (şimdilik pasif), sağda profil (fotoğraf ya da baş harfler, geniş ekranda ad) ve çıkış; tema düğmesi yok — tema profilden seçilir (giriş/kayıt ekranlarında hızlı tema düğmesi var) | Altta sekme çubuğu: **Ana Sayfa · Konular · Soru Bankası · Sınavlar · Tercih** (etkin `primary`, diğerleri `textMuted`); üstte `surface` başlık çubuğu (ekran adı, ana sayfada "UniCoach"), sağda 34px profil fotoğrafı/baş harfler → Profil sekmelerin üstüne açılır (geri oku). Mobilde henüz olmayan modül sekmesi: ikon, `primary` "Mobilde yakında" rozeti, açıklama ve "web sitesinden kullanabilirsin" notu. Onay ve şifre pencereleri uygulama içi modal (Alert yerine). |
| İçerik | Ortalanmış, en fazla 1200px. Izgara: 1 → 2 (md) → 3/4 (lg) sütun | Tek sütun, kenar boşluğu 16px |
| Ana sayfa | Selamlama, ilerleme kartları ızgarası, "Soru Çöz" birincil butonu | Aynı içerik, dikey akış |
| Sınav ekranı | Solda soru, sağda soru haritası ve süre | Soru tam ekran, alttan açılan soru haritası |
| Giriş akışı | Ekranın sağına yapışık, tam yükseklikte panel (`max-w-md`, `bg-surface`, sol kenarda `border`); logo ekranın sol üstünde. Adımlar: e-posta → şifre **veya** kayıt (Ad, Soyad, Şifre, YKS/LGS) → şifre. Başlık: "UniCoach'a giriş yap" / "Hesabını oluştur". | Tam ekran, aynı adımlar |
| Soru Bankası | Konu Anlatımı ile aynı iki filtre satırı ve ders başlıkları; ders içinde konu etiketine göre alt başlıklar (konusuzlar "Konu belirtilmemiş" altında, en sonda). Sağ üstte "PDF yükle": dosya seçilince (ya da sürüklenince) adı ve boyutu gösterilir, yüklerken "52,3 MB / 150 MB · %35". Detayda başlık, ilerleme ve ayarlar (ders, konu, indir, sil); altında PDF görüntüleyici. | Aynı, tek sütun. "PDF yükle" sekmelerin üstüne açılan ekrandır: kesik kenarlı dosya seçme kutusu (seçilince ad ve boyut), ad, ders (alttan açılan liste), konu (önceki konular kutunun altında çip olarak önerilir); yüklerken ilerleme çubuğu, "x MB / y MB" ve "İptal et". Görüntüleyici sekmelerin üstüne açılır: başlıkta PDF adı ve sağda ⓘ (alttan açılan "PDF bilgileri": ders, konu, sayfa, boyut, çıkarılan soru, "soru çıkarma web'de" notu, ders/konu düzenleme, ad değiştirme, silme); sayfalar `surfaceMuted` zeminde ekran genişliğinde alt alta, kıstırarak yakınlaştırılır; altta `surface` şerit: ‹ · "Sayfa x / y" (dokununca sayfaya git) · ›. |
| Profil | Ortada en fazla 672px tek sütun. Üst kart: ad-soyad (büyük), e-posta, "Ekim 2026 tarihinden beri üye" (`textSubtle`), sağda rol rozeti; altında 80px UserAvatar ile "Fotoğraf yükle / Fotoğrafı değiştir" (secondary) ve "Kaldır" (ghost), not "Resmin ortasından kare olarak kırpılır". **Hesap** başlığı altında iki kart: Ad ve soyad (iki sütun Input, değişince etkin "Kaydet", yanında `success` "Kaydedildi"), Şifre (şu anki şifre; yeni şifre + tekrarı iki sütun; yazılınca PasswordChecklist; "Şifreyi değiştir"). **Tercihler** kartı: Tema SegmentedControl (Sistem "Cihazının ayarı" / Açık / Koyu — seçilince hemen uygulanır ve kaydedilir), ince çizgiyle ayrılmış sınav seçimi. **Hesabı sil**: `danger`/40 kenarlı kutu, açıklama ve `danger` "Hesabımı sil"; önce onay penceresi (silinecekler listelenir), sonra şifre soran pencere (password girdisi, `danger` onay). | Aynı, iki sütunlu alanlar tek sütun |
| Çalışma Alanı | Sayfa geniş düzen kullanır (`data-wide` → `main` en fazla 1680px). Kısa başlık, sağında "Düzeni sıfırla" (ghost) ve "Tam ekran" (secondary, `Maximize2`); altında ekran yüksekliğine sabitlenmiş iki sütun; sütunlar arasında ve video ile defter arasında 10px tutamak (ortada 48×4px `borderStrong` yuvarlak çizgi, üstüne gelince/sürüklerken `primary`; `col-resize`/`row-resize` imleci; sürüklerken iframe ve tuval fareyi yutmasın diye sayfayı şeffaf bir katman kaplar): solda üstte **video** kartı (başlıkta ders gruplu video seçimi, Konu Anlatımı'nda aç, gizle/göster; oynatıcı Konu Anlatımı'nınkiyle aynı, kenarlıksız; video alanı bölmenin kalan yüksekliğini doldurur, kontrol şeridi tam genişlikte; video gizlenince bölme yalnızca başlık kadar kalır; listede birden çok video varsa altında seçim) ve altında kalan yüksekliği dolduran **not defteri** kartı; sağda tam boy **PDF** kartı (ders gruplu PDF seçimi; görüntüleyici Soru Bankası'nınkiyle aynı ama kendi kutusunda kayar, `surfaceMuted` zemin). Not defteri: üst satırda defter seçimi, yeni defter / ad değiştir / sil ve sağda kayıt durumu ("Kaydedildi", "Kaydediliyor…", hata `danger` "Tekrar dene"); araç satırında kalem, marker, silgi, metin; seçili aracın renkleri (kalem: siyah, mavi, kırmızı, yeşil; marker: sarı, yeşil, pembe, mavi — mürekkep renkleri temadan bağımsız, sayfa her temada beyaz çizgili kâğıttır), kalem kalınlığı ya da yazı boyutu, geri al/yinele ve sağda sayfa gezinme (‹ 2 / 5 ›, sayfa ekle, sayfa sil). Sayfa A4 oranında, sütun genişliğine sığar, kutusunda kayar; marker çizgileri yarı saydam ve kalem yazısının altında kalır; metin kutusu tıklanan yerde açılır (`primary` çerçeve), boş bırakılırsa kaybolur. Seçimler ve bölme boyutları tarayıcıda hatırlanır. **Tam ekran:** tarayıcı tam ekrana geçer, çalışma alanı 6px kenar boşluğuyla bütün ekranı kaplar, başlık satırı ve site başlığı gizlenir; fare ekranın üst kenarına gelince site başlığı `shadow-raised` ile yüzerek iner, uzaklaşınca geri çekilir; PDF başlığının sağında `Minimize2` çıkış düğmesi, Esc de çıkarır. | Tek sütun: video, defter (80dvh), PDF (85dvh) alt alta |
| Geçmiş Sınavlar | Liste: başlık + "Yeni sınav"; "Devam eden" (primary "Devam ediyor" ya da duraklatılmışsa `warning` "Duraklatıldı" rozeti, cevaplanan sayısı ve kalan süre) ve "Sonuçlar" kart ızgarası (sağ üstte büyük net, altta D (`success`) / Y (`danger`) / B (`textMuted`) ve tarih). Yeni sınav: solda 1. PDF (radyo kartları, ders rengi nokta) ve 2. Testler (onay kutuları, soru sayıları); sağda yapışık 3. Süre kartı (dakika, önerilen süre, "Süresiz çöz", toplam soru, net kuralı, "Sınavı başlat"). Sınav ekranı: header'ın altına yapışık şerit (başlık, "x/y cevaplandı", sayaç rozeti — `primarySoft`, son 5 dk `dangerSoft`, duraklatılmışken `warningSoft` ve duraklat simgesi —, "Duraklat/Devam" (secondary), "+ Süre" (ghost, dakika soran pencere) ve "Bitir"); sınav sayfasından çıkılınca süre kendiliğinden duraklar; duraklatılmışken soru gizlenir, yerinde "Sınav duraklatıldı" kutusu ve "Devam et" durur; soru başlığında "Kaynağında düzenle". Düzenleyiciye sınavdan gelinince en üstte `warningSoft` şerit: açıklama, "Sınava dön" (ghost) ve "Kaydet ve sınava dön"; solda soru kartı (soru görseli `ring-1 ring-border`, 48px yuvarlak A–E düğmeleri (seçili `primary` dolgu) ve aynı sırada "Boş" seçeneği (cevap yokken `surfaceMuted` ile seçili görünür; Backspace de boşaltır), Önceki/Sonraki; bakılan soru sekmede hatırlanır (düzenleyiciden dönüşte ve yenilemede aynı soru); ekran en az 1024×640 ise sınav ekranı **kaydırmasızdır** (yükseklik ekrana sabitlenir, soru görseli kalan alana sığacak kadar küçülür, soru haritası kendi içinde kayar), daha küçük ekranlarda sayfa normal kaydırılır. Soru görselinin üzerine fareyle gelince imlecin olduğu yer yakınlaşır (`cursor-zoom-in`, varsayılan 2×), tekerlek yakınlığı 1,25×–5× arasında değiştirir (sayfa kaymaz; son yakınlık sorular arasında korunur); görsel yakınlıkta da net olsun diye yüksek çözünürlükte çizilir. Sonuç sayfasında yakınlaştırma yoktur (sayfa normal kaysın)); sağda 300px soru haritası (cevaplanan `primary` dolgu, geçerli soru halka). Kısayollar A–E, ← →. Sonuç: dört StatCard (Net, Doğru, Yanlış, Boş), birden fazla test varsa test tablosu, filtre çipleri (Tümü/Yanlışlar/Boşlar/Doğrular) ve soru kartları (durum rozeti, senin cevabın/doğru cevap, "Kaynağında düzenle"). | Tek sütun; soru haritası sorunun altında |
| YKS Tercih | Başlık ve açıklama; her kayıtlı yıl için "2022 YKS sonucun" başlığı, kaynak rozeti (`success` "Belgeden okundu" / `neutral` "Elle girildi"), güncellenme tarihi, "Düzenle" ve "Sil" (ghost; Düzenle tabloların yerine formu açar). Puan türü adlarının yanında `textMuted` parantez içinde ÖSYM belgesindeki satır adı yazar (tabloda "Sayısal (SAY / Y-SAY)", formun zorunlu kısmında "(Y-SAY)", ham puan kısmında "(SAY)"), puan ve sıra sütunları karışmasın diye. Altında puan tablosu (puan türü, puan ve başarı sırası `textMuted`; yerleştirme puanı ve sırası kalın — tercihte kullanılan bunlar; ek puanlı sütunlar yalnızca değer varsa), yanında OBP/diploma notu kartı ve oturum başlıklı (`surfaceMuted` satır, oturum neti) net tablosu (girilmeyen testler gizlenir). En altta "Sonucunu ekle" başlığı ve sağında SegmentedControl ("Sonuç belgesinden" / "Elle gir"). Elle giriş formu: "Yerleştirme puanların" kartı (sağ üstte yıl seçimi, puan türü başına yerleştirme puanı + başarı sırası, sağa yaslı rakamlı girişler; zorunlu tek kısım) ve açılır "Diğer bilgiler" kartı (ham puan/sıra, ek puanlı puan/sıra, OBP, diploma notu, oturum başına test doğru/yanlış ve anlık net); hatalı alan `danger` çerçeve ve altında kısa not. Belge kartı: kesikli çerçeveli dosya seçme/sürükleme alanı, gizlilik notu (kalkan ikonu: belge tarayıcıda okunur, kimlik bilgisi gönderilmez); okununca `info` "Önizleme" rozetli aynı tablolar, ad hesaptakiyle eşleşmezse `warningSoft` uyarı, "Vazgeç" / "Sonucu kaydet". | Tek sütun; tablolar yatay kayar |
| Programlar (YKS Tercih) | Geri bağlantısı, başlık. Filtre kartı: üstte "Veri kaynağı" SegmentedControl ("İndirilmiş veri" + indirme tarihi / "Canlı" + "YÖK Atlas'tan şimdi") ve sağda indirilen yıl/program sayısı, admin için "Veriyi güncelle" (secondary, indirirken yükleniyor); 4 sütunlu ızgarada puan türü, program, üniversite, şehir (aranabilir MultiSelect: seçilenler `primarySoft` çip), üniversite türü, burs, öğretim türü, düzey; altta başarı sırası aralığı, "Sırama yakın olanlar" ve "Filtreleri sıfırla"; öğrencinin sırası ve yıl farkı notu `textSubtle`. Filtrelerle sonuçlar arasında "Puanların ve sıraların": sağda "2022 YKS sonucun · düzenle" bağlantısı, puan türü başına kart (etiket ve "(Y-SAY)" `textMuted`, büyük yerleştirme puanı, "Sıra 148.718"); karta tıklamak o puan türüne süzer, seçili kart `primary` çerçeve + halka; sonuç yoksa "Sonucunu ekle" bağlantılı kart. Sonuç tablosu: program (ad, üniversite, alt satırda fakülte · şehir · tür · burs · puan türü · kod; karşılaştırma rozeti `success` "Sıran yetiyor" / `warning` "Sınırda" / `danger` "Sıran gerisinde" ya da "Sıra şartını sağlamıyor"), kontenjan ve "Yıllara göre taban puan · başarı sırası" (ProgramYears: her yıl bir satır — yıl, puan, kalın sıra; öğrencinin sonuç yılına en yakın, karşılaştırmada kullanılan yıl `primarySoft` satır; rozet de yılı yazar: "Sıran yetiyor (2023)"); sayfalama "1–25 / 909", Önceki/Sonraki. | Tablo yatay kayar; filtreler tek sütun |
| Tercih listem | Geri bağlantısı, başlık ve açıklama (karşılaştırmanın hangi yılın sonucuna göre olduğu). Üstte büyük "4 / 24 tercih", uyarılı tercih varsa `warning` rozet, sağda "Program ekle" (secondary). Sonuç yoksa `infoSoft` not. Her tercih bir kart: solda 40px `primarySoft` daire içinde sıra numarası; program adı, üniversite, alt satırda fakülte · şehir · tür · burs · puan türü · kod; kontenjan ve karşılaştırma rozeti (karşılaştırılan yılla), altında ProgramYears tablosu; altında uyarılar (koşul/puan uyumsuzluğu `dangerSoft`, sınırda/gerisinde `warningSoft`, üçgen ikon). Sağda dikey ghost düğmeler: yukarı, aşağı, listeden çıkar (`danger` ikon). Boş liste: ikonlu boş durum ve "Programları keşfet". Programlar tablosunun son sütununda "Listeme ekle" (secondary) / "Listede" (ghost, pasif); 24'e ulaşınca ekleme pasif. | Düğmeler kartın altında yatay |
| Soru çıkarma | Başlığın altında yalnızca yapılabilecek hareketlerin kısa listesi; altında `surface` zeminli kenarlıklı bir şeritte iki seçim ("Soruları bulma": Otomatik / PDF'teki metinden / Metin tanıma; "Cevap anahtarı": Otomatik / Ayrı cevap anahtarı sayfası / Her sayfanın altında / Yok) ve kısa açıklama (kutu çiz + numara + Enter, A–E ile cevap, taşı/boyutlandır/sil, ← →); sağda "Bu sayfada bul" / "Tüm PDF'te bul" (secondary) ve "Kaydet" (primary, yalnızca değişiklik varken). Altında durum şeridi (`info` + Durdur), sonuç bildirimi (`success`/`danger`/`info`). Solda sayfa (beyaz, `shadow-card`) ve üzerinde soru kutuları: `info` kenarlık, sol üstte "12 C" etiketi; seçili kutu `primary` zemin %10 + dört köşe tutamacı, kenarlardan da (görünmez şeritler) boyutlandırılır; aynı testte tekrar eden numara `danger`. Boş yere sürükleyerek kutu çizilir; çizilir çizilmez numara kutusu önerilen numara seçili olarak odaklanır, Enter onaylar. Kutu seçiliyken A–E tuşları doğru cevabı işaretler. Sağda 340px yapışık panel: seçili sorunun kesilmiş önizlemesi, test adı + no, doğru cevap (A–E yuvarlak düğmeler, seçili `success`), şık sayısı (4/5) — şık metni girilmez, şıklar soru görselinin içindedir —, "Buradan yeni test başlat", "Soruyu sil"; seçim yoksa sayfadaki soru çipleri. Altında testler listesi ve "Cevap anahtarı gir" (test seç + "CABDE…" metni). | Tek sütun; panel sayfanın altında |
| Konu Anlatımı | Başlığın altında iki filtre satırı: Sınav (Tümü · TYT · AYT · LGS, YDT yalnızca kaynağı varsa) ve Ders (Tümü + seçili sınavda kaynağı olan dersler; TYT/AYT aynı ders tek çipte). Altında ders başlıkları (ders rengi nokta + ad + sayı) ve kart ızgarası 1 → 2 → 3 → 4 sütun; sağ üstte "Kaynak ekle". Detayda solda 16:9 oynatıcı, sağda 360px video listesi (kendi içinde kayar). | Açıklamanın altında "Kaynak ekle"; filtre satırları yana kayar (ekran kenarına kadar). Kartlar tek sütun. "Kaynak ekle" sekmelerin üstüne açılan ekrandır (bağlantı + ders; ders seçimi alttan açılan liste, kendi sınavının dersleri önce). Detay sekmelerin üstüne açılır: üstte sabit 16:9 oynatıcı (**YouTube'un kendi kontrolleri**; dokunmatikte kendi şeridimiz yok), altında kayan alan: çalan videonun sırası, adı, sıradaki, "İzlendi olarak işaretle"; çizgi; kaynak adı, ders/kanal/izlenen, ilerleme çubuğu, açılır "Ayarlar" (ders, ad değiştir, sil); "Videolar" ve video satırları. Telefon yan çevrilince video bütün ekranı kaplar (başlık ve durum çubuğu gizlenir); oynatıcıdaki tam ekran düğmesi telefon dik tutulsa da ekranı yataya, tam ekrandan çıkış dikeye çevirir. Uygulamanın geri kalanı dikey kilitlidir. |

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
