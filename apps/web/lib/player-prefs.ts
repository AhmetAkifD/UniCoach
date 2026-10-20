"use client";

/** Oynatıcı tercihleri (hız, ses) bu tarayıcıda hatırlanır. Depolama kapalıysa varsayılanlar kullanılır. */
export interface PlayerPrefs {
  rate: number;
  volume: number;
  muted: boolean;
}

const KEY = "uc-player";
const DEFAULTS: PlayerPrefs = { rate: 1, volume: 100, muted: false };

export function loadPlayerPrefs(): PlayerPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<PlayerPrefs>) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

export function savePlayerPrefs(patch: Partial<PlayerPrefs>) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...loadPlayerPrefs(), ...patch }));
  } catch {
    // Gizli pencere vb.: tercih yalnızca bu oturumda geçerli kalır.
  }
}
