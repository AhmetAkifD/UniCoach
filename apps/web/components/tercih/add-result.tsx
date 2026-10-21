"use client";

import { useState } from "react";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { ResultForm } from "./result-form";
import { ResultImport } from "./result-import";

type Method = "document" | "manual";

/** Yeni sonuç: belgeden okuma ya da elle giriş. */
export function AddResult({ savedYears, accountName }: { savedYears: number[]; accountName: string }) {
  const [method, setMethod] = useState<Method>("document");
  return (
    <section className="flex flex-col gap-4" aria-labelledby="add-result-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <h2 id="add-result-title" className="text-xl font-semibold tracking-tight">
          {savedYears.length ? "Başka bir sonuç ekle" : "Sonucunu ekle"}
        </h2>
        <div className="sm:w-80">
          <SegmentedControl<Method>
            label="Nasıl ekleyeceksin?"
            value={method}
            onChange={setMethod}
            options={[
              { value: "document", label: "Sonuç belgesinden" },
              { value: "manual", label: "Elle gir" },
            ]}
          />
        </div>
      </div>
      {method === "document" ? (
        <ResultImport savedYears={savedYears} accountName={accountName} />
      ) : (
        <ResultForm savedYears={savedYears} />
      )}
    </section>
  );
}
