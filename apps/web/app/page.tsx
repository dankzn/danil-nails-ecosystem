"use client";

import {
  CalendarPlus,
  ChevronRight,
  CircleAlert,
  Clock3
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "./lib/api";

type AppointmentStatus =
  | "draft"
  | "pending_admin_confirmation"
  | "confirmed"
  | "completed"
  | "canceled"
  | "rescheduled"
  | "no_show";

type Dashboard = {
  date: string;
  timezone: string;
  displayName: string | null;
  metrics: {
    appointmentsToday: number;
    busyMinutes: number;
    attention: number;
    clients: number;
    activeServices: number;
  };
  appointments: Array<{
    id: string;
    status: AppointmentStatus;
    startsAt: string;
    endsAt: string;
    client: { fullName: string | null; phone: string };
    service: { titleRu: string };
    staff: { displayName: string };
  }>;
  alerts: Array<{
    id: string;
    type:
      | "appointment_confirmation"
      | "attendance_confirmation"
      | "schedule_missing";
    startsAt: string;
    clientName: string;
    serviceName: string;
  }>;
};

const statusMeta: Record<
  AppointmentStatus,
  { label: string; tone: string }
> = {
  draft: { label: "Черновик", tone: "neutral" },
  pending_admin_confirmation: {
    label: "Ждёт подтверждения",
    tone: "warning"
  },
  confirmed: { label: "Подтверждена", tone: "success" },
  completed: { label: "Завершена", tone: "neutral" },
  canceled: { label: "Отменена", tone: "danger" },
  rescheduled: { label: "Перенесена", tone: "info" },
  no_show: { label: "Неявка", tone: "danger" }
};

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  timeZone: "UTC",
  day: "numeric",
  month: "long",
  year: "numeric"
});
const timeFormatter = new Intl.DateTimeFormat("ru-RU", {
  timeZone: "Europe/Moscow",
  hour: "2-digit",
  minute: "2-digit"
});

