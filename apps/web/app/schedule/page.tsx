import { bookingRules } from "@danil-nails/shared";
import { CalendarClock, CircleAlert, Plus } from "lucide-react";

const rules = [
  ["Запись вперёд", `${bookingRules.bookingHorizonDays} дней`],
  ["Минимум до визита", `${bookingRules.minimumLeadTimeMinutes / 60} часа`],
  ["Шаг начала записи", `${bookingRules.slotIntervalMinutes} минут`],
  ["Поздняя отмена", `менее ${bookingRules.lateCancellationWindowHours} часов`],
  ["Напоминание клиенту", "за 1 час"],
  ["Проверка записей на завтра", bookingRules.adminTomorrowReminderTime]
] as const;

export default function SchedulePage() {
  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Мастер · Данил</p>
          <h1>Расписание</h1>
          <p className="page-description">
            Рабочие часы, выходные, перерывы и исключения.
          </p>
        </div>
        <button className="primary-button" type="button">
          <Plus aria-hidden="true" size={18} />
          Добавить часы
        </button>
      </header>

      <section className="empty-schedule">
        <CalendarClock aria-hidden="true" size={28} strokeWidth={1.7} />
        <div>
          <h2>Рабочие часы пока не заданы</h2>
          <p>
            Макет не ограничивает дни и часы. Расписание можно будет заполнить,
            когда определится рабочий режим.
          </p>
        </div>
      </section>

      <section className="content-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <p className="section-kicker">Правила записи</p>
              <h2>Подтверждённые настройки</h2>
            </div>
          </div>
          <dl className="rules-list">
            {rules.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </article>

        <article className="panel reminder-panel">
          <CircleAlert aria-hidden="true" size={22} />
          <div>
            <p className="section-kicker">Следующее напоминание</p>
            <h2>Подготовить график на октябрь</h2>
            <p>
              За {bookingRules.scheduleReminderDaysBeforeMonth} дней до начала
              месяца, в {bookingRules.scheduleReminderTime} по Москве.
            </p>
          </div>
        </article>
      </section>
    </div>
  );
}
