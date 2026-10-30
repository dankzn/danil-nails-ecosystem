"use client";

import { bookingRules } from "@danil-nails/shared";
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  Plus,
  Trash2
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { apiUrl } from "../lib/api-url";
import { ApiError, apiRequest } from "../lib/api";
import { Modal } from "../ui/modal";
import { type DayRange } from "../ui/working-hours-popover";

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

type MonthOverviewStaff = { id: string; displayName: string; photoUrl: string | null };
type MonthOverviewResponse = {
  timezone: string;
  from: string;
  to: string;
  days: string[];
  staff: MonthOverviewStaff[];
  entries: Record<string, Record<string, DayRange[]>>;
};
function cellKey(staffId: string, date: string) {
  return `${staffId}|${date}`;
}

function parseCellKey(key: string) {
  const [staffId, date] = key.split("|");
  return { staffId: staffId!, date: date! };
}

const timeOptions = Array.from({ length: 48 }, (_, index) => {
  const hours = String(Math.floor(index / 2)).padStart(2, "0");
  const minutes = index % 2 === 0 ? "00" : "30";
  return `${hours}:${minutes}`;
});

const weekdays = [
  [1, "Понедельник", "Пн"],
  [2, "Вторник", "Вт"],
  [3, "Среда", "Ср"],
  [4, "Четверг", "Чт"],
  [5, "Пятница", "Пт"],
  [6, "Суббота", "Сб"],
  [7, "Воскресенье", "Вс"]
] as const;

const shortWeekdayByUtcDay = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
const monthNames = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь"
];

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

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function monthRangeDates(year: number, month: number) {
  const from = `${year}-${pad2(month + 1)}-01`;
  const to = `${year}-${pad2(month + 1)}-${pad2(daysInMonth(year, month))}`;
  return { from, to };
}

function shortWeekdayFor(date: string) {
  return shortWeekdayByUtcDay[new Date(`${date}T12:00:00Z`).getUTCDay()]!;
}

