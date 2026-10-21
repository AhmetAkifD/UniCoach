"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "./button";
import { Input } from "./input";

interface DialogOptions {
  title: string;
  message?: ReactNode;
  /** Onay düğmesinin metni (varsayılan "Tamam") */
  confirmLabel?: string;
  /** Silme gibi geri alınamayan işlemlerde onay düğmesi kırmızı olur. */
  danger?: boolean;
}

type Request =
  | (DialogOptions & { kind: "confirm"; resolve: (ok: boolean) => void })
  | (DialogOptions & { kind: "alert"; resolve: (ok: boolean) => void })
  | (DialogOptions & { kind: "prompt"; defaultValue: string; placeholder?: string; resolve: (value: string | null) => void });

/**
 * Sayfa içi onay/soru pencereleri. Tarayıcının `confirm`/`prompt`/`alert` kutuları yerine kullanılır:
 * uygulama içi tarayıcılar ve bazı mobil tarayıcılar bu kutuları göstermeyip "iptal" sayabiliyor.
 * Kullanım: `const { confirm, dialog } = useDialog();` ve bileşende `{dialog}` çizilir.
 */
export function useDialog() {
  const [request, setRequest] = useState<Request | null>(null);

  const confirm = useCallback(
    (options: DialogOptions) => new Promise<boolean>((resolve) => setRequest({ ...options, kind: "confirm", resolve })),
    [],
  );
  const alert = useCallback(
    (options: DialogOptions) =>
      new Promise<void>((resolve) => setRequest({ ...options, kind: "alert", resolve: () => resolve() })),
    [],
  );
  const prompt = useCallback(
    (options: DialogOptions & { defaultValue?: string; placeholder?: string }) =>
      new Promise<string | null>((resolve) =>
        setRequest({ ...options, kind: "prompt", defaultValue: options.defaultValue ?? "", resolve }),
      ),
    [],
  );

  const dialog = request ? (
    <DialogView
      key={request.title}
      request={request}
      onDone={(value) => {
        setRequest(null);
        if (request.kind === "prompt") request.resolve(value as string | null);
        else request.resolve(value as boolean);
      }}
    />
  ) : null;

  return { confirm, alert, prompt, dialog };
}

function DialogView({ request, onDone }: { request: Request; onDone: (value: boolean | string | null) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const [value, setValue] = useState(request.kind === "prompt" ? request.defaultValue : "");

  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    if (request.kind === "prompt") inputRef.current?.select();
    else confirmRef.current?.focus();
    return () => dialog?.close();
  }, [request.kind]);

  const cancel = () => onDone(request.kind === "prompt" ? null : request.kind === "alert");
  function submit(e: FormEvent) {
    e.preventDefault();
    if (request.kind === "prompt") onDone(value.trim() || null);
    else onDone(true);
  }

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        cancel();
      }}
      aria-labelledby="ui-dialog-title"
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-border bg-surface p-0 text-text shadow-raised backdrop:bg-black/50"
    >
      <form onSubmit={submit} className="flex flex-col gap-4 p-6 text-left">
        <h2 id="ui-dialog-title" className="text-lg font-semibold tracking-tight">
          {request.title}
        </h2>
        {request.message && <div className="text-sm text-text-muted">{request.message}</div>}
        {request.kind === "prompt" && (
          <Input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={request.placeholder ?? request.title}
            maxLength={60}
          />
        )}
        <div className="flex justify-end gap-3">
          {request.kind !== "alert" && (
            <Button type="button" variant="ghost" onClick={cancel}>
              Vazgeç
            </Button>
          )}
          <Button ref={confirmRef} type="submit" variant={request.danger ? "danger" : "primary"}>
            {request.confirmLabel ?? "Tamam"}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
