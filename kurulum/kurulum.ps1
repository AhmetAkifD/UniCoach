# UniCoach kurulum ve başlatma (Windows 10/11, 64 bit). UniCoach-Kur-ve-Baslat.cmd çalıştırır.
# İlk çalıştırmada gerekenleri indirir (önce listesini gösterip onay ister), siteyi derler ve başlatır;
# sonraki çalıştırmalarda yalnızca başlatır. Docker, yönetici kurulumu ya da ayrı bir program gerekmez.
# İndirilen her şey bu klasörün içine gider; neyin nereye indiği hem ekranda hem masaüstündeki günlükte yazar.
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$Root = Split-Path -Parent $PSScriptRoot
$Kur = $PSScriptRoot
$Indirilenler = Join-Path $Kur "indirilenler"
$Araclar = Join-Path $Kur "araclar"
$Onbellek = Join-Path $Kur "onbellek"
$NodeDir = Join-Path $Araclar "node"
$PgDir = Join-Path $Araclar "pgsql"
$Veri = Join-Path $Root "veri"
$Tamam = Join-Path $Kur "araclar\kurulum-tamam.txt"
$Gunluk = Join-Path ([Environment]::GetFolderPath("Desktop")) "UniCoach-kurulum-gunlugu.txt"
$SitesiAdres = "http://localhost:3000"

$NodeSurum = "24.18.0"
$PgSurum = "18.6-1"

$Paketler = @(
  @{ Ad = "Node.js $NodeSurum (siteyi ve API'yi çalıştırır)"; Url = "https://nodejs.org/dist/v$NodeSurum/node-v$NodeSurum-win-x64.zip"; Dosya = "node-v$NodeSurum-win-x64.zip"; Boyut = 37176245; Acilan = $NodeDir },
  @{ Ad = "PostgreSQL $PgSurum (veritabanı)"; Url = "https://get.enterprisedb.com/postgresql/postgresql-$PgSurum-windows-x64-binaries.zip"; Dosya = "postgresql-$PgSurum-windows-x64-binaries.zip"; Boyut = 343808005; Acilan = $PgDir }
)
$VcRedist = @{ Ad = "Microsoft Visual C++ çalışma zamanı (PostgreSQL için; bu bilgisayarda yok)"; Url = "https://aka.ms/vs/17/release/vc_redist.x64.exe"; Dosya = "vc_redist.x64.exe"; Boyut = 25635768 }

