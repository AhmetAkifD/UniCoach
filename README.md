# UniCoach

YKS ve LGS'ye hazırlanan öğrenciler için yardım sistemi: **konu anlatımı** (YouTube videoları), **soru bankası**, **geçmiş sorulardan deneme sınavı** ve **YKS tercih** modülleri. Web sitesi ve mobil uygulama aynı backend'i kullanır.

## Hızlı başlangıç (Docker)

Gereken tek şey [Docker Desktop](https://www.docker.com/products/docker-desktop/).

```bash
docker compose up --build
```

| Servis | Adres |
|---|---|
| Web sitesi | http://localhost:3000 (e-posta adresinizi girin; kayıtlı değilse kayıt adımı açılır) |
| Tasarım rehberi | http://localhost:3000/tasarim (giriş gerekir) |
| API sağlık kontrolü | http://localhost:4000/api/health |

İlk derleme birkaç dakika sürebilir. Veritabanı tabloları API açılırken otomatik oluşturulur ve başlangıçta boştur. Kayıt olan kullanıcılar PostgreSQL'e yazılır; veriler `db-data` volume'unda tutulduğu için konteynerler durdurulup yeniden başlatılınca kaybolmaz.

- Durdurmak: `docker compose down`, veriler korunur.
- Tüm verileri silip sıfırdan başlamak: `docker compose down -v`

**Hesap rolleri:** Kayıt olan herkes *Öğrenci* olur. *Admin* hesabı oluşturmak için e-posta alanına `admin` yazın, kayıt adımında şifre olarak da `admin` girin. Bu kısayol yalnızca ders projesinde test kolaylığı içindir.

Oturum belirteçleri `JWT_SECRET` ile imzalanır. Compose'ta yerel kullanım için bir varsayılan değer vardır; gerçek bir sunucuda `JWT_SECRET=... docker compose up` ile değiştirin.

## Geliştirme

Gereksinimler: Node.js 22+ ve PostgreSQL (doğrudan kurulu ya da Docker ile).

**A) Doğrudan kurulu PostgreSQL (Docker gerekmez):** [PostgreSQL 18](https://www.postgresql.org/download/windows/) kurun. Türkçe Windows'ta kurulum sihirbazının **Locale** adımında **`C`** seçin; varsayılan Türkçe yerel ayar adı ("Türkiye") yüzünden veritabanı oluşturulamaz. Ardından:

```bash
npm install
cp .env.example apps/api/.env
psql -U postgres -h localhost -f scripts/setup-local-db.sql   # unicoach kullanıcısı ve veritabanı
npm run db:migrate                                             # tabloları oluşturur
npm run dev                                                    # API :4000, web :3000
```

**B) Docker ile yalnızca veritabanı:** `psql` adımı yerine `docker compose -f docker-compose.dev.yml up -d` çalıştırın, diğer adımlar aynıdır.

### Yerel sunucuyu başlatma ve durdurma

Proje klasöründe (kurulumdan sonra her seferinde yalnızca bu yeterlidir):

```bash
npm run dev          # API → http://localhost:4000, web → http://localhost:3000
```

- **Durdurmak:** `npm run dev` çalışan terminalde `Ctrl+C`.
- **Port meşgul hatası alırsanız** (`EADDRINUSE: :::3000` / `:::4000`), arkada kalan süreçleri kapatın (PowerShell):

  ```powershell
  Get-NetTCPConnection -LocalPort 3000,4000 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
  ```

- **PostgreSQL** Windows servisi olarak bilgisayar açılınca kendiliğinden başlar. Elle durdurup başlatmak için (yönetici PowerShell):

  ```powershell
  Stop-Service postgresql-x64-18
  Start-Service postgresql-x64-18
  ```

- Taranmış (metni seçilemeyen) PDF'lerde soru çıkarma Tesseract ile tarayıcıda yapılır; ilk kullanımda Türkçe dil verisi (~5 MB) internetten indirilir.
- Yüklenen PDF'ler `apps/api/storage/` altında durur (git'e girmez). Silmek için bu klasörü silebilirsiniz; veritabanındaki kayıtlar dosyasız kalır.
- `npm run build` ya da `prisma generate` çalıştırmadan önce `npm run dev`'i durdurun: Windows'ta çalışan API, Prisma'nın motor dosyasını kilitler (`EPERM` hatası).

### Mobil uygulama

API açıkken (`npm run dev`) ikinci bir terminalde:

```bash
npm run mobile
```

- **Android emülatörü:** terminalde `a` tuşuna basın; Expo Go emülatöre kendiliğinden kurulur ve uygulama açılır.
- **Telefon:** Expo Go ile QR kodu okutun. Telefon ve bilgisayar aynı Wi‑Fi ağında olmalı, Windows güvenlik duvarı 4000 portuna izin vermeli. Uygulama SDK 58 kullanır; Play Store'daki Expo Go henüz bu sürümü desteklemiyorsa emülatörü kullanın.
- Tarayıcı önizlemesi: `npm run web -w @unicoach/mobile` (http://localhost:8081).

Mobilde şimdilik giriş, ana sayfa, profil, Konu Anlatımı ve Soru Bankası (PDF yükleme, okuma ve soru çıkarma) var; diğer modüller sırayla ekleniyor.

## Mimari

```
apps/
  api/      NestJS + Prisma + PostgreSQL — REST API (/api/*)
  web/      Next.js + Tailwind — web sitesi
  mobile/   Expo SDK 58 (React Native) — mobil uygulama
packages/
  shared/   Ortak tipler, API istemcisi, net/puan hesapları
  design/   Tasarım token'ları (renk, yazı tipi, boşluk) — web ve mobil için tek kaynak
docs/
  DESIGN.md Tasarım sistemi
```

Web ve mobil uygulama iş mantığı içermez; ikisi de `packages/shared` içindeki istemciyle aynı API'yi kullanır. Görsel tutarlılık için ikisi de `packages/design` token'larını okur. Ayrıntılar için [docs/DESIGN.md](docs/DESIGN.md) dosyasına bakın.

## Teknolojiler

TypeScript · NestJS 11 · Prisma 6 · PostgreSQL 18 · Next.js 16 · React 19 · Tailwind CSS 4 · Expo · Docker Compose
