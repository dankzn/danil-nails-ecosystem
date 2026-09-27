import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const grotesk = localFont({
  src: [
    {
      path: "./fonts/danil-studio-quiet/DanilStudioQuiet-Regular.woff2",
      weight: "400",
      style: "normal"
    },
    {
      path: "./fonts/danil-studio-quiet/DanilStudioQuiet-Medium.woff2",
      weight: "500",
      style: "normal"
    },
    {
      path: "./fonts/danil-studio-quiet/DanilStudioQuiet-Semibold.woff2",
      weight: "600",
      style: "normal"
    },
    {
      // No bold cut exists yet — serve Semibold for 700 so the browser
      // doesn't synthesize a fake-bold (looks off on a custom display face).
      path: "./fonts/danil-studio-quiet/DanilStudioQuiet-Semibold.woff2",
      weight: "700",
      style: "normal"
    }
  ],
  variable: "--font-grotesk",
  display: "swap"
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
