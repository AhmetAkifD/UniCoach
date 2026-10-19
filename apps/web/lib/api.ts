import { createApiClient } from "@unicoach/shared";

/** Sunucu bileşenleri için: API'ye doğrudan (Docker içinde http://api:4000) gider. */
export const serverApi = createApiClient({
  baseUrl: process.env.API_INTERNAL_URL ?? "http://localhost:4000",
});

/** İstemci bileşenleri için: aynı köken üzerinden /api rewrite'ı kullanılır. */
export const browserApi = createApiClient({ baseUrl: "" });
