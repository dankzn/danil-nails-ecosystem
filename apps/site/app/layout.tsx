import type { Metadata } from "next";
import { Golos_Text } from "next/font/google";
import "./globals.css";

const grotesk = Golos_Text({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-grotesk"
});

export const metadata: Metadata = {
  title: "Danil Nails Studio",
  description: "Danil Nails Studio"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className={grotesk.variable}>
      <body>{children}</body>
    </html>
  );
}
