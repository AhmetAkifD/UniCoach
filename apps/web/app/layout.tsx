import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import { themeInitScript } from "@/components/theme-toggle";
import "./globals.css";

const inter = Inter({ subsets: ["latin", "latin-ext"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: { default: "UniCoach", template: "%s · UniCoach" },
  description: "YKS ve LGS öğrencileri için konu anlatımı, soru bankası, deneme sınavları ve tercih robotu.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-dvh">
        <SiteHeader />
        <main className="mx-auto max-w-[1200px] px-4 py-8 md:px-8 md:py-10">{children}</main>
      </body>
    </html>
  );
}
