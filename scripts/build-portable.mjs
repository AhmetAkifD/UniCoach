// Taşınabilir Windows paketi: kurulum gerektirmeyen tek klasör (Node.js + PostgreSQL + API + web).
// Bu bilgisayardaki Node.js ve PostgreSQL 18 kurulumundan kopyalar; internetten bir şey indirmez
// (API'nin üretim bağımlılıkları npm önbelleğinden kurulur).
//
//   node scripts/build-portable.mjs
//
// Çıktı: dist-portable/UniCoach (klasör) ve masaüstünde UniCoach-tasinabilir.zip.
// API geliştirme sunucusu açıkken çalıştırma (Prisma motoru kilitli olur).
import { execFileSync, execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(repo, "dist-portable", "UniCoach");
const zip = path.join(os.homedir(), "Desktop", "UniCoach-tasinabilir.zip");
const pgHome = process.env.PG_HOME ?? "C:\\Program Files\\PostgreSQL\\18";
const system32 = path.join(process.env.SystemRoot ?? "C:\\Windows", "System32");
// PostgreSQL ve Prisma motoru Visual C++ çalışma zamanını ister; temiz Windows'ta olmayabilir, yanlarına konur.
const vcRuntime = ["vcruntime140.dll", "vcruntime140_1.dll", "msvcp140.dll", "msvcp140_1.dll", "msvcp140_2.dll"];

const step = (msg) => console.log(`\n▶ ${msg}`);
const sh = (cmd, opts = {}) => execSync(cmd, { cwd: repo, stdio: "inherit", ...opts });
const copy = (from, to) => fs.cpSync(from, to, { recursive: true, dereference: true });
const json = (file) => JSON.parse(fs.readFileSync(file, "utf8"));

if (process.platform !== "win32") throw new Error("Taşınabilir paket yalnızca Windows'ta derlenir.");
if (!fs.existsSync(path.join(pgHome, "bin", "postgres.exe"))) throw new Error(`PostgreSQL bulunamadı: ${pgHome} (PG_HOME ile ver).`);

step("Derleniyor (paketler, API, web)");
sh("npm run build:packages");
sh("npm run build -w @unicoach/api");
// Web'in /api yönlendirmesi derlemede sabitlenir: başlatıcının API'si 127.0.0.1:4000'de.
sh("npm run build -w @unicoach/web", { env: { ...process.env, API_INTERNAL_URL: "http://127.0.0.1:4000", NEXT_TELEMETRY_DISABLED: "1" } });

step("Klasör hazırlanıyor");
fs.rmSync(path.join(repo, "dist-portable"), { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

// --- API: derlenmiş kod + yalnızca üretim bağımlılıkları (sürümler kilit dosyasındakiyle aynı) ---
step("API ve bağımlılıkları");
const apiOut = path.join(out, "app", "api");
copy(path.join(repo, "apps", "api", "dist"), path.join(apiOut, "dist"));
copy(path.join(repo, "apps", "api", "prisma"), path.join(apiOut, "prisma"));
const lock = json(path.join(repo, "package-lock.json")).packages;
const apiPkg = json(path.join(repo, "apps", "api", "package.json"));
const sharedPkg = json(path.join(repo, "packages", "shared", "package.json"));
const deps = { ...apiPkg.dependencies, ...sharedPkg.dependencies };
delete deps["@unicoach/shared"];
const pinned = Object.fromEntries(
  Object.keys(deps).map((name) => [name, lock[`node_modules/${name}`]?.version ?? deps[name]]),
);
fs.writeFileSync(
  path.join(apiOut, "package.json"),
  JSON.stringify({ name: "unicoach-api", version: apiPkg.version, private: true, dependencies: pinned }, null, 2),
);
sh("npm install --omit=dev --no-audit --no-fund --prefer-offline --no-package-lock", { cwd: apiOut });
// Ortak paket bağlantı (junction) yerine gerçek kopya olarak: klasör taşınınca kırılmasın.
const sharedOut = path.join(apiOut, "node_modules", "@unicoach", "shared");
fs.mkdirSync(sharedOut, { recursive: true });
copy(path.join(repo, "packages", "shared", "dist"), path.join(sharedOut, "dist"));
fs.copyFileSync(path.join(repo, "packages", "shared", "package.json"), path.join(sharedOut, "package.json"));
sh(`"${process.execPath}" node_modules/prisma/build/index.js generate`, { cwd: apiOut });

// --- Web: Next.js standalone çıktısı + statik dosyalar ---
step("Web sitesi");
const webOut = path.join(out, "app", "web");
copy(path.join(repo, "apps", "web", ".next", "standalone"), webOut);
copy(path.join(repo, "apps", "web", ".next", "static"), path.join(webOut, "apps", "web", ".next", "static"));
copy(path.join(repo, "apps", "web", "public"), path.join(webOut, "apps", "web", "public"));

// --- Çalışma zamanı: Node.js, PostgreSQL, VC++ ---
step("Node.js ve PostgreSQL");
const runtime = path.join(out, "runtime");
fs.mkdirSync(runtime, { recursive: true });
fs.copyFileSync(process.execPath, path.join(runtime, "node.exe"));
const pgOut = path.join(runtime, "pgsql");
for (const dir of ["bin", "lib", "share"]) copy(path.join(pgHome, dir), path.join(pgOut, dir));
// Gereksiz büyük parçalar: hata ayıklama sembolleri ve pgAdmin'e ait dosyalar
for (const f of fs.readdirSync(path.join(pgOut, "bin"))) if (f.endsWith(".pdb")) fs.rmSync(path.join(pgOut, "bin", f));
for (const f of fs.readdirSync(path.join(pgOut, "lib"))) if (f.endsWith(".pdb") || f.endsWith(".lib")) fs.rmSync(path.join(pgOut, "lib", f));
for (const dll of vcRuntime) {
  const from = path.join(system32, dll);
  if (!fs.existsSync(from)) continue;
  fs.copyFileSync(from, path.join(runtime, dll));
  fs.copyFileSync(from, path.join(pgOut, "bin", dll));
}

// --- Başlatıcı ---
const portable = path.join(repo, "scripts", "portable");
fs.copyFileSync(path.join(portable, "launcher.cjs"), path.join(runtime, "launcher.cjs"));
const crlf = (file, to) => fs.writeFileSync(to, fs.readFileSync(file, "utf8").replace(/\r?\n/g, "\r\n"));
crlf(path.join(portable, "UniCoach.cmd"), path.join(out, "UniCoach.cmd"));
crlf(path.join(portable, "BENIOKU.txt"), path.join(out, "BENIOKU.txt"));

step("Sıkıştırılıyor");
fs.rmSync(zip, { force: true });
// Windows'un kendi tar'ı (bsdtar) zip yazar; PATH'teki Git tar'ı "C:"yi uzak sunucu sanar.
execFileSync(path.join(system32, "tar.exe"), ["-a", "-c", "-f", zip, "-C", path.dirname(out), "UniCoach"], { stdio: "inherit" });
const mb = (n) => `${Math.round(n / 1024 / 1024)} MB`;
console.log(`\n✔ Klasör: ${out}\n✔ Zip: ${zip} (${mb(fs.statSync(zip).size)})`);
