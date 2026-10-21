/** Geri sayım: 1:05:09 ya da 05:09 */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Süre metni: "1 sa 5 dk", "42 dk", "40 sn" */
export function formatMinutes(ms: number): string {
  const totalMin = Math.round(ms / 60000);
  if (ms < 60000) return `${Math.max(0, Math.round(ms / 1000))} sn`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h ? `${h} sa${m ? ` ${m} dk` : ""}` : `${m} dk`;
}

const dateFormat = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

/** "21 Ekim 14:05" */
export function formatDate(iso: string): string {
  return dateFormat.format(new Date(iso));
}
