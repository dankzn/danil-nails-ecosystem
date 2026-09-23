import type { Metadata } from "next";
import { CrmShell } from "./ui/crm-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "Danil Nails Studio CRM",
  description: "Закрытая CRM Danil Nails Studio",
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nocache: true
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body>
        <CrmShell>{children}</CrmShell>
      </body>
    </html>
  );
}
