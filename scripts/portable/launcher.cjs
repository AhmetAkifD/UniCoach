// UniCoach taşınabilir sürüm başlatıcısı. Hiçbir kurulum gerektirmez: klasördeki Node.js ve PostgreSQL ile
// veritabanını, API'yi ve web sitesini başlatır. Veriler klasörün içindeki "veri" dizininde durur.
// Yalnızca Node'un kendi modüllerini kullanır (scripts/build-portable.mjs bunu runtime/ içine kopyalar).
"use strict";

const { spawn, spawnSync } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const NODE = process.execPath;
const PG_BIN = path.join(ROOT, "runtime", "pgsql", "bin");
const DATA = path.join(ROOT, "veri");
const PG_DATA = path.join(DATA, "postgres");
const UPLOADS = path.join(DATA, "uploads");
const API_DIR = path.join(ROOT, "app", "api");
const WEB_SERVER = path.join(ROOT, "app", "web", "apps", "web", "server.js");

const PG_PORT = 54329;
const API_PORT = 4000;
const WEB_PORT = 3000;
const DB_URL = `postgresql://unicoach@127.0.0.1:${PG_PORT}/unicoach?schema=public`;
const SITE = `http://localhost:${WEB_PORT}`;

const children = [];
let stopping = false;

const log = (msg) => console.log(`[UniCoach] ${msg}`);

function pg(tool, args, opts = {}) {
  return spawnSync(path.join(PG_BIN, `${tool}.exe`), args, { encoding: "utf8", windowsHide: true, ...opts });
}

function portFree(port) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once("error", () => resolve(false));
    srv.once("listening", () => srv.close(() => resolve(true)));
    srv.listen(port, "0.0.0.0");
  });
}

function waitFor(url, timeoutMs) {
  const until = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = () => {
      http
        .get(url, (res) => {
          res.resume();
          if (res.statusCode && res.statusCode < 500) return resolve();
          retry();
        })
        .on("error", retry);
    };
    const retry = () => (Date.now() > until ? reject(new Error(`${url} yanıt vermedi.`)) : setTimeout(attempt, 500));
    attempt();
  });
}

/** Oturum belirteçlerini imzalayan anahtar: ilk açılışta üretilir, klasörde saklanır (oturumlar yeniden başlatınca düşmesin). */
function jwtSecret() {
  const file = path.join(DATA, "jwt-secret");
  if (!fs.existsSync(file)) fs.writeFileSync(file, crypto.randomBytes(48).toString("hex"));
  return fs.readFileSync(file, "utf8").trim();
}

function pgRunning() {
  return fs.existsSync(path.join(PG_DATA, "PG_VERSION")) && pg("pg_ctl", ["status", "-D", PG_DATA]).status === 0;
}

function startPostgres() {
  if (!fs.existsSync(path.join(PG_DATA, "PG_VERSION"))) {
    log("İlk açılış: veritabanı hazırlanıyor…");
    const init = pg("initdb", ["-D", PG_DATA, "-U", "unicoach", "-A", "trust", "-E", "UTF8", "--locale=C"]);
    if (init.status !== 0) throw new Error(`Veritabanı oluşturulamadı:\n${init.stderr || init.stdout}`);
  }
  if (!pgRunning()) {
    // Önceki açılış kapanmadan kesildiyse kalan kilit dosyası başlatmayı engellemesin.
    fs.rmSync(path.join(PG_DATA, "postmaster.pid"), { force: true });
    // stdio "ignore": sunucu, pg_ctl'nin çıktı borularını devralıp açık tuttuğu için spawnSync hiç dönmezdi.
    const start = pg(
      "pg_ctl",
      ["start", "-w", "-D", PG_DATA, "-l", path.join(DATA, "postgres.log"), "-o", `-p ${PG_PORT} -c listen_addresses=127.0.0.1`],
      { stdio: "ignore" },
    );
    if (start.status !== 0) throw new Error("Veritabanı başlatılamadı (ayrıntı: veri\\postgres.log).");
  }
  const exists = pg("psql", ["-h", "127.0.0.1", "-p", String(PG_PORT), "-U", "unicoach", "-d", "postgres", "-tAc", "SELECT 1 FROM pg_database WHERE datname='unicoach'"]);
  if (exists.stdout.trim() !== "1") {
    const created = pg("createdb", ["-h", "127.0.0.1", "-p", String(PG_PORT), "-U", "unicoach", "unicoach"]);
    if (created.status !== 0) throw new Error(`Veritabanı oluşturulamadı:\n${created.stderr}`);
  }
}

