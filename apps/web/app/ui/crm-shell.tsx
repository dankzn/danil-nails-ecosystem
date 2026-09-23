"use client";

import {
  CalendarDays,
  Clock3,
  ContactRound,
  LayoutDashboard,
  LogOut,
  Scissors,
  Users
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

const navigation = [
  { href: "/", label: "Обзор", icon: LayoutDashboard, ownerOnly: false },
  { href: "/appointments", label: "Записи", icon: CalendarDays, ownerOnly: false },
  { href: "/clients", label: "Клиенты", icon: Users, ownerOnly: false },
  { href: "/employees", label: "Сотрудники", icon: ContactRound, ownerOnly: true },
  { href: "/services", label: "Услуги", icon: Scissors, ownerOnly: false },
  { href: "/schedule", label: "Расписание", icon: Clock3, ownerOnly: false }
] as const;

export function CrmShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const activeNavItemRef = useRef<HTMLAnchorElement>(null);
  const [user, setUser] = useState<{
    displayName: string | null;
    email: string | null;
    role: string;
  } | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(pathname !== "/login");
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

  useEffect(() => {
    if (pathname === "/login") {
      setIsCheckingSession(false);
      return;
    }

    const controller = new AbortController();

    async function checkSession() {
      try {
        const response = await fetch(`${apiUrl}/v1/auth/me`, {
          credentials: "include",
          signal: controller.signal
        });

        if (!response.ok) {
          router.replace("/login");
          return;
        }

        const body = (await response.json()) as {
          user: {
            displayName: string | null;
            email: string | null;
            role: string;
          };
        };
        setUser(body.user);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          router.replace("/login");
        }
      } finally {
        setIsCheckingSession(false);
      }
    }

    void checkSession();
    return () => controller.abort();
  }, [apiUrl, pathname, router]);

  useEffect(() => {
    if (window.matchMedia("(max-width: 760px)").matches) {
      activeNavItemRef.current?.scrollIntoView({
        behavior: "instant",
        block: "nearest",
        inline: "center"
      });
    }
  }, [pathname, user]);

  async function logout() {
    await fetch(`${apiUrl}/v1/auth/logout`, {
      method: "POST",
      credentials: "include"
    });
    setUser(null);
    router.replace("/login");
  }

  if (pathname === "/login") {
    return children;
  }

  if (isCheckingSession || !user) {
    return (
      <div className="auth-loading" role="status">
        <span className="brand-mark">DN</span>
        <span>Проверяем доступ к CRM…</span>
      </div>
    );
  }

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
          {navigation
            .filter((item) => !item.ownerOnly || user.role === "owner")
            .map(({ href, label, icon: Icon }) => {
            const isActive =
              href === "/" ? pathname === href : pathname.startsWith(href);

            return (
              <Link
                className={`nav-item${isActive ? " nav-item-active" : ""}`}
                href={href}
                key={href}
                ref={isActive ? activeNavItemRef : undefined}
              >
                <Icon aria-hidden="true" size={18} strokeWidth={1.8} />
                <span>{label}</span>
              </Link>
            );
            })}
        </nav>

        <div className="account">
          <span className="account-avatar">ДА</span>
          <span className="account-copy">
            <strong>{user.displayName ?? user.email ?? "Владелец"}</strong>
            <small>{user.role === "owner" ? "Владелец" : user.role}</small>
          </span>
          <button
            aria-label="Выйти из CRM"
            className="icon-button icon-button-dark"
            onClick={() => void logout()}
            title="Выйти"
            type="button"
          >
            <LogOut aria-hidden="true" size={17} />
          </button>
        </div>
      </aside>

      <main className="main-content">{children}</main>
    </div>
  );
}
