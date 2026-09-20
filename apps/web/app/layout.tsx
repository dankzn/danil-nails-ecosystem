import type { Metadata } from "next";
import { CrmShell } from "./ui/crm-shell";
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
      <body>
        <CrmShell>{children}</CrmShell>
      </body>
    </html>
  );
}
