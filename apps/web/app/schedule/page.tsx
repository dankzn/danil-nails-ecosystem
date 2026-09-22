"use client";

import { bookingRules } from "@danil-nails/shared";
import {
  CalendarClock,
  CircleAlert,
  Clock3,
  Plus,
  Trash2
} from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ApiError, apiRequest } from "../lib/api";
import { Modal } from "../ui/modal";

type Staff = { id: string; displayName: string };
type WorkingHour = {
  id: string;
  weekday: number;
  startsAt: string;
  endsAt: string;
};
type ScheduleException = {
  id: string;
  startsAt: string;
  endsAt: string;
  reason: string | null;
  isBookable: boolean;
};
type ScheduleResponse = {
  timezone: string;
  staff: Staff[];
  selectedStaffId: string;
  workingHours: WorkingHour[];
  exceptions: ScheduleException[];
};
type Interval = { startsAt: string; endsAt: string };
type DaySchedule = {
  weekday: number;
  label: string;
  shortLabel: string;
  enabled: boolean;
  intervals: Interval[];
};
type ExceptionForm = {
  kind: "unavailable" | "bookable";
  startDate: string;
  endDate: string;
  allDay: boolean;
  startsAt: string;
  endsAt: string;
  reason: string;
};

const weekdays = [
  [1, "Понедельник", "Пн"],
  [2, "Вторник", "Вт"],
  [3, "Среда", "Ср"],
  [4, "Четверг", "Чт"],
  [5, "Пятница", "Пт"],
  [6, "Суббота", "Сб"],
  [7, "Воскресенье", "Вс"]
] as const;

const rules = [
  ["Запись вперёд", `${bookingRules.bookingHorizonDays} дней`],
  ["Минимум до визита", `${bookingRules.minimumLeadTimeMinutes / 60} часа`],
  ["Шаг начала записи", `${bookingRules.slotIntervalMinutes} минут`],
  ["Поздняя отмена", `менее ${bookingRules.lateCancellationWindowHours} часов`],
  ["Напоминание клиенту", "за 1 час"],
  ["Проверка записей на завтра", bookingRules.adminTomorrowReminderTime]
] as const;

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  timeZone: "Europe/Moscow",
  day: "numeric",
  month: "long",
  year: "numeric"
});
const shortDateFormatter = new Intl.DateTimeFormat("ru-RU", {
  timeZone: "Europe/Moscow",
  day: "numeric",
  month: "short"
});
const timeFormatter = new Intl.DateTimeFormat("ru-RU", {
  timeZone: "Europe/Moscow",
  hour: "2-digit",
  minute: "2-digit"
});

function moscowDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function emptyExceptionForm(): ExceptionForm {
  const today = moscowDateKey();
  return {
    kind: "unavailable",
    startDate: today,
    endDate: today,
    allDay: true,
    startsAt: "13:00",
    endsAt: "14:00",
    reason: ""
  };
}

function buildWeek(hours: WorkingHour[]): DaySchedule[] {
  return weekdays.map(([weekday, label, shortLabel]) => {
    const intervals = hours
      .filter((hour) => hour.weekday === weekday)
      .map(({ startsAt, endsAt }) => ({ startsAt, endsAt }));
    return {
      weekday,
      label,
      shortLabel,
      enabled: intervals.length > 0,
      intervals: intervals.length ? intervals : [{ startsAt: "10:00", endsAt: "20:00" }]
    };
  });
}

function scheduleErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === "schedule_exception_conflict") {
      return "На это время уже добавлено другое исключение.";
    }
    if (error.status === 401 || error.status === 403) {
      return "Недостаточно прав или сессия завершилась. Обновите страницу.";
    }
  }
  return "Не удалось сохранить изменения. Проверьте данные и попробуйте снова.";
}

