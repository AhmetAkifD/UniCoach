# UniCoach — proje notları

YKS/LGS öğrenci yardım sistemi (ders projesi). Önce web, sonra **aynı API'yi kullanan** mobil uygulama.
Modüller: konu anlatımı (YouTube linkleri), soru bankası, geçmiş sorulardan sınav, YKS tercih. Kapsam YKS (TYT/AYT) ve LGS; tercih modülü yalnızca YKS içindir. İçerik admin panelinden girilir, ayrıca seed verisi bulunur.

## Yapı (npm workspaces)

| Yol | Ne |
|---|---|
| `apps/api` | NestJS 11 + Prisma 6 + PostgreSQL. Tüm iş mantığı burada. Uç noktalar `/api/*` altında. |
| `apps/web` | Next.js 16 (App Router) + Tailwind 4. `/api/*` istekleri rewrite ile API'ye gider. |
| `apps/mobile` | (Aşama 6) Expo / React Native. Aynı `shared` ve `design` paketlerini kullanır. |
| `packages/shared` | Ortak tipler, `createApiClient`, sınav sabitleri, net hesabı. Web ve mobilde tekrar yazılmaz. |
| `packages/design` | Tasarım token'ları (tek kaynak). `dist/theme.css` → Tailwind; TS nesneleri → mobil. |

Paketler `dist/` dizinine derlenir (CommonJS). Uygulamalardan önce `npm run build:packages` çalıştırılmalıdır.

## Kurallar

- **Arayüz işinden önce [`docs/DESIGN.md`](docs/DESIGN.md) oku.** Tasarım dili "Modern & sakin"dir (indigo, yuvarlak kartlar). Bileşenlerde yalnızca anlamsal token sınıfları (`bg-surface`, `text-text-muted`, `bg-primary` …) kullanılır; ham hex veya `bg-indigo-600` kullanılmaz.
- Token değişirse `packages/design/src/tokens.ts` ve `docs/DESIGN.md` birlikte güncellenir.
- Web bileşenleri `apps/web/components/ui` altındadır. Mobilde aynı ad ve aynı prop'larla karşılıkları yazılır.
- Arayüz metinleri Türkçedir, "sen" diliyle yazılır.
- Yeni API uç noktası eklenirken yanıt tipi önce `packages/shared` içine eklenir, istemciler o tipi kullanır.
- Şema değişikliği: `apps/api/prisma/schema.prisma` güncellenir, ardından `npm run db:migrate` (yerel Postgres gerekir) çalıştırılır. Migration dosyaları commit'lenir.
- `docker compose up --build` her zaman çalışır durumda kalmalıdır, çünkü hoca projeyi bu komutla test edecek.
- **Giriş akışı (e-posta öncelikli, tek sayfa `/giris`):** e-posta → `POST /api/auth/check-email` → kayıtlıysa şifre adımı, değilse kayıt adımı (Ad, Soyad, Şifre) → kayıttan sonra şifre adımı. E-posta yalnızca `components/auth-flow.tsx` bileşeninin state'inde tutulur (URL veya storage yok); sayfa yenilenince akış baştan başlar. `/kayit` → `/giris` yönlendirmesidir.
- **Roller:** `STUDENT` (varsayılan) ve `ADMIN`. Admin kısayolu: e-posta `admin` + şifre `admin` ile kayıt olan hesap ADMIN olur (`ADMIN_SHORTCUT`, `isAdminShortcut` — packages/shared). Rol yalnızca API'de belirlenir. Bu kısayol ders projesi için kullanıcı isteğiyle eklendi; gerçek yayında kaldırılmalıdır.
- **Şifre kuralları:** 6–16 karakter, en az 1 büyük harf, en az 1 rakam (`PASSWORD_RULES`; admin kısayolu muaf). Kullanıcı adı ve soyadı ayrı tutulur (`firstName`, `lastName`).
- **Oturum:** API `POST /api/auth/register|login` JWT (7 gün) döndürür, `GET /api/auth/me` belirteci `Authorization: Bearer` başlığından (mobil) ya da `uc_session` çerezinden (web) okur. Web'de çerezi Next.js server action'ları (`app/(auth)/actions.ts`) httpOnly olarak yazar. Korumalı uç noktalarda `@UseGuards(AuthGuard)` ve `@CurrentUser()` kullanılır. Şifreler `node:crypto` scrypt ile özetlenir.
- **Web route grupları:** `app/(app)/*` giriş gerektirir (layout'ta `requireUser()`), `app/(auth)/*` giriş ve kayıt ekranlarıdır. Doğrulama kuralları `packages/shared/src/auth.ts` içindeki zod şemalarıdır; form, API ve mobil aynı şemayı kullanır.
- Arayüzde elle yazılmış örnek/sahte veri gösterilmez. Veri yoksa boş durum (empty state) gösterilir.
- Bağımlılık sürümleri: NestJS 11 (12 yalnızca ESM), Prisma 6, TypeScript 5.9 bilinçli olarak seçildi. Yükseltme ayrı bir iş olarak ele alınır.

## Komutlar

**Geliştirme makinesinde Docker kurulu değil** (2026-10-19, disk alanı yetersiz olduğu için kaldırıldı). Geliştirme doğrudan Windows'a kurulu PostgreSQL 18 ile yapılır (`localhost:5432`, kullanıcı/şifre/veritabanı `unicoach`, kurulum: `scripts/setup-local-db.sql`). Dockerfile ve compose dosyaları korunur ama burada çalıştırılamaz: bunlara dokunan değişiklikler proje tesliminden önce Docker yeniden kurularak `docker compose up --build` ile doğrulanmalıdır.

```bash
npm install                                   # bağımlılıklar
psql -U postgres -h localhost -f scripts/setup-local-db.sql  # bir kez: unicoach kullanıcısı + veritabanı
npm run dev                                   # paketleri derler, API :4000 + web :3000
npm run build                                 # her şeyi derler
npm run typecheck
docker compose up --build                     # tam sistem (db + api + web)
```

## Yol haritası

0. ✅ İskelet, Docker, tasarım sistemi
1. Auth (öğrenci/admin) ve içerik veri modeli — ✅ giriş/kayıt; ⏳ admin rolü, içerik modeli
2. Konu anlatımı
3. Soru bankası
4. Geçmiş sınavlar
5. YKS tercih
6. Mobil uygulama