function formatBusyTime(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest} мин`;
  return rest ? `${hours} ч ${rest} мин` : `${hours} ч`;
}

function durationLabel(startsAt: string, endsAt: string) {
  const minutes = Math.round(
    (new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60000
  );
  return `${minutes} мин`;
}

function greeting() {
  const hour = Number(
    new Intl.DateTimeFormat("en", {
      timeZone: "Europe/Moscow",
      hour: "2-digit",
      hourCycle: "h23"
    }).format(new Date())
  );
  if (hour < 12) return "Доброе утро";
  if (hour < 18) return "Добрый день";
  return "Добрый вечер";
}

function alertCopy(alert: Dashboard["alerts"][number]) {
  if (alert.type === "schedule_missing") {
    return {
      title: alert.clientName,
      detail: alert.serviceName,
      href: "/schedule"
    };
  }
  const time = timeFormatter.format(new Date(alert.startsAt));
  return {
    title:
      alert.type === "appointment_confirmation"
        ? "Подтвердить новую запись"
        : "Проверить ответ клиента",
    detail: `${alert.clientName}, ${time} · ${alert.serviceName}`,
    href: "/appointments"
  };
}

export default function Home() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setDashboard(await apiRequest<Dashboard>("/v1/admin/dashboard"));
    } catch {
      setError("Не удалось загрузить сводку CRM.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const name = dashboard?.displayName?.split(" ")[0] ?? "Данил";
  const date = dashboard
    ? dateFormatter.format(new Date(`${dashboard.date}T12:00:00.000Z`))
    : "Сегодня";

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Москва · {date}</p>
          <h1>
            {greeting()}, {name}
          </h1>
          <p className="page-description">
            {dashboard?.metrics.appointmentsToday
              ? `Сегодня ${dashboard.metrics.appointmentsToday} записей, ${dashboard.metrics.attention} требуют внимания.`
              : "На сегодня активных записей нет."}
          </p>
        </div>
        <Link className="primary-button" href="/appointments">
          <CalendarPlus aria-hidden="true" size={18} />
          Создать запись
        </Link>
      </header>

      {error ? (
        <div className="feedback feedback-error dashboard-error" role="alert">
          <span>{error}</span>
          <button
            className="secondary-button"
            onClick={() => void loadDashboard()}
            type="button"
          >
            Повторить
          </button>
        </div>
      ) : null}

      <section className="metric-grid" aria-label="Ключевые показатели">
        <article className="metric">
          <span className="metric-label">Записи сегодня</span>
          <strong className="metric-value">
            {isLoading ? "…" : dashboard?.metrics.appointmentsToday ?? 0}
          </strong>
          <span className="metric-note">
            {isLoading
              ? "Загружаем данные"
              : `${formatBusyTime(dashboard?.metrics.busyMinutes ?? 0)} работы`}
          </span>
        </article>
        <article className="metric metric-attention">
          <span className="metric-label">Ждут действия</span>
          <strong className="metric-value">
            {isLoading ? "…" : dashboard?.metrics.attention ?? 0}
          </strong>
          <span className="metric-note">Модерация, ответы и график</span>
        </article>
        <article className="metric">
          <span className="metric-label">Клиенты</span>
          <strong className="metric-value">
            {isLoading ? "…" : dashboard?.metrics.clients ?? 0}
          </strong>
          <span className="metric-note">В базе CRM</span>
        </article>
        <article className="metric">
          <span className="metric-label">Услуги</span>
          <strong className="metric-value">
            {isLoading ? "…" : dashboard?.metrics.activeServices ?? 0}
          </strong>
          <span className="metric-note">Активны для записи</span>
        </article>
      </section>

      <section className="content-grid content-grid-wide">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <p className="section-kicker">Сегодня</p>
              <h2>Ближайшие записи</h2>
            </div>
            <Link className="text-link" href="/appointments">
              Все записи
              <ChevronRight aria-hidden="true" size={16} />
            </Link>
          </div>

          {isLoading ? (
            <div className="dashboard-loading" role="status">
              Загружаем записи…
            </div>
          ) : dashboard?.appointments.length ? (
            <div className="appointment-list">
              {dashboard.appointments.slice(0, 5).map((appointment) => {
                const meta = statusMeta[appointment.status];
                return (
                  <div className="appointment-row" key={appointment.id}>
                    <div className="appointment-time">
                      <strong>
                        {timeFormatter.format(new Date(appointment.startsAt))}
                      </strong>
                      <span>
                        {durationLabel(appointment.startsAt, appointment.endsAt)}
                      </span>
                    </div>
                    <div className="appointment-client">
                      <strong>
                        {appointment.client.fullName ?? appointment.client.phone}
                      </strong>
                      <span>{appointment.service.titleRu}</span>
                    </div>
                    <span className={`status status-${meta.tone}`}>
                      {meta.label}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="dashboard-empty">
              <Clock3 aria-hidden="true" size={22} />
              <div>
                <strong>Сегодня свободно</strong>
                <span>Новые записи появятся здесь автоматически.</span>
              </div>
            </div>
          )}
        </article>

        <article className="panel attention-panel">
          <div className="panel-heading">
            <div>
              <p className="section-kicker">Контроль</p>
              <h2>Требует внимания</h2>
            </div>
          </div>
          {isLoading ? (
            <div className="dashboard-loading" role="status">
              Проверяем задачи…
            </div>
          ) : dashboard?.alerts.length ? (
            <div className="attention-list">
              {dashboard.alerts.slice(0, 6).map((alert) => {
                const copy = alertCopy(alert);
                return (
                  <Link className="attention-item" href={copy.href} key={alert.id}>
                    <CircleAlert aria-hidden="true" size={20} />
                    <div>
                      <strong>{copy.title}</strong>
                      <span>{copy.detail}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="dashboard-empty dashboard-empty-compact">
              <span>Нет задач, требующих внимания.</span>
            </div>
          )}
        </article>
      </section>
    </div>
  );
}
