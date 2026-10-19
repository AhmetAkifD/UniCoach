// dist/index.js içindeki token'lardan Tailwind v4 için dist/theme.css üretir.
// Web uygulaması bu dosyayı `@import "@unicoach/design/theme.css";` ile kullanır.
import { createRequire } from "node:module";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { semantic, subjectColors, typography, radius, shadow, motion } = require("../dist/index.js");

const kebab = (s) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
const rem = (px) => `${px / 16}rem`;
const vars = (theme) =>
  Object.entries(semantic[theme])
    .map(([k, v]) => `  --uc-${kebab(k)}: ${v};`)
    .join("\n");

const css = `/* OTOMATİK ÜRETİLDİ — elle düzenlemeyin. Kaynak: packages/design/src/tokens.ts */

@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));

:root {
  color-scheme: light;
${vars("light")}
}

:root[data-theme="dark"] {
  color-scheme: dark;
${vars("dark")}
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    color-scheme: dark;
${vars("dark").replace(/^/gm, "  ")}
  }
}

@theme {
  --font-sans: var(--font-inter), "${typography.fontFamily.sans}", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "${typography.fontFamily.mono}", ui-monospace, monospace;
${Object.entries(typography.fontSize)
  .map(([k, [size, lh]]) => `  --text-${k}: ${rem(size)};\n  --text-${k}--line-height: ${rem(lh)};`)
  .join("\n")}
${Object.entries(radius)
  .filter(([k]) => k !== "full")
  .map(([k, v]) => `  --radius-${k}: ${rem(v)};`)
  .join("\n")}
${Object.entries(shadow)
  .map(([k, v]) => `  --shadow-${k}: ${v.css};`)
  .join("\n")}
  --ease-calm: ${motion.easing};
  --duration-fast: ${motion.fast}ms;
  --duration-base: ${motion.base}ms;
}

@theme inline {
${Object.keys(semantic.light)
  .map((k) => `  --color-${kebab(k)}: var(--uc-${kebab(k)});`)
  .join("\n")}
${Object.entries(subjectColors)
  .map(([k, v]) => `  --color-subject-${k}: ${v};`)
  .join("\n")}
}
`;

const out = join(here, "..", "dist", "theme.css");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, css);
console.log(`theme.css yazıldı → ${out}`);
