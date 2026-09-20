"use client";

import {
  CalendarDays,
  Clock3,
  LayoutDashboard,
  Scissors,
  Users
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const navigation = [
  { href: "/", label: "Обзор", icon: LayoutDashboard },
  { href: "/appointments", label: "Записи", icon: CalendarDays },
  { href: "/clients", label: "Клиенты", icon: Users },
  { href: "/services", label: "Услуги", icon: Scissors },
  { href: "/schedule", label: "Расписание", icon: Clock3 }
] as const;

export function CrmShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/" aria-label="Danil Nails Studio, обзор">
          <span className="brand-mark">DN</span>
          <span className="brand-copy">
            <strong>Danil Nails</strong>
            <span>Studio CRM</span>
          </span>
        </Link>

        <nav className="nav-list" aria-label="Основная навигация">
          {navigation.map(({ href, label, icon: Icon }) => {
            const isActive =
              href === "/" ? pathname === href : pathname.startsWith(href);

            return (
              <Link
                className={`nav-item${isActive ? " nav-item-active" : ""}`}
                href={href}
                key={href}
              >
                <Icon aria-hidden="true" size={18} strokeWidth={1.8} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="account">
          <span className="account-avatar">ДА</span>
          <span>
            <strong>Данил Афлиатов</strong>
            <small>Владелец</small>
          </span>
        </div>
      </aside>

      <main className="main-content">{children}</main>
    </div>
  );
}
