# UniCoach

YKS ve LGS'ye hazırlanan öğrenciler için yardım sistemi: **konu anlatımı** (YouTube videoları), **soru bankası**, **geçmiş sorulardan deneme sınavı** ve **YKS tercih** modülleri. Web sitesi ve mobil uygulama aynı backend'i kullanır.

## Hızlı başlangıç (Docker)

Gereken tek şey [Docker Desktop](https://www.docker.com/products/docker-desktop/).

```bash
docker compose up --build
```

| Servis | Adres |
|---|---|
| Web sitesi | http://localhost:3000 |
| Tasarım rehberi | http://localhost:3000/tasarim |
| API sağlık kontrolü | http://localhost:4000/api/health |

İlk derleme birkaç dakika sürebilir. Veritabanı tabloları API açılırken otomatik oluşturulur. Durdurmak için `Ctrl+C`, verileri de silmek için `docker compose down -v` kullanılır.

## Geliştirme

Gereksinimler: Node.js 22+ ve Docker (yalnızca veritabanı için).

```bash
npm install
cp .env.example apps/api/.env
docker compose -f docker-compose.dev.yml up -d   # PostgreSQL → localhost:5432
npm run db:migrate                                # tabloları oluşturur
npm run dev                                       # API :4000, web :3000
```

## Mimari

```
apps/
  api/      NestJS + Prisma + PostgreSQL — REST API (/api/*)
  web/      Next.js + Tailwind — web sitesi
  mobile/   Expo (React Native) — mobil uygulama (planlandı)
packages/
  shared/   Ortak tipler, API istemcisi, net/puan hesapları
  design/   Tasarım token'ları (renk, yazı tipi, boşluk) — web ve mobil için tek kaynak
docs/
  DESIGN.md Tasarım sistemi
```

Web ve mobil uygulama iş mantığı içermez; ikisi de `packages/shared` içindeki istemciyle aynı API'yi kullanır. Görsel tutarlılık için ikisi de `packages/design` token'larını okur. Ayrıntılar için [docs/DESIGN.md](docs/DESIGN.md) dosyasına bakın.

## Teknolojiler

TypeScript · NestJS 11 · Prisma 6 · PostgreSQL 18 · Next.js 16 · React 19 · Tailwind CSS 4 · Expo · Docker Compose
