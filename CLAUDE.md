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
- Bağımlılık sürümleri: NestJS 11 (12 yalnızca ESM), Prisma 6, TypeScript 5.9 bilinçli olarak seçildi. Yükseltme ayrı bir iş olarak ele alınır.

## Komutlar

```bash
npm install                                   # bağımlılıklar
docker compose -f docker-compose.dev.yml up -d  # yalnızca Postgres (localhost:5432)
npm run dev                                   # paketleri derler, API :4000 + web :3000
npm run build                                 # her şeyi derler
npm run typecheck
docker compose up --build                     # tam sistem (db + api + web)
```

## Yol haritası

0. ✅ İskelet, Docker, tasarım sistemi
1. Auth (öğrenci/admin) ve içerik veri modeli
2. Konu anlatımı
3. Soru bankası
4. Geçmiş sınavlar
5. YKS tercih
6. Mobil uygulama