function migrate() {
  log("Veritabanı güncelleniyor…");
  const res = spawnSync(NODE, [path.join(API_DIR, "node_modules", "prisma", "build", "index.js"), "migrate", "deploy"], {
    cwd: API_DIR,
    env: { ...process.env, DATABASE_URL: DB_URL, PRISMA_HIDE_UPDATE_MESSAGE: "1" },
    encoding: "utf8",
    windowsHide: true,
  });
  if (res.status !== 0) throw new Error(`Veritabanı güncellenemedi:\n${res.stdout}\n${res.stderr}`);
}

function run(name, script, env, cwd) {
  const child = spawn(NODE, [script], { cwd, env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
  const out = fs.createWriteStream(path.join(DATA, `${name}.log`), { flags: "a" });
  child.stdout.pipe(out);
  child.stderr.pipe(out);
  child.on("exit", (code) => {
    if (!stopping) {
      log(`${name} beklenmedik şekilde kapandı (kod ${code}). Ayrıntı: veri\\${name}.log`);
      shutdown(1);
    }
  });
  children.push(child);
  return child;
}

function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  log("Kapatılıyor…");
  for (const c of children) c.kill();
  if (pgRunning()) pg("pg_ctl", ["stop", "-D", PG_DATA, "-m", "fast", "-w"]);
  process.exit(code);
}

async function main() {
  fs.mkdirSync(UPLOADS, { recursive: true });
  for (const [port, what] of [
    [WEB_PORT, "web sitesi"],
    [API_PORT, "API"],
  ]) {
    if (!(await portFree(port))) {
      throw new Error(`${port} portu kullanımda (${what} için gerekli). UniCoach zaten açık olabilir; diğer pencereyi kapatıp yeniden dene.`);
    }
  }

  startPostgres();
  migrate();

  log("API başlatılıyor…");
  run(
    "api",
    path.join(API_DIR, "dist", "main.js"),
    {
      NODE_ENV: "production",
      DATABASE_URL: DB_URL,
      API_PORT: String(API_PORT),
      JWT_SECRET: jwtSecret(),
      UPLOAD_DIR: UPLOADS,
      WEB_ORIGIN: SITE,
    },
    API_DIR,
  );
  await waitFor(`http://127.0.0.1:${API_PORT}/api/health`, 60_000);

  log("Web sitesi başlatılıyor…");
  run(
    "web",
    WEB_SERVER,
    { NODE_ENV: "production", PORT: String(WEB_PORT), HOSTNAME: "0.0.0.0", API_INTERNAL_URL: `http://127.0.0.1:${API_PORT}`, NEXT_TELEMETRY_DISABLED: "1" },
    path.dirname(WEB_SERVER),
  );
  await waitFor(`http://127.0.0.1:${WEB_PORT}/giris`, 60_000);

  log(`Hazır: ${SITE}`);
  log("Kapatmak için bu pencereyi kapat ya da Ctrl+C'ye bas.");
  spawn("cmd", ["/c", "start", "", SITE], { detached: true, stdio: "ignore", windowsHide: true }).unref();
}

for (const sig of ["SIGINT", "SIGTERM", "SIGHUP", "SIGBREAK"]) process.on(sig, () => shutdown(0));

main().catch((err) => {
  console.error(`\n[UniCoach] HATA: ${err.message}\n`);
  for (const c of children) c.kill();
  if (pgRunning()) pg("pg_ctl", ["stop", "-D", PG_DATA, "-m", "fast", "-w"]);
  stopping = true;
  process.exitCode = 1;
});
