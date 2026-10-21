"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDialog } from "@/components/ui/use-dialog";
import { browserApi } from "@/lib/api";

export function DeleteResultButton({ year }: { year: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { confirm, alert, dialog } = useDialog();

  async function remove() {
    const ok = await confirm({
      title: `${year} sonucunu sil`,
      message: "Bu yılın puanları, sıraları ve netleri silinecek. Belgeyi yeniden yükleyerek geri ekleyebilirsin.",
      confirmLabel: "Sil",
      danger: true,
    });
    if (!ok) return;
    startTransition(async () => {
      try {
        await browserApi.results.remove(year);
        router.refresh();
      } catch {
        await alert({ title: "Sonuç silinemedi", message: "Bir sorun oldu, biraz sonra tekrar dene." });
      }
    });
  }

  return (
    <>
      {dialog}
      <Button variant="ghost" size="sm" onClick={() => void remove()} loading={pending}>
        <Trash2 className="size-4" aria-hidden /> Sil
      </Button>
    </>
  );
}