function isWeekendDate(date: string) {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
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

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export default function SchedulePage() {
  const [activeTab, setActiveTab] = useState<"month" | "template">("month");

  const today = moscowDateKey();
  const [viewYear, setViewYear] = useState(() => Number(today.slice(0, 4)));
  const [viewMonth, setViewMonth] = useState(() => Number(today.slice(5, 7)) - 1);
  const [overview, setOverview] = useState<MonthOverviewResponse | null>(null);
  const [isOverviewLoading, setIsOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [staffFilter, setStaffFilter] = useState("all");
  const [selectedCells, setSelectedCells] = useState<Set<string>>(() => new Set());
  const [isApplying, setIsApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);

  const loadOverview = useCallback((year: number, month: number) => {
    const controller = new AbortController();
    setIsOverviewLoading(true);
    setOverviewError(null);
    const { from, to } = monthRangeDates(year, month);
    apiRequest<MonthOverviewResponse>(
      `/v1/admin/schedule/month-overview?from=${from}&to=${to}`,
      { signal: controller.signal }
    )
      .then((response) => setOverview(response))
      .catch(() => {
        if (!controller.signal.aborted) setOverviewError("Не удалось загрузить график.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsOverviewLoading(false);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (activeTab !== "month") return;
    return loadOverview(viewYear, viewMonth);
  }, [activeTab, loadOverview, viewYear, viewMonth]);

  function goToMonth(offset: number) {
    const next = new Date(Date.UTC(viewYear, viewMonth + offset, 1));
    setViewYear(next.getUTCFullYear());
    setViewMonth(next.getUTCMonth());
  }

  function toggleCell(staffId: string, date: string) {
    setApplyError(null);
    setSelectedCells((current) => {
      const next = new Set(current);
      const key = cellKey(staffId, date);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function resetSelection() {
    setSelectedCells(new Set());
    setApplyError(null);
  }

  async function applyToSelection(ranges: DayRange[]) {
    setIsApplying(true);
    setApplyError(null);
    const keys = [...selectedCells];
    try {
      const results = await Promise.all(
        keys.map(async (key) => {
          const { staffId, date } = parseCellKey(key);
          const response = await apiRequest<{ date: string; ranges: DayRange[] }>(
            "/v1/admin/schedule/day",
            { method: "PUT", body: JSON.stringify({ staffId, date, ranges }) }
          );
          return { staffId, date, ranges: response.ranges };
        })
      );
      setOverview((current) => {
        if (!current) return current;
        const entries = { ...current.entries };
        for (const result of results) {
          entries[result.staffId] = {
            ...entries[result.staffId],
            [result.date]: result.ranges
          };
        }
        return { ...current, entries };
      });
      resetSelection();
    } catch (error) {
      setApplyError(
        error instanceof ApiError && error.code === "schedule_day_has_appointments"
          ? "На один из выбранных дней уже есть записи — сначала перенесите или отмените их, потом можно будет изменить расписание."
          : error instanceof ApiError && error.status === 409
            ? "Один из выбранных дней уже входит в многодневное исключение — измените его в «Шаблон недели»."
            : "Не удалось сохранить изменения. Попробуйте ещё раз."
      );
    } finally {
      setIsApplying(false);
    }
  }

  const visibleStaff = (overview?.staff ?? []).filter(
    (member) => staffFilter === "all" || member.id === staffFilter
  );

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Персонал · расписание</p>
          <h1>Расписание</h1>
          <p className="page-description">
            График работы по дням или недельный шаблон с разовыми исключениями.
          </p>
        </div>
        <div className="segmented-control" role="group" aria-label="Режим расписания">
          <button
            aria-pressed={activeTab === "month"}
            className={activeTab === "month" ? "is-active" : ""}
            onClick={() => setActiveTab("month")}
            type="button"
          >
            График на месяц
          </button>
          <button
            aria-pressed={activeTab === "template"}
            className={activeTab === "template" ? "is-active" : ""}
            onClick={() => setActiveTab("template")}
            type="button"
          >
            Шаблон недели
          </button>
        </div>
      </header>

      {activeTab === "month" ? (
        <MonthGrid
          applyError={applyError}
          goToMonth={goToMonth}
          isApplying={isApplying}
          isLoading={isOverviewLoading}
          loadError={overviewError}
          onApply={(ranges) => void applyToSelection(ranges)}
          onMakeDaysOff={() => void applyToSelection([])}
          onResetSelection={resetSelection}
          onRetry={() => loadOverview(viewYear, viewMonth)}
          onToggleCell={toggleCell}
          overview={overview}
          selectedCells={selectedCells}
          setStaffFilter={setStaffFilter}
          staffFilter={staffFilter}
          viewMonth={viewMonth}
          viewYear={viewYear}
          visibleStaff={visibleStaff}
        />
      ) : (
        <WeekTemplateEditor />
      )}
    </div>
  );
}

function MonthGrid({
  viewYear,
  viewMonth,
  goToMonth,
  overview,
  isLoading,
  loadError,
  onRetry,
  staffFilter,
  setStaffFilter,
  visibleStaff,
  selectedCells,
  onToggleCell,
  onResetSelection,
  onApply,
  onMakeDaysOff,
  isApplying,
  applyError
}: {
  viewYear: number;
  viewMonth: number;
  goToMonth: (offset: number) => void;
  overview: MonthOverviewResponse | null;
  isLoading: boolean;
  loadError: string | null;
  onRetry: () => void;
  staffFilter: string;
  setStaffFilter: (value: string) => void;
  visibleStaff: MonthOverviewStaff[];
  selectedCells: Set<string>;
  onToggleCell: (staffId: string, date: string) => void;
  onResetSelection: () => void;
  onApply: (ranges: DayRange[]) => void;
  onMakeDaysOff: () => void;
  isApplying: boolean;
  applyError: string | null;
}) {
  const today = moscowDateKey();
  const days = overview?.days ?? [];
  const selectedDates = new Set(
    [...selectedCells].map((key) => parseCellKey(key).date)
  );

  return (
    <section className="dikidi-schedule">
      <div className="dikidi-schedule-toolbar">
        <label className="dikidi-schedule-staff-filter">
          <select
            onChange={(event) => setStaffFilter(event.target.value)}
            value={staffFilter}
          >
            <option value="all">
              Все сотрудники {overview ? overview.staff.length : ""}
            </option>
            {(overview?.staff ?? []).map((member) => (
              <option key={member.id} value={member.id}>
                {member.displayName}
              </option>
            ))}
          </select>
        </label>

        <div className="dikidi-schedule-month-nav">
          <button onClick={() => goToMonth(-1)} type="button">
            <ChevronLeft aria-hidden="true" size={16} />
            {monthNames[(viewMonth + 11) % 12]}
          </button>
          <strong>
            {monthNames[viewMonth]} {viewYear}
          </strong>
          <button onClick={() => goToMonth(1)} type="button">
            {monthNames[(viewMonth + 1) % 12]}
            <ChevronRight aria-hidden="true" size={16} />
          </button>
        </div>

        <Link className="primary-button" href="/employees">
          <Plus aria-hidden="true" size={16} />
          Добавить сотрудника
        </Link>
      </div>

      {loadError ? (
        <div className="empty-schedule" role="alert">
          <CircleAlert aria-hidden="true" size={26} />
          <div>
            <h2>{loadError}</h2>
            <button className="secondary-button" onClick={onRetry} type="button">
              Повторить
            </button>
          </div>
        </div>
      ) : (
        <div className="dikidi-schedule-body">
          <div className="dikidi-schedule-grid-scroll" aria-busy={isLoading}>
            <div
              className="dikidi-schedule-grid"
              style={{
                gridTemplateColumns: `200px repeat(${days.length || 1}, 64px)`
              }}
            >
              <div className="dikidi-schedule-corner" aria-hidden="true" />
              {days.map((date) => (
                <div
                  className={`dikidi-schedule-day-head${
                    isWeekendDate(date) ? " is-weekend" : ""
                  }${date === today ? " is-today" : ""}${
                    selectedDates.has(date) ? " is-selected-column" : ""
                  }`}
                  key={date}
                >
                  <span className="dikidi-schedule-day-number">
                    {Number(date.slice(8, 10))}
                  </span>
                  <span className="dikidi-schedule-day-weekday">
                    {shortWeekdayFor(date)}
                  </span>
                </div>
              ))}

              {visibleStaff.map((member) => (
                <MonthGridRow
                  days={days}
                  key={member.id}
                  member={member}
                  onToggleCell={onToggleCell}
                  ranges={overview?.entries[member.id] ?? {}}
                  selectedCells={selectedCells}
                  selectedDates={selectedDates}
                  today={today}
                />
              ))}

              {!isLoading && visibleStaff.length === 0 ? (
                <div className="dikidi-schedule-empty-row">
                  Нет сотрудников с расписанием.
                </div>
              ) : null}
            </div>
          </div>

          <aside className="dikidi-schedule-side">
            {selectedCells.size > 0 ? (
              <ScheduleSelectionPanel
                applyError={applyError}
                isApplying={isApplying}
                onApply={onApply}
                onMakeDaysOff={onMakeDaysOff}
                onReset={onResetSelection}
                selectedCount={selectedCells.size}
              />
            ) : (
              <>
                <p>
                  Выделите в графике один или несколько дней для настройки
                  расписания
                </p>
                <label className="checkbox-field" title="Будет добавлено позже">
                  <input disabled type="checkbox" />
                  <span>Отобразить пометки о записях в графике</span>
                </label>
              </>
            )}
          </aside>
        </div>
      )}
    </section>
  );
}

function MonthGridRow({
  member,
  days,
  ranges,
  today,
  selectedCells,
  selectedDates,
  onToggleCell
}: {
  member: MonthOverviewStaff;
  days: string[];
  ranges: Record<string, DayRange[]>;
  today: string;
  selectedCells: Set<string>;
  selectedDates: Set<string>;
  onToggleCell: (staffId: string, date: string) => void;
}) {
  return (
    <>
      <div className="dikidi-schedule-staff-cell">
        <span className="calendar-grid-avatar">
          {member.photoUrl ? (
            <img alt="" src={`${apiUrl}${member.photoUrl}`} />
          ) : (
            initials(member.displayName)
          )}
        </span>
        <span>{member.displayName}</span>
      </div>
      {days.map((date) => {
        const dayRanges = ranges[date] ?? [];
        const sorted = [...dayRanges].sort(
          (left, right) =>
            new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime()
        );
        const isSelected = selectedCells.has(cellKey(member.id, date));
        return (
          <button
            className={`dikidi-schedule-cell${
              isWeekendDate(date) ? " is-weekend" : ""
            }${date === today ? " is-today" : ""}${
              selectedDates.has(date) ? " is-selected-column" : ""
            }${isSelected ? " is-selected" : ""}`}
            key={date}
            onClick={() => onToggleCell(member.id, date)}
            type="button"
          >
            {sorted.length ? (
              <>
                <span>{timeFormatter.format(new Date(sorted[0]!.startsAt))}</span>
                <span>{timeFormatter.format(new Date(sorted.at(-1)!.endsAt))}</span>
              </>
            ) : null}
          </button>
        );
      })}
    </>
  );
}

function ScheduleSelectionPanel({
  selectedCount,
  onReset,
  onApply,
  onMakeDaysOff,
  isApplying,
  applyError
}: {
  selectedCount: number;
  onReset: () => void;
  onApply: (ranges: DayRange[]) => void;
  onMakeDaysOff: () => void;
  isApplying: boolean;
  applyError: string | null;
}) {
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("18:00");
  const [hasBreak, setHasBreak] = useState(false);
  const [breakStart, setBreakStart] = useState("13:00");
  const [breakEnd, setBreakEnd] = useState("14:00");

  return (
    <div className="dikidi-schedule-selection">
      <div className="dikidi-schedule-selection-head">
        <span>Выбрано: {selectedCount}</span>
        <button className="dikidi-link" onClick={onReset} type="button">
          Сбросить выбор
        </button>
      </div>

      <div className="dikidi-divider" />

      <p className="dikidi-schedule-selection-title">Рабочее время</p>

      <div className="working-hours-popover-row">
        <select onChange={(event) => setStart(event.target.value)} value={start}>
          {timeOptions.map((time) => (
            <option key={time} value={time}>
              {time}
            </option>
          ))}
        </select>
        <span>—</span>
        <select onChange={(event) => setEnd(event.target.value)} value={end}>
          {timeOptions.map((time) => (
            <option key={time} value={time}>
              {time}
            </option>
          ))}
        </select>
      </div>

      <label className="checkbox-field">
        <input
          checked={hasBreak}
          onChange={(event) => setHasBreak(event.target.checked)}
          type="checkbox"
        />
        <span>С перерывом</span>
      </label>

      {hasBreak ? (
        <div className="working-hours-popover-row">
          <select
            onChange={(event) => setBreakStart(event.target.value)}
            value={breakStart}
          >
            {timeOptions.map((time) => (
              <option key={time} value={time}>
                {time}
              </option>
            ))}
          </select>
          <span>—</span>
          <select
            onChange={(event) => setBreakEnd(event.target.value)}
            value={breakEnd}
          >
            {timeOptions.map((time) => (
              <option key={time} value={time}>
                {time}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {applyError ? (
        <p className="feedback feedback-error" role="alert">
          {applyError}
        </p>
      ) : null}

      <button
        className="dikidi-button-blue dikidi-schedule-selection-apply"
        disabled={isApplying}
        onClick={() =>
          onApply(
            hasBreak
              ? [
                  { startsAt: start, endsAt: end },
                  { startsAt: breakStart, endsAt: breakEnd }
                ]
              : [{ startsAt: start, endsAt: end }]
          )
        }
        type="button"
      >
        {isApplying ? "Сохраняем…" : "Применить изменения"}
      </button>

      <span className="dikidi-schedule-selection-or">или</span>

      <button
        className="dikidi-button-outline-blue dikidi-schedule-selection-apply"
        disabled={isApplying}
        onClick={onMakeDaysOff}
        type="button"
      >
        Сделать дни нерабочими
      </button>
    </div>
  );
}

function WeekTemplateEditor() {
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
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">
            Мастер · {selectedStaff?.displayName ?? "Расписание"}
          </p>
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
    </>
  );
}
