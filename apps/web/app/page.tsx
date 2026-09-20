import { CalendarPlus, ChevronRight, CircleAlert } from "lucide-react";
import Link from "next/link";
import { initialServices } from "@danil-nails/shared";
import { mockAppointments, mockClients } from "./lib/mock-data";

export default function Home() {
  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Москва · 20 сентября 2026</p>
          <h1>Доброе утро, Данил</h1>
          <p className="page-description">
            Сегодня три записи, одна из них ждёт твоего подтверждения.
          </p>
        </div>
        <Link className="primary-button" href="/appointments">
          <CalendarPlus aria-hidden="true" size={18} />
          Создать запись
        </Link>
      </header>

      <section className="metric-grid" aria-label="Ключевые показатели">
        <article className="metric">
          <span className="metric-label">Записи сегодня</span>
          <strong className="metric-value">{mockAppointments.length}</strong>
          <span className="metric-note">4 ч 15 мин работы</span>
        </article>
        <article className="metric metric-attention">
          <span className="metric-label">Ждут действия</span>
          <strong className="metric-value">2</strong>
          <span className="metric-note">Модерация и подтверждение</span>
        </article>
        <article className="metric">
          <span className="metric-label">Клиенты</span>
          <strong className="metric-value">{mockClients.length}</strong>
          <span className="metric-note">Тестовая база</span>
        </article>
        <article className="metric">
          <span className="metric-label">Услуги</span>
          <strong className="metric-value">{initialServices.length}</strong>
          <span className="metric-note">Доступны для записи</span>
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

          <div className="appointment-list">
            {mockAppointments.map((appointment) => (
              <div className="appointment-row" key={appointment.id}>
                <div className="appointment-time">
                  <strong>{appointment.time}</strong>
                  <span>{appointment.duration}</span>
                </div>
                <div className="appointment-client">
                  <strong>{appointment.client}</strong>
                  <span>{appointment.service}</span>
                </div>
                <span className={`status status-${appointment.statusTone}`}>
                  {appointment.status}
                </span>
              </div>
            ))}
          </div>
        </article>

        <article className="panel attention-panel">
          <div className="panel-heading">
            <div>
              <p className="section-kicker">Контроль</p>
              <h2>Требует внимания</h2>
            </div>
          </div>
          <div className="attention-list">
            <div className="attention-item">
              <CircleAlert aria-hidden="true" size={20} />
              <div>
                <strong>Подтвердить новую запись</strong>
                <span>Анна Петрова, сегодня в 10:00</span>
              </div>
            </div>
            <div className="attention-item">
              <CircleAlert aria-hidden="true" size={20} />
              <div>
                <strong>График на октябрь не составлен</strong>
                <span>Заполнить до 20 сентября включительно</span>
              </div>
            </div>
          </div>
        </article>
      </section>
    </div>
  );
}
