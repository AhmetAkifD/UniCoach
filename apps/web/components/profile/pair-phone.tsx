"use client";

import { useEffect, useState } from "react";
import { QrCode, Smartphone } from "lucide-react";
import QRCode from "qrcode";
import { pairCodeText, type PairResponse } from "@unicoach/shared";
import { Button } from "@/components/ui/button";
import { browserApi } from "@/lib/api";

/**
 * Telefonu eşle: mobil uygulama bu QR kodu okutunca bu bilgisayardaki sunucunun yerel ağ adresini saklar ve aynı
 * hesapla giriş yapar; eve dönüp aynı ağa girince kendiliğinden eşitlenir. Kod bir oturum taşır.
 */
export function PairPhone() {
  const [pair, setPair] = useState<PairResponse | null>(null);
  const [url, setUrl] = useState("");
  const [svg, setSvg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  async function show() {
    setLoading(true);
    setError(undefined);
    try {
      const next = await browserApi.auth.pair();
      setPair(next);
      setUrl(next.urls[0] ?? "");
    } catch {
      setError("Kod oluşturulamadı. Biraz sonra tekrar dene.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!pair || !url) {
      setSvg(null);
      return;
    }
    // QR siyah-beyaz olmalı (temaya göre renk değişirse telefon okuyamaz); SVG kendi beyaz zeminiyle gelir.
    void QRCode.toString(pairCodeText({ url, token: pair.token }), { type: "svg", margin: 2, errorCorrectionLevel: "M" }).then(setSvg);
  }, [pair, url]);

  if (!pair) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-sm text-text-muted">
          Mobil uygulamada giriş ekranındaki ya da Profil'deki <strong className="font-medium text-text">QR ile bağlan</strong>'a dokun
          ve buradaki kodu okut. Telefon bu bilgisayarın adresini öğrenir; evdeki ağa her dönüşünde notların, ilerlemen ve
          sınavların kendiliğinden eşitlenir.
        </p>
        <Button variant="secondary" onClick={() => void show()} loading={loading}>
          <QrCode className="size-4" aria-hidden /> QR kodu göster
        </Button>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
      <div className="size-56 shrink-0 overflow-hidden rounded-md border border-border" aria-label="Eşleme kodu" role="img">
        {svg ? <div className="size-full [&>svg]:size-full" dangerouslySetInnerHTML={{ __html: svg }} /> : null}
      </div>
      <div className="flex min-w-0 flex-col gap-3 text-sm">
        {pair.urls.length === 0 ? (
          <p className="text-danger">Bu bilgisayarın yerel ağ adresi bulunamadı. Bilgisayarın bir Wi‑Fi ya da kablolu ağa bağlı olmalı.</p>
        ) : pair.urls.length > 1 ? (
          <label className="flex flex-col gap-1.5">
            <span className="font-medium text-text-muted">Sunucu adresi</span>
            <select
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="h-10 rounded-md border border-border-strong bg-surface px-3 text-text"
            >
              {pair.urls.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
            <span className="text-xs text-text-subtle">Telefonun bağlı olduğu ağdaki adresi seç (genellikle 192.168… ile başlayan).</span>
          </label>
        ) : (
          <p className="text-text-muted">
            Sunucu adresi: <span className="font-medium text-text">{url}</span>
          </p>
        )}
        <p className="flex items-start gap-2 text-text-muted">
          <Smartphone className="mt-0.5 size-4 shrink-0" aria-hidden />
          Telefonun bu bilgisayarla aynı Wi‑Fi ağında olmalı. Windows güvenlik duvarı 4000 numaralı bağlantı noktasına izin vermeli.
        </p>
        <p className="text-xs text-text-subtle">Bu kod hesabına giriş sağlar; kimseyle paylaşma.</p>
        <Button variant="ghost" size="sm" className="self-start" onClick={() => setPair(null)}>
          Kodu gizle
        </Button>
      </div>
    </div>
  );
}
