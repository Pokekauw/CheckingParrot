import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "PARROT//BUDDY · terminal-tamagotchi",
  description:
    "Pas din egen hacker-papegøje i Parrot OS-æstetik. Fodr, leg, træn og levellér — med en skjult diagnose-bagside.",
};

export const viewport: Viewport = {
  themeColor: "#02080a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="da">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-ink-950 text-bone antialiased">{children}</body>
    </html>
  );
}