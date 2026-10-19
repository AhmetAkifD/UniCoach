import { Check, X } from "lucide-react";
import { PASSWORD_RULES } from "@unicoach/shared";
import { cn } from "@/lib/cn";

/** Şifre yazılırken altında görünen canlı kural listesi. Kurallar packages/shared'dan gelir. */
export function PasswordChecklist({ password, id }: { password: string; id?: string }) {
  return (
    <ul id={id} aria-live="polite" className="flex flex-col gap-1 rounded-md bg-surface-muted px-3.5 py-2.5 text-sm">
      {PASSWORD_RULES.map((rule) => {
        const ok = rule.test(password);
        return (
          <li key={rule.id} className={cn("flex items-center gap-2", ok ? "text-success" : "text-text-muted")}>
            {ok ? <Check className="size-4" aria-hidden /> : <X className="size-4" aria-hidden />}
            {rule.label}
            <span className="sr-only">{ok ? "karşılandı" : "karşılanmadı"}</span>
          </li>
        );
      })}
    </ul>
  );
}
