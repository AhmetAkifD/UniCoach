import { createApiClient } from "@unicoach/shared";

/** Sunucu bileşenleri için, oturumsuz istekler: API'ye doğrudan (Docker içinde http://api:4000) gider. Oturumlu istekler için lib/session.ts → authedApi. */
export const serverApi = createApiClient({
  baseUrl: process.env.API_INTERNAL_URL ?? "http://localhost:4000",
});

/** İstemci bileşenleri için: aynı köken üzerinden /api rewrite'ı kullanılır; oturum çerezi kendiliğinden gider. */
export const browserApi = createApiClient({ baseUrl: "" });
