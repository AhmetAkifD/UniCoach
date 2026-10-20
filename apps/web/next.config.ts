import path from "node:path";
import type { NextConfig } from "next";

// Monorepo kökü: standalone çıktısı workspace paketlerini de içersin diye.
const repoRoot = path.resolve(process.cwd(), "../..");
const apiUrl = process.env.API_INTERNAL_URL ?? "http://localhost:4000";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: repoRoot,
  turbopack: { root: repoRoot },
  // Geliştirmede site 127.0.0.1 ve *.localhost (ör. test.localhost) üzerinden de açılabilsin:
  // her adresin çerezleri ayrıdır, başka hesaplarla denemek için.
  allowedDevOrigins: ["127.0.0.1", "*.localhost"],
  experimental: {
    // Soru Bankası PDF'leri (en fazla 300 MB) /api rewrite'ı üzerinden yüklenir; varsayılan sınır 10 MB'dır.
    proxyClientMaxBodySize: "310mb",
    proxyTimeout: 60 * 60 * 1000,
  },
  // Tarayıcıdan gelen /api istekleri API'ye aktarılır: CORS gerekmez, tek port yeterli.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiUrl}/api/:path*` }];
  },
};

export default nextConfig;