function Yaz([string]$Mesaj, [string]$Renk = "Gray") {
  Write-Host $Mesaj -ForegroundColor $Renk
  Add-Content -Path $Gunluk -Value ("[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Mesaj) -Encoding UTF8
}
function MB([double]$Bayt) { "{0:N0} MB" -f ($Bayt / 1MB) }
function Calistir([string]$Dosya, [string[]]$Argumanlar, [string]$Klasor = $Root) {
  Push-Location $Klasor
  try {
    & $Dosya @Argumanlar
    if ($LASTEXITCODE -ne 0) { throw "Komut başarısız oldu (kod $LASTEXITCODE): $Dosya $($Argumanlar -join ' ')" }
  } finally { Pop-Location }
}
function Indir($Paket) {
  $Hedef = Join-Path $Indirilenler $Paket.Dosya
  if ((Test-Path $Hedef) -and ((Get-Item $Hedef).Length -eq $Paket.Boyut)) {
    Yaz "  Zaten indirilmiş: $Hedef"
    return $Hedef
  }
  Yaz "  İndiriliyor: $($Paket.Url)"
  Yaz "        → $Hedef"
  & curl.exe -L --fail --retry 3 -o $Hedef $Paket.Url
  if ($LASTEXITCODE -ne 0) { throw "İndirilemedi: $($Paket.Url)" }
  $Gelen = (Get-Item $Hedef).Length
  if ($Gelen -ne $Paket.Boyut) { throw "İndirilen dosyanın boyutu beklenenden farklı ($Gelen / $($Paket.Boyut) bayt): $Hedef" }
  return $Hedef
}

New-Item -ItemType Directory -Force -Path $Indirilenler, $Araclar, $Onbellek, $Veri | Out-Null
Yaz ""
Yaz "=== UniCoach ===" "Cyan"
Yaz "Klasör: $Root"
Yaz "Günlük dosyası: $Gunluk"

try {
  if (-not (Test-Path $Tamam)) {
    $VcGerekli = -not ((Test-Path "$env:SystemRoot\System32\vcruntime140_1.dll") -and (Test-Path "$env:SystemRoot\System32\msvcp140.dll"))
    $Liste = @($Paketler)
    if ($VcGerekli) { $Liste += $VcRedist }
    # Measure-Object -Property, PowerShell 5.1'de hashtable anahtarlarını okumaz.
    $Toplam = 0
    foreach ($p in $Liste) { $Toplam += $p.Boyut }

    Yaz ""
    Yaz "İlk kurulum. Aşağıdakiler indirilecek:" "Yellow"
    $i = 1
    foreach ($p in $Liste) {
      Yaz ("  {0}. {1} — {2}" -f $i, $p.Ad, (MB $p.Boyut))
      Yaz "     Kaynak: $($p.Url)"
      Yaz "     Kayıt yeri: $(Join-Path $Indirilenler $p.Dosya)"
      if ($p.Acilan) { Yaz "     Açılacağı yer: $($p.Acilan)" }
      $i++
    }
    Yaz ("  {0}. Sitenin kullandığı kütüphaneler (npm) — yaklaşık 350 MB" -f $i)
    Yaz "     Kaynak: https://registry.npmjs.org"
    Yaz "     Kayıt yeri: $(Join-Path $Root 'node_modules') (önbellek: $(Join-Path $Onbellek 'npm'))"
    $i++
    Yaz ("  {0}. Veritabanı bağlantı motoru (Prisma) — yaklaşık 20 MB" -f $i)
    Yaz "     Kaynak: https://binaries.prisma.sh"
    Yaz "     Kayıt yeri: $(Join-Path $Root 'node_modules\@prisma\engines') (önbellek: $(Join-Path $Onbellek 'prisma-nodejs'))"
    $i++
    Yaz ("  {0}. Yazı tipi Inter (sitenin yazı tipi, derlemede) — 1 MB'tan az" -f $i)
    Yaz "     Kaynak: https://fonts.googleapis.com"
    Yaz "     Kayıt yeri: $(Join-Path $Root 'apps\web\.next')"
    Yaz ("  Toplam: yaklaşık {0}" -f (MB ($Toplam + 370MB)))
    Yaz "  Verilerin (hesaplar, PDF'ler, notlar): $Veri"
    if ($VcGerekli) { Yaz "  Not: Visual C++ çalışma zamanı Windows'a kurulur; Windows yönetici izni isteyebilir." "Yellow" }
    Yaz ""
    $Cevap = Read-Host "Devam edilsin mi? (E = evet, H = hayır)"
    if ($Cevap -notmatch "^[EeYy]") { Yaz "Vazgeçildi; hiçbir şey indirilmedi."; exit 0 }
    Yaz "Onaylandı."

    if ($VcGerekli) {
      Yaz ""
      Yaz "Visual C++ çalışma zamanı" "Cyan"
      $Vc = Indir $VcRedist
      Yaz "  Kuruluyor (Windows izin isteyebilir)…"
      $Islem = Start-Process -FilePath $Vc -ArgumentList "/install", "/passive", "/norestart" -Wait -PassThru
      if ($Islem.ExitCode -notin 0, 1638, 3010) { throw "Visual C++ çalışma zamanı kurulamadı (kod $($Islem.ExitCode))." }
      Yaz "  Kuruldu: $env:SystemRoot\System32\vcruntime140.dll"
    }

    Yaz ""
    Yaz "Node.js" "Cyan"
    $NodeZip = Indir $Paketler[0]
    Remove-Item -Recurse -Force $NodeDir -ErrorAction SilentlyContinue
    Calistir "$env:SystemRoot\System32\tar.exe" @("-xf", $NodeZip, "-C", $Araclar) $Araclar
    Rename-Item (Join-Path $Araclar "node-v$NodeSurum-win-x64") "node"
    Yaz "  Açıldı: $NodeDir"

    Yaz ""
    Yaz "PostgreSQL" "Cyan"
    $PgZip = Indir $Paketler[1]
    Remove-Item -Recurse -Force $PgDir -ErrorAction SilentlyContinue
    # pgAdmin ve belgeler gerekmez; yalnızca sunucu dosyaları açılır.
    Calistir "$env:SystemRoot\System32\tar.exe" @("-xf", $PgZip, "-C", $Araclar, "pgsql/bin", "pgsql/lib", "pgsql/share") $Araclar
    Yaz "  Açıldı: $PgDir"

    $env:PATH = "$NodeDir;$env:PATH"
    $env:NEXT_TELEMETRY_DISABLED = "1"
    $Npm = Join-Path $NodeDir "npm.cmd"

    Yaz ""
    Yaz "Kütüphaneler indiriliyor (npm, birkaç dakika sürebilir)" "Cyan"
    Yaz "  → $(Join-Path $Root 'node_modules')"
    # Prisma motoru önbelleği kullanıcı klasörü yerine buraya (LOCALAPPDATA yalnızca bu işlem için değişir).
    $EskiLocal = $env:LOCALAPPDATA
    $env:LOCALAPPDATA = $Onbellek
    try {
      Calistir $Npm @("ci", "--no-audit", "--no-fund", "--cache", (Join-Path $Onbellek "npm"))
    } finally { $env:LOCALAPPDATA = $EskiLocal }
    Yaz "  Tamam."

    Yaz ""
    Yaz "Site derleniyor" "Cyan"
    Calistir $Npm @("run", "build:packages")
    $env:LOCALAPPDATA = $Onbellek
    try { Calistir $Npm @("run", "build", "-w", "@unicoach/api") } finally { $env:LOCALAPPDATA = $EskiLocal }
    $env:API_INTERNAL_URL = "http://127.0.0.1:4000"
    Calistir $Npm @("run", "build", "-w", "@unicoach/web")
    $Standalone = Join-Path $Root "apps\web\.next\standalone\apps\web"
    Copy-Item -Recurse -Force (Join-Path $Root "apps\web\.next\static") (Join-Path $Standalone ".next\static")
    Copy-Item -Recurse -Force (Join-Path $Root "apps\web\public") (Join-Path $Standalone "public")
    Yaz "  Derlendi: $Standalone"

    Set-Content -Path $Tamam -Value "UniCoach kurulumu tamamlandı: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -Encoding UTF8
    Yaz ""
    Yaz "Kurulum tamamlandı. İndirilenlerin yerleri:" "Green"
    Yaz "  İndirilen dosyalar: $Indirilenler"
    Yaz "  Node.js: $NodeDir"
    Yaz "  PostgreSQL: $PgDir"
    Yaz "  Kütüphaneler: $(Join-Path $Root 'node_modules')"
    Yaz "  Önbellekler: $Onbellek"
    Yaz "  Veriler: $Veri"
    Yaz "  (İndirilen zip dosyaları artık gerekmez; $Indirilenler silinebilir.)"
  } else {
    Yaz "Kurulum daha önce yapılmış; yalnızca başlatılıyor."
  }

  Yaz ""
  Yaz "Başlatılıyor — site hazır olunca tarayıcıda $SitesiAdres açılır." "Cyan"
  Yaz "Kapatmak için bu pencereyi kapat ya da Ctrl+C'ye bas."
  $env:UC_PG_BIN = Join-Path $PgDir "bin"
  $env:UC_DATA = $Veri
  $env:UC_API_DIR = Join-Path $Root "apps\api"
  $env:UC_WEB_SERVER = Join-Path $Root "apps\web\.next\standalone\apps\web\server.js"
  & (Join-Path $NodeDir "node.exe") (Join-Path $Root "scripts\portable\launcher.cjs")
  exit $LASTEXITCODE
} catch {
  Yaz ""
  Yaz "HATA: $($_.Exception.Message)" "Red"
  Yaz "Ayrıntılar günlük dosyasında: $Gunluk" "Red"
  exit 1
}