function exceptionLabel(exception: ScheduleException) {
  const startsAt = new Date(exception.startsAt);
  const endsAt = new Date(exception.endsAt);
  const startTime = timeFormatter.format(startsAt);
  const endTime = timeFormatter.format(endsAt);
  const isAllDay =
    startTime === "00:00" &&
    endTime === "00:00" &&
    endsAt.getTime() - startsAt.getTime() >= 86400000;

  if (isAllDay) {
    const inclusiveEnd = new Date(endsAt.getTime() - 1);
    const sameDay = moscowDateKey(startsAt) === moscowDateKey(inclusiveEnd);
    return sameDay
      ? dateFormatter.format(startsAt)
      : `${shortDateFormatter.format(startsAt)} – ${dateFormatter.format(inclusiveEnd)}`;
  }

  const sameDay = moscowDateKey(startsAt) === moscowDateKey(endsAt);
  return sameDay
    ? `${shortDateFormatter.format(startsAt)}, ${startTime}–${endTime}`
    : `${shortDateFormatter.format(startsAt)}, ${startTime} – ${shortDateFormatter.format(endsAt)}, ${endTime}`;
}

export default function SchedulePage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [week, setWeek] = useState<DaySchedule[]>(() => buildWeek([]));
  const [exceptions, setExceptions] = useState<ScheduleException[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isExceptionOpen, setIsExceptionOpen] = useState(false);
  const [exceptionToDelete, setExceptionToDelete] =
    useState<ScheduleException | null>(null);
  const [exceptionForm, setExceptionForm] = useState<ExceptionForm>(() =>
    emptyExceptionForm()
  );

  const loadSchedule = useCallback(async (staffId?: string) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await apiRequest<ScheduleResponse>(
        `/v1/admin/schedule${staffId ? `?staffId=${staffId}` : ""}`
      );
      setStaff(response.staff);
      setSelectedStaffId(response.selectedStaffId);
      setWeek(buildWeek(response.workingHours));
      setExceptions(response.exceptions);
    } catch {
      setLoadError("Не удалось загрузить расписание.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSchedule();
  }, [loadSchedule]);

  function updateDay(weekday: number, update: (day: DaySchedule) => DaySchedule) {
    setWeek((current) =>
      current.map((day) => (day.weekday === weekday ? update(day) : day))
    );
  }

  function updateInterval(
    weekday: number,
    index: number,
    field: keyof Interval,
    value: string
  ) {
    updateDay(weekday, (day) => ({
      ...day,
      intervals: day.intervals.map((interval, intervalIndex) =>
        intervalIndex === index ? { ...interval, [field]: value } : interval
      )
    }));
  }

  function addInterval(weekday: number) {
    updateDay(weekday, (day) => ({
      ...day,
      intervals: [...day.intervals, { startsAt: "13:00", endsAt: "14:00" }]
    }));
  }

  function removeInterval(weekday: number, index: number) {
    updateDay(weekday, (day) => ({
      ...day,
      intervals: day.intervals.filter((_, intervalIndex) => intervalIndex !== index)
    }));
  }

  async function saveWorkingHours() {
    setIsSaving(true);
    setFormError(null);
    setNotice(null);
    const workingHours = week.flatMap((day) =>
      day.enabled
        ? day.intervals.map((interval) => ({
            weekday: day.weekday,
            ...interval
          }))
        : []
    );

    if (week.some((day) => day.enabled && day.intervals.length === 0)) {
      setFormError("У каждого рабочего дня должен быть хотя бы один интервал.");
      setIsSaving(false);
      return;
    }

    try {
      const response = await apiRequest<{ workingHours: WorkingHour[] }>(
        "/v1/admin/schedule/working-hours",
        {
          method: "PUT",
          body: JSON.stringify({ staffId: selectedStaffId, workingHours })
        }
      );
      setWeek(buildWeek(response.workingHours));
      setNotice("Недельный график сохранён.");
    } catch (error) {
      setFormError(scheduleErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  function openExceptionForm() {
    setExceptionForm(emptyExceptionForm());
    setFormError(null);
    setIsExceptionOpen(true);
  }

  async function submitException(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setFormError(null);
    setNotice(null);

    const startsAt = new Date(
      `${exceptionForm.startDate}T${exceptionForm.allDay ? "00:00" : exceptionForm.startsAt}:00+03:00`
    );
    const rawEnd = new Date(
      `${exceptionForm.endDate}T${exceptionForm.allDay ? "00:00" : exceptionForm.endsAt}:00+03:00`
    );
    const endsAt = exceptionForm.allDay
      ? new Date(rawEnd.getTime() + 86400000)
      : rawEnd;

    if (startsAt >= endsAt) {
      setFormError("Дата и время окончания должны быть позже начала.");
      setIsSaving(false);
      return;
    }

    try {
      await apiRequest("/v1/admin/schedule/exceptions", {
        method: "POST",
        body: JSON.stringify({
          staffId: selectedStaffId,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          reason: exceptionForm.reason.trim() || null,
          isBookable: exceptionForm.kind === "bookable"
        })
      });
      setIsExceptionOpen(false);
      setNotice(
        exceptionForm.kind === "bookable"
          ? "Дополнительные часы добавлены."
          : "Недоступное время добавлено."
      );
      await loadSchedule(selectedStaffId);
    } catch (error) {
      setFormError(scheduleErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteException(exception: ScheduleException) {
    setIsDeleting(true);
    setNotice(null);
    setFormError(null);
    try {
      await apiRequest(`/v1/admin/schedule/exceptions/${exception.id}`, {
        method: "DELETE"
      });
      setExceptions((current) => current.filter((item) => item.id !== exception.id));
      setExceptionToDelete(null);
      setNotice("Исключение удалено.");
    } catch (error) {
      setFormError(scheduleErrorMessage(error));
    } finally {
      setIsDeleting(false);
    }
  }

  const selectedStaff = staff.find((profile) => profile.id === selectedStaffId);
  const activeDays = week.filter((day) => day.enabled).length;

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">
            Мастер · {selectedStaff?.displayName ?? "Расписание"}
          </p>
          <h1>Расписание</h1>
          <p className="page-description">
            Рабочая неделя, обеды, выходные, отпуск и разовые изменения.
          </p>
        </div>
        <button className="primary-button" onClick={openExceptionForm} type="button">
          <Plus aria-hidden="true" size={18} />
          Добавить исключение
        </button>
      </header>

      {notice ? (
        <p className="feedback feedback-success" role="status">
          {notice}
        </p>
      ) : null}
      {formError && !isExceptionOpen ? (
        <p className="feedback feedback-error" role="alert">
          {formError}
        </p>
      ) : null}

      {staff.length > 1 ? (
        <label className="form-field schedule-staff-field">
          <span>Мастер</span>
          <select
            onChange={(event) => void loadSchedule(event.target.value)}
            value={selectedStaffId}
          >
            {staff.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.displayName}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {loadError ? (
        <div className="empty-schedule" role="alert">
          <CircleAlert aria-hidden="true" size={26} />
          <div>
            <h2>{loadError}</h2>
            <button
              className="secondary-button"
              onClick={() => void loadSchedule(selectedStaffId || undefined)}
              type="button"
            >
              Повторить
            </button>
          </div>
        </div>
      ) : (
        <section className="schedule-layout">
          <article className="panel schedule-week-panel">
            <div className="panel-heading schedule-panel-heading">
              <div>
                <p className="section-kicker">Повторяется каждую неделю</p>
                <h2>Рабочие часы</h2>
              </div>
              <span className="muted-label">
                {isLoading ? "Загрузка…" : `${activeDays} рабочих дней`}
              </span>
            </div>

            <div className="week-schedule" aria-busy={isLoading}>
              {week.map((day) => (
                <div className="schedule-day" key={day.weekday}>
                  <label className="schedule-day-toggle">
                    <input
                      checked={day.enabled}
                      disabled={isLoading}
                      onChange={(event) =>
                        updateDay(day.weekday, (current) => ({
                          ...current,
                          enabled: event.target.checked
                        }))
                      }
                      type="checkbox"
                    />
                    <span className="schedule-day-short">{day.shortLabel}</span>
                    <span className="schedule-day-name">{day.label}</span>
                  </label>

                  {day.enabled ? (
                    <div className="schedule-intervals">
                      {day.intervals.map((interval, index) => (
                        <div className="schedule-interval" key={`${day.weekday}-${index}`}>
                          <input
                            aria-label={`${day.label}, начало интервала ${index + 1}`}
                            onChange={(event) =>
                              updateInterval(
                                day.weekday,
                                index,
                                "startsAt",
                                event.target.value
                              )
                            }
                            step={bookingRules.slotIntervalMinutes * 60}
                            type="time"
                            value={interval.startsAt}
                          />
                          <span>–</span>
                          <input
                            aria-label={`${day.label}, окончание интервала ${index + 1}`}
                            onChange={(event) =>
                              updateInterval(
                                day.weekday,
                                index,
                                "endsAt",
                                event.target.value
                              )
                            }
                            step={bookingRules.slotIntervalMinutes * 60}
                            type="time"
                            value={interval.endsAt}
                          />
                          <button
                            aria-label={`Удалить интервал ${index + 1} в ${day.label.toLowerCase()}`}
                            className="icon-button schedule-remove-button"
                            disabled={day.intervals.length === 1}
                            onClick={() => removeInterval(day.weekday, index)}
                            title="Удалить интервал"
                            type="button"
                          >
                            <Trash2 aria-hidden="true" size={15} />
                          </button>
                        </div>
                      ))}
                      <button
                        className="schedule-add-interval"
                        onClick={() => addInterval(day.weekday)}
                        type="button"
                      >
                        <Plus aria-hidden="true" size={14} />
                        Интервал
                      </button>
                    </div>
                  ) : (
                    <span className="schedule-day-off">Выходной</span>
                  )}
                </div>
              ))}
            </div>

            <footer className="schedule-save-row">
              <span>Несколько интервалов в день создают перерыв между ними.</span>
              <button
                className="primary-button"
                disabled={isLoading || isSaving}
                onClick={() => void saveWorkingHours()}
                type="button"
              >
                {isSaving ? "Сохраняем…" : "Сохранить график"}
              </button>
            </footer>
          </article>

          <div className="schedule-side">
            <article className="panel">
              <div className="panel-heading schedule-panel-heading">
                <div>
                  <p className="section-kicker">Разовые изменения</p>
                  <h2>Ближайшие исключения</h2>
                </div>
                <span className="muted-label">{exceptions.length}</span>
              </div>

              {isLoading ? (
                <div className="schedule-loading" role="status">
                  Загружаем исключения…
                </div>
              ) : exceptions.length ? (
                <div className="schedule-exceptions">
                  {exceptions.map((exception) => (
                    <div className="schedule-exception" key={exception.id}>
                      <div className="schedule-exception-icon">
                        {exception.isBookable ? (
                          <Clock3 aria-hidden="true" size={18} />
                        ) : (
                          <CalendarClock aria-hidden="true" size={18} />
                        )}
                      </div>
                      <div>
                        <strong>
                          {exception.reason ||
                            (exception.isBookable
                              ? "Дополнительные часы"
                              : "Недоступное время")}
                        </strong>
                        <span>{exceptionLabel(exception)}</span>
                      </div>
                      <button
                        aria-label="Удалить исключение"
                        className="icon-button schedule-remove-button"
                        onClick={() => {
                          setFormError(null);
                          setExceptionToDelete(exception);
                        }}
                        title="Удалить"
                        type="button"
                      >
                        <Trash2 aria-hidden="true" size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="schedule-empty">
                  <CalendarClock aria-hidden="true" size={22} />
                  <span>Отпусков, выходных и разовых часов пока нет.</span>
                </div>
              )}
            </article>

            <article className="panel reminder-panel">
              <CircleAlert aria-hidden="true" size={22} />
              <div>
                <p className="section-kicker">Контроль графика</p>
                <h2>Подготовить следующий месяц</h2>
                <p>
                  Напомним за {bookingRules.scheduleReminderDaysBeforeMonth} дней
                  до начала месяца, в {bookingRules.scheduleReminderTime} по Москве.
                </p>
              </div>
            </article>

            <article className="panel">
              <div className="panel-heading">
                <div>
                  <p className="section-kicker">Правила записи</p>
                  <h2>Текущие настройки</h2>
                </div>
              </div>
              <dl className="rules-list rules-list-compact">
                {rules.map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </article>
          </div>
        </section>
      )}

      {isExceptionOpen ? (
        <Modal
          description="Отпуск, выходной, обед, личный перерыв или дополнительные часы."
          onClose={() => setIsExceptionOpen(false)}
          title="Новое исключение"
        >
          <form className="modal-form" onSubmit={(event) => void submitException(event)}>
            <div className="segmented-control" role="group" aria-label="Тип исключения">
              <button
                aria-pressed={exceptionForm.kind === "unavailable"}
                className={exceptionForm.kind === "unavailable" ? "is-active" : ""}
                onClick={() =>
                  setExceptionForm((current) => ({
                    ...current,
                    kind: "unavailable"
                  }))
                }
                type="button"
              >
                Недоступно
              </button>
              <button
                aria-pressed={exceptionForm.kind === "bookable"}
                className={exceptionForm.kind === "bookable" ? "is-active" : ""}
                onClick={() =>
                  setExceptionForm((current) => ({ ...current, kind: "bookable" }))
                }
                type="button"
              >
                Дополнительные часы
              </button>
            </div>

            <div className="form-grid form-grid-two">
              <label className="form-field">
                <span>Дата начала</span>
                <input
                  min={moscowDateKey()}
                  onChange={(event) =>
                    setExceptionForm((current) => ({
                      ...current,
                      startDate: event.target.value,
                      endDate:
                        current.endDate < event.target.value
                          ? event.target.value
                          : current.endDate
                    }))
                  }
                  required
                  type="date"
                  value={exceptionForm.startDate}
                />
              </label>
              <label className="form-field">
                <span>Дата окончания</span>
                <input
                  min={exceptionForm.startDate}
                  onChange={(event) =>
                    setExceptionForm((current) => ({
                      ...current,
                      endDate: event.target.value
                    }))
                  }
                  required
                  type="date"
                  value={exceptionForm.endDate}
                />
              </label>
            </div>

            <label className="checkbox-field">
              <input
                checked={exceptionForm.allDay}
                onChange={(event) =>
                  setExceptionForm((current) => ({
                    ...current,
                    allDay: event.target.checked
                  }))
                }
                type="checkbox"
              />
              <span>
                <strong>Весь день</strong>
                <small>Выключите для обеда, перерыва или дополнительных часов.</small>
              </span>
            </label>

            {!exceptionForm.allDay ? (
              <div className="form-grid form-grid-two">
                <label className="form-field">
                  <span>Время начала</span>
                  <input
                    onChange={(event) =>
                      setExceptionForm((current) => ({
                        ...current,
                        startsAt: event.target.value
                      }))
                    }
                    required
                    step={bookingRules.slotIntervalMinutes * 60}
                    type="time"
                    value={exceptionForm.startsAt}
                  />
                </label>
                <label className="form-field">
                  <span>Время окончания</span>
                  <input
                    onChange={(event) =>
                      setExceptionForm((current) => ({
                        ...current,
                        endsAt: event.target.value
                      }))
                    }
                    required
                    step={bookingRules.slotIntervalMinutes * 60}
                    type="time"
                    value={exceptionForm.endsAt}
                  />
                </label>
              </div>
            ) : null}

            <label className="form-field">
              <span>Причина или название</span>
              <input
                maxLength={240}
                onChange={(event) =>
                  setExceptionForm((current) => ({
                    ...current,
                    reason: event.target.value
                  }))
                }
                placeholder="Например: отпуск, обед, обучение"
                value={exceptionForm.reason}
              />
            </label>

            {formError ? (
              <p className="feedback feedback-error" role="alert">
                {formError}
              </p>
            ) : null}

            <footer className="modal-actions">
              <button
                className="secondary-button"
                onClick={() => setIsExceptionOpen(false)}
                type="button"
              >
                Отмена
              </button>
              <button className="primary-button" disabled={isSaving} type="submit">
                {isSaving ? "Сохраняем…" : "Добавить"}
              </button>
            </footer>
          </form>
        </Modal>
      ) : null}

      {exceptionToDelete ? (
        <Modal
          description={exceptionLabel(exceptionToDelete)}
          onClose={() => setExceptionToDelete(null)}
          title="Удалить исключение?"
        >
          <div className="modal-form">
            <p className="confirmation-copy">
              Исключение «{exceptionToDelete.reason ||
                (exceptionToDelete.isBookable
                  ? "Дополнительные часы"
                  : "Недоступное время")}
              » будет удалено из графика мастера.
            </p>
            {formError ? (
              <p className="feedback feedback-error" role="alert">
                {formError}
              </p>
            ) : null}
            <footer className="modal-actions">
              <button
                className="secondary-button"
                onClick={() => setExceptionToDelete(null)}
                type="button"
              >
                Оставить
              </button>
              <button
                className="danger-button"
                disabled={isDeleting}
                onClick={() => void deleteException(exceptionToDelete)}
                type="button"
              >
                {isDeleting ? "Удаляем…" : "Удалить"}
              </button>
            </footer>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
