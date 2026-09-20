import { CalendarPlus } from "lucide-react";
import { mockAppointments } from "../lib/mock-data";

export default function AppointmentsPage() {
  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Рабочий день</p>
          <h1>Записи</h1>
          <p className="page-description">
            Воскресенье, 20 сентября · Europe/Moscow
          </p>
        </div>
        <button className="primary-button" type="button">
          <CalendarPlus aria-hidden="true" size={18} />
          Новая запись
        </button>
      </header>

      <section className="calendar-summary" aria-label="Сводка дня">
        <div>
          <span>Рабочее время</span>
          <strong>Не задано</strong>
        </div>
        <div>
          <span>Занято</span>
          <strong>4 ч 15 мин</strong>
        </div>
        <div>
          <span>Перерывы</span>
          <strong>Нет</strong>
        </div>
      </section>

      <section className="panel schedule-board">
        <div className="panel-heading">
          <div>
            <p className="section-kicker">Расписание дня</p>
            <h2>20 сентября</h2>
          </div>
          <span className="muted-label">3 записи</span>
        </div>

        <div className="day-agenda">
          {mockAppointments.map((appointment) => (
            <article className="agenda-item" key={appointment.id}>
              <div className="agenda-time">
                <strong>{appointment.time}</strong>
                <span>{appointment.duration}</span>
              </div>
              <div className="agenda-line" aria-hidden="true" />
              <div className="agenda-content">
                <div>
                  <strong>{appointment.client}</strong>
                  <span>{appointment.service}</span>
                  <small>{appointment.phone}</small>
                </div>
                <span className={`status status-${appointment.statusTone}`}>
                  {appointment.status}
                </span>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
