import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Danil Nails Studio CRM",
  description: "CRM, booking and client cabinet for Danil Nails Studio"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}

