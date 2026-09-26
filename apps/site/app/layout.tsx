import type { Metadata } from "next";
import { Manrope, Playfair_Display } from "next/font/google";
import "./globals.css";

const displaySerif = Playfair_Display({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
  variable: "--font-display"
});

const bodySans = Manrope({
  subsets: ["latin", "cyrillic"],
  variable: "--font-body"
});

export const metadata: Metadata = {
  title: "Danil Nails Studio — премиальный маникюр в Москве",
  description:
    "Danil Nails Studio: приватная студия маникюра в Москве. Точная работа, стерильный протокол, запись через Telegram."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className={`${displaySerif.variable} ${bodySans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
