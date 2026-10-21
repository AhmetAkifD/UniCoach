"use client";

import { useRef, useState, useTransition, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, FileText, Loader2, ShieldCheck, TriangleAlert, Upload } from "lucide-react";
import { ApiError, ResultParseError, type ParsedYksResult } from "@unicoach/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useDialog } from "@/components/ui/use-dialog";
import { browserApi } from "@/lib/api";
import { cn } from "@/lib/cn";
import { readResultPdf } from "@/lib/yks-result-pdf";
import { ResultSummary } from "./result-summary";

const normalizeName = (name: string) => name.toLocaleUpperCase("tr-TR").replace(/\s+/g, " ").trim();

/** Sonuç belgesini tarayıcıda okur, önizletir; öğrenci onaylayınca yalnızca puanlar kaydedilir. */
export function ResultImport({ savedYears, accountName }: { savedYears: number[]; accountName: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [reading, setReading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedYksResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const { confirm, dialog } = useDialog();

  async function pick(file: File | undefined) {
    if (!file) return;
    setError(null);
    setParsed(null);
    setFileName(file.name);
    if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) {
      setError("Yalnızca PDF dosyası seçebilirsin.");
      return;
    }
    setReading(true);
    try {
      setParsed(await readResultPdf(file));
    } catch (err) {
      setError(err instanceof ResultParseError ? err.message : "Belge okunamadı.");
    } finally {
      setReading(false);
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    void pick(e.dataTransfer.files[0]);
  }

  function reset() {
    setParsed(null);
    setFileName(null);
    setError(null);
  }

  async function save() {
    if (!parsed) return;
    if (
      savedYears.includes(parsed.year) &&
      !(await confirm({
        title: `${parsed.year} sonucu zaten kayıtlı`,
        message: "Kayıtlı sonucun bu belgedeki değerlerle değiştirilecek.",
        confirmLabel: "Değiştir",
      }))
    ) {
      return;
    }
    startSaving(async () => {
      try {
        // Ad soyad gönderilmez; yalnızca puanlar, sıralar, OBP ve netler.
        const { year, diplomaGrade, obp, scores, tests } = parsed;
        await browserApi.results.save(year, { source: "document", diplomaGrade, obp, scores, tests });
        reset();
        router.refresh();
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Sonuç kaydedilemedi.");
      }
    });
  }

  const nameMismatch = parsed?.fullName && normalizeName(parsed.fullName) !== normalizeName(accountName);

  return (
    <div className="flex flex-col gap-4">
      {dialog}
      <Card className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h3 className="font-semibold">ÖSYM sonuç belgen</h3>
          <p className="text-sm text-text-muted">
            ÖSYM Sonuç Açıklama Sistemi'nde YKS sonucunu aç ve sayfayı PDF olarak kaydet (Yazdır → PDF olarak kaydet).
          </p>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => {
            void pick(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          disabled={reading || saving}
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            "flex items-center gap-3 rounded-lg border border-dashed px-4 py-4 text-left transition-colors duration-fast",
            dragging ? "border-primary bg-primary-soft" : "border-border-strong hover:border-primary",
            error && "border-danger",
            "disabled:pointer-events-none",
          )}
        >
          {reading ? (
            <Loader2 className="size-8 shrink-0 animate-spin text-primary" strokeWidth={1.75} aria-hidden />
          ) : fileName ? (
            <FileText className="size-8 shrink-0 text-primary" strokeWidth={1.75} aria-hidden />
          ) : (
            <Upload className="size-8 shrink-0 text-text-subtle" strokeWidth={1.75} aria-hidden />
          )}
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-medium">{fileName ?? "Sonuç belgeni seç ya da buraya sürükle"}</span>
            <span className="text-sm text-text-muted">{reading ? "Belge okunuyor…" : fileName ? "Başka bir belge seç" : "PDF"}</span>
          </span>
        </button>

        <p className="flex items-start gap-2 text-xs text-text-subtle">
          <ShieldCheck className="size-4 shrink-0" aria-hidden />
          Belge tarayıcında okunur ve hiçbir yere yüklenmez. Yalnızca puanların, sıraların, OBP'n ve netlerin kaydedilir;
          T.C. kimlik numaran ve adın gönderilmez.
        </p>

        {error && (
          <div role="alert" className="flex items-start gap-2 rounded-md bg-danger-soft px-3.5 py-3 text-sm text-danger">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            {error}
          </div>
        )}
      </Card>

      {parsed && (
        <section className="flex flex-col gap-4" aria-labelledby="preview-title">
          <div className="flex flex-wrap items-center gap-3">
            <h3 id="preview-title" className="text-lg font-semibold tracking-tight">
              {parsed.year} YKS sonucu
            </h3>
            <Badge tone="info">Önizleme</Badge>
          </div>
          {nameMismatch && (
            <div className="flex items-start gap-2 rounded-md bg-warning-soft px-3.5 py-3 text-sm text-warning">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              Belgedeki ad hesabındaki adla eşleşmiyor. Kendi belgeni seçtiğinden emin ol.
            </div>
          )}
          <ResultSummary result={parsed} />
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={reset} disabled={saving}>
              Vazgeç
            </Button>
            <Button onClick={() => void save()} loading={saving}>
              Sonucu kaydet
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
