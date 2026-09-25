"use client";

import {
  BookOpen,
  CalendarDays,
  ChevronDown,
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
import { apiUrl } from "../lib/api-url";

type NavLeaf = { href: string; label: string };
type NavItem = {
  href?: string;
  label: string;
  icon: typeof LayoutDashboard;
  ownerOnly: boolean;
  items?: NavLeaf[];
};

const navigation: NavItem[] = [
  { href: "/", label: "Обзор", icon: LayoutDashboard, ownerOnly: false },
  { href: "/appointments", label: "Записи", icon: CalendarDays, ownerOnly: false },
  { href: "/clients", label: "Клиенты", icon: Users, ownerOnly: false },
  {
    label: "Персонал",
    icon: ContactRound,
    ownerOnly: true,
    items: [
      { href: "/employees", label: "Сотрудники" },
      { href: "/staff-structure", label: "Структура подразделений" },
      { href: "/staff-managers", label: "Руководители" }
    ]
  },
  { href: "/services", label: "Услуги", icon: Scissors, ownerOnly: false },
  { href: "/schedule", label: "Расписание", icon: Clock3, ownerOnly: false },
  { href: "/directories", label: "Справочники", icon: BookOpen, ownerOnly: true }
];

function isNavItemActive(item: NavItem, normalizedPathname: string) {
  if (item.href) {
    return item.href === "/"
      ? normalizedPathname === item.href
      : normalizedPathname.startsWith(item.href);
  }
  return (item.items ?? []).some((leaf) => normalizedPathname.startsWith(leaf.href));
}

export function CrmShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const normalizedPathname =
    pathname === "/" ? pathname : pathname.replace(/\/+$/, "");
  const isLoginPage = normalizedPathname === "/login";
  const router = useRouter();
  const activeNavItemRef = useRef<HTMLAnchorElement>(null);
  const [user, setUser] = useState<{
    displayName: string | null;
    email: string | null;
    role: string;
  } | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(!isLoginPage);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  useEffect(() => {
    if (isLoginPage) {
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
  }, [apiUrl, isLoginPage, router]);

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

  if (isLoginPage) {
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
            .map((item) => {
              const isActive = isNavItemActive(item, normalizedPathname);
              const Icon = item.icon;

              if (!item.items) {
                return (
                  <Link
                    className={`nav-item${isActive ? " nav-item-active" : ""}`}
                    href={item.href!}
                    key={item.href}
                    ref={isActive ? activeNavItemRef : undefined}
                  >
                    <Icon aria-hidden="true" size={18} strokeWidth={1.8} />
                    <span>{item.label}</span>
                  </Link>
                );
              }

              const isOpen = openGroups[item.label] ?? isActive;

              return (
                <div className="nav-group" key={item.label}>
                  <button
                    aria-expanded={isOpen}
                    className={`nav-item nav-group-toggle${isActive ? " nav-item-active" : ""}`}
                    onClick={() =>
                      setOpenGroups((current) => ({
                        ...current,
                        [item.label]: !isOpen
                      }))
                    }
                    type="button"
                  >
                    <Icon aria-hidden="true" size={18} strokeWidth={1.8} />
                    <span>{item.label}</span>
                    <ChevronDown
                      aria-hidden="true"
                      className={`nav-group-chevron${isOpen ? " nav-group-chevron-open" : ""}`}
                      size={15}
                      strokeWidth={1.8}
                    />
                  </button>
                  {isOpen ? (
                    <div className="nav-sublist">
                      {item.items.map((leaf) => {
                        const isLeafActive = normalizedPathname.startsWith(leaf.href);
                        return (
                          <Link
                            className={`nav-subitem${isLeafActive ? " nav-item-active" : ""}`}
                            href={leaf.href}
                            key={leaf.href}
                            ref={isLeafActive ? activeNavItemRef : undefined}
                          >
                            <span>{leaf.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
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
