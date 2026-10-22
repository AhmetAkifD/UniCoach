"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Trash2 } from "lucide-react";
import { ApiError, AVATAR_SIZE, type AuthUser } from "@unicoach/shared";
import { Button } from "@/components/ui/button";
import { browserApi } from "@/lib/api";
import { UserAvatar } from "@/components/user-avatar";

/** Seçilen dosya en fazla bu kadar olabilir; yine de yüklenmeden önce küçültülür. */
const SOURCE_MAX_BYTES = 15 * 1024 * 1024;

/** Resmi ortasından kare kırpıp `AVATAR_SIZE` boyutunda JPEG'e çevirir (sunucuya küçük dosya gider). */
async function toAvatarJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff"; // saydam PNG'ler siyah görünmesin
  ctx.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("toBlob"))), "image/jpeg", 0.88),
  );
}

export function AvatarEditor({ user }: { user: AuthUser }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (!file.type.startsWith("image/")) return setError("Bir resim dosyası seç (JPEG, PNG ya da WebP).");
    if (file.size > SOURCE_MAX_BYTES) return setError("Resim en fazla 15 MB olabilir.");
    setBusy(true);
    try {
      const blob = await toAvatarJpeg(file).catch(() => {
        throw new Error("Bu resim açılamadı. Başka bir dosya dene.");
      });
      const res = await fetch(browserApi.auth.avatarPath, { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: blob });
      if (!res.ok) throw new Error(((await res.json().catch(() => null)) as { message?: string } | null)?.message ?? "Fotoğraf yüklenemedi.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fotoğraf yüklenemedi.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await browserApi.auth.removeAvatar();
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Fotoğraf kaldırılamadı.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <UserAvatar user={user} className="size-20 text-2xl" />
      <div className="flex flex-col gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            void upload(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" loading={busy} onClick={() => inputRef.current?.click()}>
            <Camera className="size-4" aria-hidden /> {user.avatarUrl ? "Fotoğrafı değiştir" : "Fotoğraf yükle"}
          </Button>
          {user.avatarUrl && (
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => void remove()}>
              <Trash2 className="size-4" aria-hidden /> Kaldır
            </Button>
          )}
        </div>
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : (
          <p className="text-xs text-text-subtle">Resmin ortasından kare olarak kırpılır.</p>
        )}
      </div>
    </div>
  );
}
