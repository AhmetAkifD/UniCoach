-- "name" sütununu "firstName" ve "lastName" olarak ayırır.
-- Mevcut kayıtlar korunur: son kelime soyad, öncesi ad olur ("Ahmet Akif Duran" → "Ahmet Akif" + "Duran").

ALTER TABLE "User" ADD COLUMN "firstName" TEXT, ADD COLUMN "lastName" TEXT;

UPDATE "User"
SET "firstName" = CASE
                    WHEN position(' ' IN btrim("name")) = 0 THEN btrim("name")
                    ELSE btrim(regexp_replace(btrim("name"), '\s+\S+$', ''))
                  END,
    "lastName"  = CASE
                    WHEN position(' ' IN btrim("name")) = 0 THEN ''
                    ELSE substring(btrim("name") FROM '(\S+)$')
                  END;

ALTER TABLE "User" ALTER COLUMN "firstName" SET NOT NULL, ALTER COLUMN "lastName" SET NOT NULL;

ALTER TABLE "User" DROP COLUMN "name";
