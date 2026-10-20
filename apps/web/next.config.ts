import path from "node:path";
import type { NextConfig } from "next";

// Monorepo kökü: standalone çıktısı workspace paketlerini de içersin diye.
const repoRoot = path.resolve(process.cwd(), "../..");
const apiUrl = process.env.API_INTERNAL_URL ?? "http://localhost:4000";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: repoRoot,
  turbopack: { root: repoRoot },
  // Geliştirmede site 127.0.0.1 üzerinden de açılabilsin (localhost'tan ayrı çerezlerle ikinci bir hesap denemek için).
  allowedDevOrigins: ["127.0.0.1"],
  // Tarayıcıdan gelen /api istekleri API'ye aktarılır: CORS gerekmez, tek port yeterli.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiUrl}/api/:path*` }];
  },
};

export default nextConfig;
