-- Docker olmadan, Windows'a doğrudan kurulmuş PostgreSQL için tek seferlik kurulum.
-- Çalıştırma (PostgreSQL kurulumunda belirlediğiniz "postgres" şifresi sorulur):
--   psql -U postgres -h localhost -f scripts/setup-local-db.sql
--
-- apps/api/.env içindeki DATABASE_URL ile aynı kullanıcı/şifre/veritabanını oluşturur.
-- CREATEDB yetkisi `prisma migrate dev`in geçici "shadow" veritabanı için gereklidir.
--
-- Türkçe Windows'ta kurulum sihirbazında yerel ayar (Locale) olarak "C" seçilmelidir;
-- "Turkish_Türkiye.1254" adı ASCII dışı karakter içerdiği için initdb başarısız olur.
-- Türkçe sıralama (Ç, Ğ, İ, Ö, Ş, Ü) bunun yerine veritabanı seviyesinde ICU ile sağlanır.

CREATE ROLE unicoach WITH LOGIN PASSWORD 'unicoach' CREATEDB;
CREATE DATABASE unicoach
  OWNER unicoach
  ENCODING 'UTF8'
  LOCALE 'C'
  LOCALE_PROVIDER icu
  ICU_LOCALE 'tr-TR'
  TEMPLATE template0;
