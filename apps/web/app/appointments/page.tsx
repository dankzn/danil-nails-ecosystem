"use client";

import { bookingRules } from "@danil-nails/shared";
import {
  Activity,
  Bell,
  CalendarPlus,
  ChartNoAxesCombined,
  ChevronLeft,
  ChevronRight,
  Clock3,
  CreditCard,
  Gift,
  History,
  LoaderCircle,
  Phone,
  TriangleAlert,
  UserRound
} from "lucide-react";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent
} from "react";
import { ApiError, apiRequest } from "../lib/api";
import { apiUrl } from "../lib/api-url";
import { Modal } from "../ui/modal";

type AppointmentStatus =
  | "draft"
  | "pending_admin_confirmation"
  | "confirmed"
  | "completed"
  | "canceled"
  | "rescheduled"
  | "no_show";
type AttendanceStatus =
  | "not_requested"
  | "pending"
  | "confirmed"
  | "declined";
type PaymentMethod =
  | "online_acquiring"
  | "cash"
  | "phone_transfer"
  | "bank_card"
  | "sbp"
  | "qr"
  | "bank_transfer"
  | "other";
type WorkspaceTab =
  | "appointment"
  | "client"
  | "history"
  | "statistics"
  | "bonuses"
  | "notifications"
  | "activity";

type AppointmentPayment = {
  id: string;
  method: PaymentMethod;
  amountMinor: number;
  currency: string;
  externalTransactionId: string | null;
  note: string | null;
  occurredAt: string;
  receivedBy: {
    email: string | null;
    staffProfile: { displayName: string } | null;
  } | null;
};

type AppointmentColorTag =
  | "green"
  | "yellow"
  | "teal"
  | "purple"
  | "red"
  | "lime"
  | "blue";

type Appointment = {
  id: string;
  source: "online" | "admin_manual";
  status: AppointmentStatus;
  attendanceConfirmationStatus: AttendanceStatus;
  startsAt: string;
  endsAt: string;
  clientComment: string | null;
  internalNote: string | null;
  cancellationReason: string | null;
  canceledAt: string | null;
  colorTag: AppointmentColorTag | null;
  priceMinor: number;
  currency: string;
  client: {
    id: string;
    fullName: string | null;
    phone: string;
    telegramUsername: string | null;
    requiresPrepayment: boolean;
  };
  service: {
    id: string;
    titleRu: string;
    durationMinutes: number;
    bufferAfterMinutes: number;
  };
  staff: { id: string; displayName: string; userId: string };
  createdBy: {
    email: string | null;
    staffProfile: { displayName: string } | null;
  } | null;
  closedBy: {
    email: string | null;
    staffProfile: { displayName: string } | null;
  } | null;
  payments: AppointmentPayment[];
};

type BookingOptions = {
  clients: Array<{
    id: string;
    fullName: string | null;
    phone: string;
    requiresPrepayment: boolean;
  }>;
  services: Array<{
    id: string;
    titleRu: string;
    durationMinutes: number;
    bufferAfterMinutes: number;
  }>;
  staff: Array<{ id: string; displayName: string; photoUrl: string | null }>;
};

type AvailableSlot = {
  startsAt: string;
  endsAt: string;
};

type BookingForm = {
  clientId: string;
  serviceId: string;
  staffId: string;
  startsAt: string;
  clientComment: string;
  internalNote: string;
};

type ClosePaymentRow = {
  method: PaymentMethod;
  amount: string;
  externalTransactionId: string;
  note: string;
};

type LoyaltyTransaction = {
  id: string;
  type: "accrual" | "redemption" | "adjustment" | "reversal";
  pointsDelta: number;
  reason: string | null;
  createdAt: string;
  createdBy: {
    email: string | null;
    staffProfile: { displayName: string } | null;
  } | null;
};

type AppointmentWorkspace = {
  appointment: Appointment & {
    client: Appointment["client"] & {
      email: string | null;
      whatsappPhone: string | null;
      allergies: string | null;
      noKnownAllergies: boolean;
      customAllergyNote: string | null;
      notes: string | null;
      prepaymentReason: string | null;
      loyaltyStatus: { titleRu: string } | null;
      privateTagAssignments: Array<{
        id: string;
        tag: { id: string; title: string; color: string | null };
      }>;
      allergenAssignments: Array<{
        id: string;
        allergen: { id: string; title: string };
      }>;
      loyaltyTransactions: LoyaltyTransaction[];
    };
    events: Array<{
      id: string;
      fromStatus: AppointmentStatus | null;
      toStatus: AppointmentStatus;
      note: string | null;
      createdAt: string;
      actor: {
        email: string | null;
        staffProfile: { displayName: string } | null;
      } | null;
    }>;
    loyaltyTransactions: LoyaltyTransaction[];
  };
  history: Array<{
    id: string;
    startsAt: string;
    status: AppointmentStatus;
    priceMinor: number;
    currency: string;
    internalNote: string | null;
    service: { titleRu: string };
    staff: { displayName: string };
    payments: Array<{ amountMinor: number }>;
  }>;
  notificationJobs: Array<{
    id: string;
    channel: string;
    recipient: string;
    templateCode: string | null;
    scheduledAt: string;
    sentAt: string | null;
    failedAt: string | null;
    error: string | null;
  }>;
  statistics: {
    totalAppointments: number;
    completedAppointments: number;
    canceledAppointments: number;
    noShowAppointments: number;
    lastCompletedAt: string | null;
    visitsPerMonth: number;
    spendByCurrency: Record<string, number>;
    averageCheckByCurrency: Record<string, number>;
    bonusBalancePoints: number;
  };
};

function formatMoney(amountMinor: number, currency: string) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(amountMinor / 100);
}

function minorAmount(value: string) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : Number.NaN;
}

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

const appointmentColorTags: AppointmentColorTag[] = [
  "green",
  "yellow",
  "teal",
  "purple",
  "red",
  "lime",
  "blue"
];

const cancelVisibilityMs = 5 * 60 * 1000;

function statusFillTone(status: AppointmentStatus): AppointmentColorTag | "neutral" {
  switch (status) {
    case "draft":
    case "pending_admin_confirmation":
      return "green";
    case "confirmed":
      return "teal";
    case "completed":
      return "yellow";
    case "canceled":
      return "red";
    default:
      return "neutral";
  }
}

function appointmentFillTone(appointment: Appointment) {
  return appointment.colorTag ?? statusFillTone(appointment.status);
}

function isCanceledAppointmentExpired(appointment: Appointment, now: number) {
  if (appointment.status !== "canceled") return false;
  if (!appointment.canceledAt) return false;
  return now - new Date(appointment.canceledAt).getTime() >= cancelVisibilityMs;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function closedGridSegments(ranges: Array<{ startsAt: string; endsAt: string }>) {
  const open = ranges
    .map((range) => ({
      start: Math.max(
        gridStartMinutes,
        moscowMinutesOfDay(new Date(range.startsAt))
      ),
      end: Math.min(gridEndMinutes, moscowMinutesOfDay(new Date(range.endsAt)))
    }))
    .filter((range) => range.end > range.start)
    .sort((left, right) => left.start - right.start);

  const segments: Array<{ top: number; height: number }> = [];
  let cursor = gridStartMinutes;
  for (const range of open) {
    if (range.start > cursor) {
      segments.push({
        top: (cursor - gridStartMinutes) * gridPixelsPerMinute,
        height: (range.start - cursor) * gridPixelsPerMinute
      });
    }
    cursor = Math.max(cursor, range.end);
  }
  if (cursor < gridEndMinutes) {
    segments.push({
      top: (cursor - gridStartMinutes) * gridPixelsPerMinute,
      height: (gridEndMinutes - cursor) * gridPixelsPerMinute
    });
  }
  return segments;
}

function snapToGrid(minutes: number) {
  return Math.min(
    gridEndMinutes - 5,
    Math.max(gridStartMinutes, Math.round(minutes / 5) * 5)
  );
}

const attendanceMeta: Record<AttendanceStatus, string> = {
  not_requested: "Не запрашивалось",
  pending: "Ждём ответа клиента",
  confirmed: "Клиент подтвердил визит",
  declined: "Клиент не подтвердил"
};

const paymentMethodMeta: Record<PaymentMethod, string> = {
  online_acquiring: "Онлайн-эквайринг",
  cash: "Наличные",
  phone_transfer: "Перевод по номеру телефона",
  bank_card: "Банковская карта / терминал",
  sbp: "СБП",
  qr: "QR",
  bank_transfer: "Банковский перевод",
  other: "Другое"
};

const workspaceTabs: Array<{
  value: WorkspaceTab;
  label: string;
  icon: typeof Activity;
}> = [
  { value: "appointment", label: "Запись", icon: CalendarPlus },
  { value: "client", label: "Клиент", icon: UserRound },
  { value: "history", label: "История", icon: History },
  { value: "statistics", label: "Статистика", icon: ChartNoAxesCombined },
  { value: "bonuses", label: "Бонусы", icon: Gift },
  { value: "notifications", label: "Уведомления", icon: Bell },
  { value: "activity", label: "Изменения", icon: Activity }
];

const manageableStatuses = ["confirmed", "canceled", "no_show"] as const;
const closableStatuses = [
  "draft",
  "pending_admin_confirmation",
  "confirmed"
] as const;

const timeFormatter = new Intl.DateTimeFormat("ru-RU", {
  timeZone: "Europe/Moscow",
  hour: "2-digit",
  minute: "2-digit"
});
const dateHeadingFormatter = new Intl.DateTimeFormat("ru-RU", {
  timeZone: "UTC",
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric"
});
const dateTimeFormatter = new Intl.DateTimeFormat("ru-RU", {
  timeZone: "Europe/Moscow",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
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

function moscowDateTimeInput(date: Date) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function moscowMinutesOfDay(date: Date) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Europe/Moscow",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "0";
  return Number(part("hour")) * 60 + Number(part("minute"));
}

const gridStartMinutes = 8 * 60;
const gridEndMinutes = 22 * 60;
const gridPixelsPerHour = 64;
const gridPixelsPerMinute = gridPixelsPerHour / 60;
const gridTotalHeight =
  ((gridEndMinutes - gridStartMinutes) / 60) * gridPixelsPerHour;
const gridHourMarks = Array.from(
  { length: (gridEndMinutes - gridStartMinutes) / 60 + 1 },
  (_, index) => gridStartMinutes / 60 + index
);

function moveDate(date: string, days: number) {
  const value = new Date(`${date}T12:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function toMoscowIso(value: string) {
  return new Date(`${value}:00+03:00`).toISOString();
}

function selectedDateHeading(date: string) {
  const formatted = dateHeadingFormatter.format(
    new Date(`${date}T12:00:00.000Z`)
  );
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function AvailabilityPicker({
  slots,
  isLoading,
  error,
  selectedStartsAt,
  onSelect
}: {
  slots: AvailableSlot[];
  isLoading: boolean;
  error: string | null;
  selectedStartsAt: string;
  onSelect: (startsAt: string) => void;
}) {
  return (
    <section
      aria-busy={isLoading}
      aria-live="polite"
      className="availability-picker"
    >
      <div className="availability-heading">
        <div>
          <span>Свободные окна</span>
          <small>Время указано по Москве</small>
        </div>
        {selectedStartsAt ? (
          <strong>
            Выбрано {timeFormatter.format(new Date(toMoscowIso(selectedStartsAt)))}
          </strong>
        ) : null}
      </div>
      {isLoading ? (
        <div className="availability-state">Ищем свободное время…</div>
      ) : error ? (
        <div className="availability-state availability-state-error">
          {error}
        </div>
      ) : slots.length ? (
        <div className="availability-slots">
          {slots.map((slot) => {
            const localValue = moscowDateTimeInput(new Date(slot.startsAt));
            const isSelected = selectedStartsAt === localValue;
            return (
              <button
                aria-pressed={isSelected}
                className={`slot-button${
                  isSelected ? " slot-button-selected" : ""
                }`}
                key={slot.startsAt}
                onClick={() => onSelect(localValue)}
                type="button"
              >
                <strong>{timeFormatter.format(new Date(slot.startsAt))}</strong>
                <span>до {timeFormatter.format(new Date(slot.endsAt))}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="availability-state">
          <strong>Свободных окон нет</strong>
          <span>Выберите другую дату, мастера или проверьте график.</span>
        </div>
      )}
    </section>
  );
}

function durationMinutes(appointment: Appointment) {
  return Math.round(
    (new Date(appointment.endsAt).getTime() -
      new Date(appointment.startsAt).getTime()) /
      60000
  );
}

function formatBusyTime(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest} мин`;
  return rest ? `${hours} ч ${rest} мин` : `${hours} ч`;
}

function appointmentSourceLabel(appointment: Appointment) {
  if (appointment.source === "online") return "Online";
  return (
    appointment.createdBy?.staffProfile?.displayName ??
    appointment.createdBy?.email ??
    "Администратор"
  );
}

function appointmentErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === "request_timeout") {
      return "Сервер не ответил за 15 секунд. Запись не была подтверждена — обновите список перед повторной попыткой.";
    }
    if (error.code === "appointment_time_conflict") {
      return "Это время уже занято другой активной записью.";
    }
    if (error.code === "appointment_slot_unavailable") {
      return "Окно уже недоступно. Выберите другое свободное время.";
    }
    if (error.code === "client_not_found") return "Клиент больше не найден.";
    if (error.code === "service_not_found") return "Услуга недоступна.";
    if (error.code === "staff_not_found") return "Мастер недоступен.";
    if (error.code === "appointment_not_closable") {
      return "Эту запись нельзя закрыть в её текущем статусе.";
    }
    if (error.code === "appointment_payment_required") {
      return "Добавьте хотя бы один платёж или укажите причину расхождения.";
    }
    if (error.code === "appointment_payment_mismatch") {
      return "Сумма платежей не совпадает со стоимостью записи. Укажите причину расхождения (скидка, долг, возврат) или исправьте суммы.";
    }
    if (error.code === "appointment_bonus_insufficient") {
      return "На бонусном счёте клиента недостаточно бонусов для списания.";
    }
    if (error.code === "appointment_bonus_exceeds_price") {
      return "Стоимость списываемых бонусов не может превышать стоимость записи.";
    }
    if (error.code === "appointment_not_completed") {
      return "Запись ещё не закрыта.";
    }
    if (error.status === 401 || error.status === 403) {
      return "Недостаточно прав или сессия завершилась.";
    }
  }
  return "Не удалось сохранить изменения. Попробуйте ещё раз.";
}

export default function AppointmentsPage() {
  const [selectedDate, setSelectedDate] = useState(moscowDateKey);

  useEffect(() => {
    // Read this from the real, committed navigation rather than at initial
    // render: Next prefetches Link targets speculatively, rendering (and
    // running lazy useState initializers) against the *previous* page's
    // window.location before the URL actually changes. Effects only run
    // once a navigation is actually committed, so this reliably sees the
    // destination URL's query string.
    const requested = new URLSearchParams(window.location.search).get("date");
    if (requested && datePattern.test(requested)) setSelectedDate(requested);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [dayOverview, setDayOverview] = useState<
    Record<string, Array<{ startsAt: string; endsAt: string }>>
  >({});
  const [quickAddPopover, setQuickAddPopover] = useState<{
    staffId: string;
    clientX: number;
    clientY: number;
    candidates: Date[];
  } | null>(null);
  const [quickAddCandidateIndex, setQuickAddCandidateIndex] = useState(0);
  const [options, setOptions] = useState<BookingOptions | null>(null);
  const [bookingDate, setBookingDate] = useState(moscowDateKey);
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([]);
  const [isAvailabilityLoading, setIsAvailabilityLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [availabilityVersion, setAvailabilityVersion] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] =
    useState<Appointment | null>(null);
  const [workspace, setWorkspace] = useState<AppointmentWorkspace | null>(null);
  const [workspaceTab, setWorkspaceTab] =
    useState<WorkspaceTab>("appointment");
  const [isWorkspaceLoading, setIsWorkspaceLoading] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [form, setForm] = useState<BookingForm>({
    clientId: "",
    serviceId: "",
    staffId: "",
    startsAt: "",
    clientComment: "",
    internalNote: ""
  });
  const [status, setStatus] = useState<(typeof manageableStatuses)[number]>(
    "confirmed"
  );
  const [attendanceStatus, setAttendanceStatus] =
    useState<AttendanceStatus>("not_requested");
  const [cancellationReason, setCancellationReason] = useState("");
  const [canceledBy, setCanceledBy] = useState<"client" | "studio">("studio");
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState(moscowDateKey);
  const [rescheduleStaffId, setRescheduleStaffId] = useState("");
  const [rescheduleServiceId, setRescheduleServiceId] = useState("");
  const [rescheduleStartsAt, setRescheduleStartsAt] = useState("");
  const [rescheduleSlots, setRescheduleSlots] = useState<AvailableSlot[]>([]);
  const [isRescheduleAvailabilityLoading, setIsRescheduleAvailabilityLoading] =
    useState(false);
  const [rescheduleAvailabilityError, setRescheduleAvailabilityError] = useState<
    string | null
  >(null);
  const [rescheduleAvailabilityVersion, setRescheduleAvailabilityVersion] =
    useState(0);
  const [rescheduleRequestedBy, setRescheduleRequestedBy] =
    useState<"client" | "studio">("studio");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [closePayments, setClosePayments] = useState<ClosePaymentRow[]>([]);
  const [closeAdjustmentReason, setCloseAdjustmentReason] = useState("");
  const [closeNote, setCloseNote] = useState("");
  const [bonusRedemptionPoints, setBonusRedemptionPoints] = useState("");
  const [bonusAccrualPoints, setBonusAccrualPoints] = useState("");
  const [reopenReason, setReopenReason] = useState("");
  const [isClosing, setIsClosing] = useState(false);
  const workspaceCacheRef = useRef(new Map<string, AppointmentWorkspace>());
  const workspaceRequestsRef = useRef(
    new Map<string, Promise<AppointmentWorkspace>>()
  );

  const loadWorkspace = useCallback((appointmentId: string) => {
    const cached = workspaceCacheRef.current.get(appointmentId);
    if (cached) return Promise.resolve(cached);

    const pending = workspaceRequestsRef.current.get(appointmentId);
    if (pending) return pending;

    const request = apiRequest<AppointmentWorkspace>(
      `/v1/admin/appointments/${appointmentId}/workspace`
    )
      .then((response) => {
        workspaceCacheRef.current.set(appointmentId, response);
        return response;
      })
      .finally(() => {
        workspaceRequestsRef.current.delete(appointmentId);
      });
    workspaceRequestsRef.current.set(appointmentId, request);
    return request;
  }, []);

  const prefetchWorkspace = useCallback(
    (appointmentId: string) => {
      void loadWorkspace(appointmentId).catch(() => undefined);
    },
    [loadWorkspace]
  );

  const loadAppointments = useCallback(async (date: string) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await apiRequest<{ appointments: Appointment[] }>(
        `/v1/admin/appointments?date=${date}`
      );
      setAppointments(response.appointments);
    } catch {
      setLoadError("Не удалось загрузить записи.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadOptions = useCallback(async () => {
    try {
      const response = await apiRequest<BookingOptions>(
        "/v1/admin/booking-options"
      );
      setOptions(response);
    } catch {
      setOptions({ clients: [], services: [], staff: [] });
    }
  }, []);

  useEffect(() => {
    void loadAppointments(selectedDate);
  }, [loadAppointments, selectedDate]);

  useEffect(() => {
    void loadOptions();
  }, [loadOptions]);

  useEffect(() => {
    const controller = new AbortController();
    apiRequest<{
      staff: Array<{
        staffId: string;
        ranges: Array<{ startsAt: string; endsAt: string }>;
      }>;
    }>(`/v1/admin/schedule/day-overview?date=${selectedDate}`, {
      signal: controller.signal
    })
      .then((data) => {
        const byStaffId: Record<
          string,
          Array<{ startsAt: string; endsAt: string }>
        > = {};
        for (const entry of data.staff) byStaffId[entry.staffId] = entry.ranges;
        setDayOverview(byStaffId);
      })
      .catch(() => {
        if (!controller.signal.aborted) setDayOverview({});
      });
    return () => controller.abort();
  }, [selectedDate]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(interval);
  }, []);

  const calendarAppointments = useMemo(
    () =>
      appointments.filter(
        (appointment) => !isCanceledAppointmentExpired(appointment, now)
      ),
    [appointments, now]
  );

  const appointmentsByStaffId = useMemo(() => {
    const groups = new Map<string, Appointment[]>();
    for (const appointment of calendarAppointments) {
      const list = groups.get(appointment.staff.id) ?? [];
      list.push(appointment);
      groups.set(appointment.staff.id, list);
    }
    return groups;
  }, [calendarAppointments]);

  const staffColumns = options?.staff ?? [];

  useEffect(() => {
    if (!selectedAppointment) {
      setWorkspace(null);
      setWorkspaceError(null);
      return;
    }

    const cached = workspaceCacheRef.current.get(selectedAppointment.id);
    if (cached) {
      setWorkspace(cached);
      setSelectedAppointment(cached.appointment);
      setIsWorkspaceLoading(false);
      setWorkspaceError(null);
      return;
    }

    let isCurrent = true;
    setIsWorkspaceLoading(true);
    setWorkspaceError(null);
    void loadWorkspace(selectedAppointment.id)
      .then((response) => {
        if (!isCurrent) return;
        setWorkspace(response);
        setSelectedAppointment(response.appointment);
      })
      .catch(() => {
        if (isCurrent) {
          setWorkspaceError("Не удалось загрузить полную карточку записи.");
        }
      })
      .finally(() => {
        if (isCurrent) setIsWorkspaceLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [loadWorkspace, selectedAppointment?.id]);

  useEffect(() => {
    if (
      !isCreateOpen ||
      !bookingDate ||
      !form.staffId ||
      !form.serviceId
    ) {
      setAvailableSlots([]);
      return;
    }

    const controller = new AbortController();
    setIsAvailabilityLoading(true);
    setAvailabilityError(null);
    void apiRequest<{ slots: AvailableSlot[] }>(
      `/v1/availability?staffId=${encodeURIComponent(
        form.staffId
      )}&serviceId=${encodeURIComponent(form.serviceId)}&date=${bookingDate}`,
      { signal: controller.signal }
    )
      .then((response) => {
        setAvailableSlots(response.slots);
        setForm((current) => {
          const remainsAvailable = response.slots.some(
            (slot) =>
              moscowDateTimeInput(new Date(slot.startsAt)) === current.startsAt
          );
          return remainsAvailable ? current : { ...current, startsAt: "" };
        });
      })
      .catch((error) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setAvailableSlots([]);
          setAvailabilityError("Не удалось загрузить свободные окна.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsAvailabilityLoading(false);
      });

    return () => controller.abort();
  }, [
    availabilityVersion,
    bookingDate,
    form.serviceId,
    form.staffId,
    isCreateOpen
  ]);

  useEffect(() => {
    if (
      !selectedAppointment ||
      !isRescheduling ||
      !rescheduleDate ||
      !rescheduleStaffId ||
      !rescheduleServiceId
    ) {
      setRescheduleSlots([]);
      return;
    }

    const controller = new AbortController();
    const searchParams = new URLSearchParams({
      date: rescheduleDate,
      staffId: rescheduleStaffId,
      serviceId: rescheduleServiceId
    });
    setIsRescheduleAvailabilityLoading(true);
    setRescheduleAvailabilityError(null);
    void apiRequest<{ slots: AvailableSlot[] }>(
      `/v1/admin/appointments/${selectedAppointment.id}/availability?${searchParams}`,
      { signal: controller.signal }
    )
      .then((response) => {
        setRescheduleSlots(response.slots);
        setRescheduleStartsAt((current) => {
          const remainsAvailable = response.slots.some(
            (slot) => moscowDateTimeInput(new Date(slot.startsAt)) === current
          );
          return remainsAvailable ? current : "";
        });
      })
      .catch((error) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setRescheduleSlots([]);
          setRescheduleAvailabilityError(
            "Не удалось загрузить свободные окна для переноса."
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsRescheduleAvailabilityLoading(false);
        }
      });

    return () => controller.abort();
  }, [
    isRescheduling,
    rescheduleAvailabilityVersion,
    rescheduleDate,
    rescheduleServiceId,
    rescheduleStaffId,
    selectedAppointment
  ]);

  function openCreateForm() {
    const today = moscowDateKey();
    const latestDate = moveDate(today, bookingRules.bookingHorizonDays);
    const initialDate =
      selectedDate >= today && selectedDate <= latestDate ? selectedDate : today;
    const nextForm = {
      clientId: options?.clients[0]?.id ?? "",
      serviceId: options?.services[0]?.id ?? "",
      staffId: options?.staff[0]?.id ?? "",
      startsAt: "",
      clientComment: "",
      internalNote: ""
    };
    setBookingDate(initialDate);
    setAvailableSlots([]);
    setAvailabilityError(null);
    setForm(nextForm);
    setFormError(null);
    setIsCreateOpen(true);
  }

  function openCreateFormAt(staffId: string, startsAt?: Date) {
    openCreateForm();
    setForm((current) => ({
      ...current,
      staffId,
      ...(startsAt ? { startsAt: moscowDateTimeInput(startsAt) } : {})
    }));
  }

  function openAppointment(appointment: Appointment) {
    const today = moscowDateKey();
    const latestDate = moveDate(today, bookingRules.bookingHorizonDays);
    const appointmentDate = moscowDateKey(new Date(appointment.startsAt));
    const initialDate =
      appointmentDate >= today && appointmentDate <= latestDate
        ? appointmentDate
        : today;
    const cachedWorkspace = workspaceCacheRef.current.get(appointment.id);
    setSelectedAppointment(cachedWorkspace?.appointment ?? appointment);
    setWorkspace(cachedWorkspace ?? null);
    setWorkspaceTab("appointment");
    setWorkspaceError(null);
    setStatus(
      appointment.status === "canceled" || appointment.status === "no_show"
        ? appointment.status
        : "confirmed"
    );
    setClosePayments(
      closableStatuses.includes(
        appointment.status as (typeof closableStatuses)[number]
      )
        ? [
            {
              method: "cash",
              amount: "",
              externalTransactionId: "",
              note: ""
            }
          ]
        : []
    );
    setCloseAdjustmentReason("");
    setCloseNote("");
    setBonusRedemptionPoints("");
    setBonusAccrualPoints("");
    setReopenReason("");
    setAttendanceStatus(appointment.attendanceConfirmationStatus);
    setCancellationReason(appointment.cancellationReason ?? "");
    setCanceledBy("studio");
    setIsRescheduling(false);
    setRescheduleDate(initialDate);
    setRescheduleStaffId(appointment.staff.id);
    setRescheduleServiceId(appointment.service.id);
    setRescheduleStartsAt("");
    setRescheduleSlots([]);
    setRescheduleAvailabilityError(null);
    setRescheduleRequestedBy("studio");
    setFormError(null);
  }

  function focusPayment() {
    setWorkspaceTab("appointment");
    window.requestAnimationFrame(() => {
      document
        .getElementById("appointment-payment")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function updateForm<Key extends keyof BookingForm>(
    key: Key,
    value: BookingForm[Key]
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function refresh() {
    workspaceCacheRef.current.clear();
    await Promise.all([loadAppointments(selectedDate), loadOptions()]);
  }

  async function submitAppointment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.startsAt) {
      setFormError("Выберите свободное время для записи.");
      return;
    }
    setIsSaving(true);
    setFormError(null);
    setNotice(null);
    try {
      await apiRequest("/v1/admin/appointments", {
        method: "POST",
        body: JSON.stringify({
          clientId: form.clientId,
          serviceId: form.serviceId,
          staffId: form.staffId,
          startsAt: toMoscowIso(form.startsAt),
          clientComment: form.clientComment.trim() || null,
          internalNote: form.internalNote.trim() || null
        })
      });
      setIsCreateOpen(false);
      setNotice("Запись создана и ожидает подтверждения администратора.");
      await refresh();
    } catch (error) {
      setFormError(appointmentErrorMessage(error));
      if (
        error instanceof ApiError &&
        (error.code === "appointment_slot_unavailable" ||
          error.code === "appointment_time_conflict")
      ) {
        setForm((current) => ({ ...current, startsAt: "" }));
        setAvailabilityVersion((current) => current + 1);
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function updateStatus() {
    if (!selectedAppointment) return;
    setIsSaving(true);
    setFormError(null);
    setNotice(null);
    try {
      await apiRequest(
        `/v1/admin/appointments/${selectedAppointment.id}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({
            status,
            ...(status === "canceled"
              ? {
                  canceledBy,
                  cancellationReason: cancellationReason.trim() || null
                }
              : {})
          })
        }
      );
      setSelectedAppointment(null);
      setNotice(`Статус изменён: ${statusMeta[status].label}.`);
      await refresh();
    } catch (error) {
      setFormError(appointmentErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function updateColor(colorTag: AppointmentColorTag | null) {
    if (!selectedAppointment) return;
    setIsSaving(true);
    setFormError(null);
    try {
      await apiRequest(
        `/v1/admin/appointments/${selectedAppointment.id}/color`,
        {
          method: "PATCH",
          body: JSON.stringify({ colorTag })
        }
      );
      setSelectedAppointment((previous) =>
        previous ? { ...previous, colorTag } : previous
      );
      await refresh();
    } catch (error) {
      setFormError(appointmentErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function updateAttendance() {
    if (!selectedAppointment) return;
    setIsSaving(true);
    setFormError(null);
    setNotice(null);
    try {
      await apiRequest(
        `/v1/admin/appointments/${selectedAppointment.id}/attendance`,
        {
          method: "PATCH",
          body: JSON.stringify({ status: attendanceStatus })
        }
      );
      setSelectedAppointment(null);
      setNotice("Подтверждение визита обновлено.");
      await refresh();
    } catch (error) {
      setFormError(appointmentErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  function addClosePaymentRow() {
    setClosePayments((current) => [
      ...current,
      { method: "cash", amount: "", externalTransactionId: "", note: "" }
    ]);
  }

  function updateClosePaymentRow(
    index: number,
    patch: Partial<ClosePaymentRow>
  ) {
    setClosePayments((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index ? { ...row, ...patch } : row
      )
    );
  }

  function removeClosePaymentRow(index: number) {
    setClosePayments((current) =>
      current.filter((_, rowIndex) => rowIndex !== index)
    );
  }

  async function closeAppointment() {
    if (!selectedAppointment) return;
    const payments = [];
    for (const row of closePayments) {
      const amountMinor = minorAmount(row.amount);
      if (!Number.isFinite(amountMinor) || amountMinor <= 0) {
        setFormError("Проверьте суммы платежей — они должны быть больше нуля.");
        return;
      }
      if (row.method === "other" && !row.note.trim()) {
        setFormError("Для способа оплаты «Другое» укажите комментарий.");
        return;
      }
      payments.push({
        method: row.method,
        amountMinor,
        externalTransactionId: row.externalTransactionId.trim() || null,
        note: row.note.trim() || null
      });
    }

    const redemptionPoints = Number(bonusRedemptionPoints || 0);
    const accrualPoints = Number(bonusAccrualPoints || 0);
    if (
      !Number.isInteger(redemptionPoints) ||
      redemptionPoints < 0 ||
      !Number.isInteger(accrualPoints) ||
      accrualPoints < 0
    ) {
      setFormError("Количество бонусов должно быть целым неотрицательным числом.");
      return;
    }
    if (
      workspace &&
      redemptionPoints > workspace.statistics.bonusBalancePoints
    ) {
      setFormError("Нельзя списать больше бонусов, чем есть у клиента.");
      return;
    }

    setIsClosing(true);
    setFormError(null);
    setNotice(null);
    try {
      await apiRequest(`/v1/admin/appointments/${selectedAppointment.id}/close`, {
        method: "POST",
        body: JSON.stringify({
          payments,
          note: closeNote.trim() || null,
          adjustmentReason: closeAdjustmentReason.trim() || null,
          bonusRedemptionPoints: redemptionPoints,
          bonusAccrualPoints: accrualPoints
        })
      });
      setSelectedAppointment(null);
      setNotice("Запись закрыта, оплата зафиксирована.");
      await refresh();
    } catch (error) {
      setFormError(appointmentErrorMessage(error));
    } finally {
      setIsClosing(false);
    }
  }

  async function reopenAppointment() {
    if (!selectedAppointment) return;
    if (!reopenReason.trim()) {
      setFormError("Укажите причину повторного открытия записи.");
      return;
    }

    setIsClosing(true);
    setFormError(null);
    setNotice(null);
    try {
      await apiRequest(
        `/v1/admin/appointments/${selectedAppointment.id}/reopen`,
        {
          method: "POST",
          body: JSON.stringify({ reason: reopenReason.trim() })
        }
      );
      setSelectedAppointment(null);
      setNotice("Запись снова открыта.");
      await refresh();
    } catch (error) {
      setFormError(appointmentErrorMessage(error));
    } finally {
      setIsClosing(false);
    }
  }

  async function rescheduleAppointment() {
    if (!selectedAppointment) return;
    if (!rescheduleStartsAt) {
      setFormError("Выберите свободное время для переноса.");
      return;
    }
    setIsSaving(true);
    setFormError(null);
    setNotice(null);
    try {
      const response = await apiRequest<{ appointment: Appointment }>(
        `/v1/admin/appointments/${selectedAppointment.id}/reschedule`,
        {
          method: "POST",
          body: JSON.stringify({
            startsAt: toMoscowIso(rescheduleStartsAt),
            staffId: rescheduleStaffId,
            serviceId: rescheduleServiceId,
            requestedBy: rescheduleRequestedBy
          })
        }
      );
      const newDate = moscowDateKey(new Date(response.appointment.startsAt));
      setSelectedAppointment(null);
      setSelectedDate(newDate);
      setNotice("Запись перенесена. Новая запись ожидает подтверждения.");
      await Promise.all([loadAppointments(newDate), loadOptions()]);
    } catch (error) {
      setFormError(appointmentErrorMessage(error));
      if (
        error instanceof ApiError &&
        (error.code === "appointment_slot_unavailable" ||
          error.code === "appointment_time_conflict")
      ) {
        setRescheduleStartsAt("");
        setRescheduleAvailabilityVersion((current) => current + 1);
      }
    } finally {
      setIsSaving(false);
    }
  }

  const visibleAppointments = appointments.filter(
    (appointment) =>
      appointment.status !== "canceled" && appointment.status !== "rescheduled"
  );
  const busyMinutes = visibleAppointments.reduce(
    (total, appointment) => total + durationMinutes(appointment),
    0
  );
  const attentionCount = appointments.filter(
    (appointment) =>
      appointment.status === "pending_admin_confirmation" ||
      appointment.attendanceConfirmationStatus === "pending" ||
      appointment.attendanceConfirmationStatus === "declined"
  ).length;
  const selectedClient = options?.clients.find(
    (client) => client.id === form.clientId
  );
  const selectedService = options?.services.find(
    (service) => service.id === form.serviceId
  );

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Рабочий день</p>
          <h1>Записи</h1>
          <p className="page-description">
            {selectedDateHeading(selectedDate)} · Europe/Moscow
          </p>
        </div>
        <button className="primary-button" onClick={openCreateForm} type="button">
          <CalendarPlus aria-hidden="true" size={18} />
          Новая запись
        </button>
      </header>

      {notice ? (
        <p className="feedback feedback-success" role="status">
          {notice}
        </p>
      ) : null}

      <section className="calendar-summary" aria-label="Сводка дня">
        <div>
          <span>Записей</span>
          <strong>{visibleAppointments.length}</strong>
        </div>
        <div>
          <span>Занято</span>
          <strong>{formatBusyTime(busyMinutes)}</strong>
        </div>
        <div>
          <span>Требуют внимания</span>
          <strong>{attentionCount}</strong>
        </div>
      </section>

      <section className="panel schedule-board">
        <div className="panel-heading appointments-heading">
          <div>
            <p className="section-kicker">Расписание дня</p>
            <h2>{selectedDateHeading(selectedDate)}</h2>
          </div>
          <div className="date-navigation" aria-label="Выбор даты">
            <button
              aria-label="Предыдущий день"
              className="icon-button"
              onClick={() => setSelectedDate(moveDate(selectedDate, -1))}
              title="Предыдущий день"
              type="button"
            >
              <ChevronLeft aria-hidden="true" size={17} />
            </button>
            <input
              aria-label="Дата расписания"
              onChange={(event) => setSelectedDate(event.target.value)}
              type="date"
              value={selectedDate}
            />
            <button
              aria-label="Следующий день"
              className="icon-button"
              onClick={() => setSelectedDate(moveDate(selectedDate, 1))}
              title="Следующий день"
              type="button"
            >
              <ChevronRight aria-hidden="true" size={17} />
            </button>
          </div>
        </div>

        {loadError ? (
          <div className="table-message table-message-error" role="alert">
            <p>{loadError}</p>
            <button
              className="secondary-button"
              onClick={() => void loadAppointments(selectedDate)}
              type="button"
            >
              Повторить
            </button>
          </div>
        ) : isLoading ? (
          <div className="schedule-loading" role="status">
            Загружаем расписание…
          </div>
        ) : staffColumns.length === 0 ? (
          <div className="empty-table-state schedule-empty">
            <Clock3 aria-hidden="true" size={24} />
            <div>
              <strong>Нет доступных мастеров</strong>
              <span>Добавьте бронируемых сотрудников, чтобы видеть календарь.</span>
            </div>
          </div>
        ) : (
          <div className="calendar-grid-scroll">
            <div
              className="calendar-grid-inner"
              style={{
                minWidth: 56 + staffColumns.length * 180
              }}
            >
              <div className="calendar-grid-header-row">
                <div className="calendar-grid-time-spacer" aria-hidden="true" />
                {staffColumns.map((staff) => (
                  <div className="calendar-grid-header" key={staff.id}>
                    <span className="calendar-grid-avatar">
                      {staff.photoUrl ? (
                        <img alt="" src={`${apiUrl}${staff.photoUrl}`} />
                      ) : (
                        initials(staff.displayName)
                      )}
                    </span>
                    {staff.displayName}
                  </div>
                ))}
              </div>
              <div className="calendar-grid-body-row">
                <div
                  className="calendar-grid-times"
                  style={{ height: gridTotalHeight }}
                >
                  {gridHourMarks.map((hour) => (
                    <span
                      className="calendar-grid-hour-mark"
                      key={hour}
                      style={{
                        top: (hour * 60 - gridStartMinutes) * gridPixelsPerMinute
                      }}
                    >
                      {String(hour).padStart(2, "0")}:00
                    </span>
                  ))}
                </div>
                {staffColumns.map((staff) => {
                  const staffAppointments =
                    appointmentsByStaffId.get(staff.id) ?? [];
                  const staffRanges = dayOverview[staff.id];
                  return (
                    <div
                      className="calendar-grid-column"
                      key={staff.id}
                      onClick={(event) => {
                        const rect = event.currentTarget.getBoundingClientRect();
                        const offsetMinutes =
                          (event.clientY - rect.top) / gridPixelsPerMinute;
                        const snapped = snapToGrid(
                          gridStartMinutes + offsetMinutes
                        );
                        const dayStart = new Date(`${selectedDate}T00:00:00+03:00`);
                        const candidates = [snapped, snapped + 5, snapped + 10].map(
                          (minutes) =>
                            new Date(dayStart.getTime() + minutes * 60000)
                        );
                        setQuickAddCandidateIndex(0);
                        setQuickAddPopover({
                          staffId: staff.id,
                          clientX: event.clientX,
                          clientY: event.clientY,
                          candidates
                        });
                      }}
                      style={{ height: gridTotalHeight }}
                    >
                      {staffRanges
                        ? closedGridSegments(staffRanges).map((segment, index) => (
                            <div
                              aria-hidden="true"
                              className="calendar-grid-closed"
                              key={index}
                              style={{ top: segment.top, height: segment.height }}
                            />
                          ))
                        : null}
                      {gridHourMarks.map((hour) => (
                        <div
                          aria-hidden="true"
                          className="calendar-grid-gridline"
                          key={hour}
                          style={{
                            top:
                              (hour * 60 - gridStartMinutes) *
                              gridPixelsPerMinute
                          }}
                        />
                      ))}
                      {staffAppointments.map((appointment) => {
                        const fillTone = appointmentFillTone(appointment);
                        const startMinutes = moscowMinutesOfDay(
                          new Date(appointment.startsAt)
                        );
                        const top = Math.max(
                          0,
                          (startMinutes - gridStartMinutes) *
                            gridPixelsPerMinute
                        );
                        const height = Math.max(
                          30,
                          durationMinutes(appointment) * gridPixelsPerMinute
                        );
                        return (
                          <button
                            className={`calendar-block agenda-fill-${fillTone}${
                              appointment.source === "online"
                                ? " calendar-block-online"
                                : ""
                            }`}
                            key={appointment.id}
                            onClick={(event) => {
                              event.stopPropagation();
                              openAppointment(appointment);
                            }}
                            onFocus={() => prefetchWorkspace(appointment.id)}
                            onMouseEnter={() => prefetchWorkspace(appointment.id)}
                            onTouchStart={() => prefetchWorkspace(appointment.id)}
                            style={{ top, height }}
                            title={`${timeFormatter.format(
                              new Date(appointment.startsAt)
                            )} · ${
                              appointment.client.fullName ??
                              appointment.client.phone
                            }`}
                            type="button"
                          >
                            <strong>
                              {timeFormatter.format(
                                new Date(appointment.startsAt)
                              )}
                            </strong>
                            <span>
                              {appointment.client.fullName ??
                                appointment.client.phone}
                            </span>
                            <small>{appointment.service.titleRu}</small>
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </section>

      {quickAddPopover ? (
        <>
          <div
            className="quick-add-overlay"
            onClick={() => setQuickAddPopover(null)}
          />
          <div
            className="quick-add-popover"
            style={{ left: quickAddPopover.clientX, top: quickAddPopover.clientY }}
          >
            <p className="quick-add-popover-title">Время начала</p>
            <div className="quick-add-popover-times">
              {quickAddPopover.candidates.map((candidate, index) => (
                <button
                  className={`quick-add-time${
                    index === quickAddCandidateIndex
                      ? " quick-add-time-selected"
                      : ""
                  }`}
                  key={index}
                  onClick={() => setQuickAddCandidateIndex(index)}
                  type="button"
                >
                  {timeFormatter.format(candidate)}
                </button>
              ))}
            </div>
            <button
              className="primary-button"
              onClick={() => {
                openCreateFormAt(
                  quickAddPopover.staffId,
                  quickAddPopover.candidates[quickAddCandidateIndex]
                );
                setQuickAddPopover(null);
              }}
              type="button"
            >
              Добавить запись
            </button>
          </div>
        </>
      ) : null}

      {isCreateOpen ? (
        <Modal
          description="После создания запись попадёт на ручное подтверждение."
          onClose={() => setIsCreateOpen(false)}
          title="Новая запись"
        >
          <form
            className="modal-form"
            onSubmit={(event) => void submitAppointment(event)}
          >
            {!options?.clients.length ? (
              <div className="form-empty-state">
                <TriangleAlert aria-hidden="true" size={20} />
                <div>
                  <strong>Сначала добавьте клиента</strong>
                  <span>Для записи нужен клиент с номером телефона.</span>
                </div>
                <Link className="secondary-button" href="/clients">
                  Перейти к клиентам
                </Link>
              </div>
            ) : (
              <>
                <div className="form-grid form-grid-two">
                  <label className="form-field">
                    <span>Клиент</span>
                    <select
                      autoFocus
                      onChange={(event) => updateForm("clientId", event.target.value)}
                      required
                      value={form.clientId}
                    >
                      {options.clients.map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.fullName ?? "Без имени"} · {client.phone}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="form-field">
                    <span>Мастер</span>
                    <select
                      onChange={(event) => {
                        updateForm("staffId", event.target.value);
                        updateForm("startsAt", "");
                      }}
                      required
                      value={form.staffId}
                    >
                      {options.staff.map((staff) => (
                        <option key={staff.id} value={staff.id}>
                          {staff.displayName}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="form-field">
                    <span>Услуга</span>
                    <select
                      onChange={(event) => {
                        updateForm("serviceId", event.target.value);
                        updateForm("startsAt", "");
                      }}
                      required
                      value={form.serviceId}
                    >
                      {options.services.map((service) => (
                        <option key={service.id} value={service.id}>
                          {service.titleRu} · {service.durationMinutes} мин
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="form-field">
                    <span>Дата</span>
                    <input
                      max={moveDate(
                        moscowDateKey(),
                        bookingRules.bookingHorizonDays
                      )}
                      min={moscowDateKey()}
                      onChange={(event) => {
                        setBookingDate(event.target.value);
                        updateForm("startsAt", "");
                      }}
                      required
                      type="date"
                      value={bookingDate}
                    />
                  </label>
                </div>

                <AvailabilityPicker
                  error={availabilityError}
                  isLoading={isAvailabilityLoading}
                  onSelect={(startsAt) => updateForm("startsAt", startsAt)}
                  selectedStartsAt={form.startsAt}
                  slots={availableSlots}
                />

                {selectedClient?.requiresPrepayment ? (
                  <p className="feedback feedback-warning">
                    Для этого клиента следующая запись доступна только по
                    предоплате.
                  </p>
                ) : null}

                {selectedService ? (
                  <p className="form-hint">
                    Окончание рассчитается автоматически через {" "}
                    {selectedService.durationMinutes} минут.
                  </p>
                ) : null}

                <label className="form-field">
                  <span>Комментарий клиента</span>
                  <textarea
                    maxLength={2000}
                    onChange={(event) =>
                      updateForm("clientComment", event.target.value)
                    }
                    rows={2}
                    value={form.clientComment}
                  />
                </label>
                <label className="form-field">
                  <span>Внутренняя заметка</span>
                  <textarea
                    maxLength={4000}
                    onChange={(event) =>
                      updateForm("internalNote", event.target.value)
                    }
                    rows={2}
                    value={form.internalNote}
                  />
                </label>
              </>
            )}

            {formError ? (
              <p className="feedback feedback-error" role="alert">
                {formError}
              </p>
            ) : null}

            <footer className="modal-actions">
              <button
                className="secondary-button"
                onClick={() => setIsCreateOpen(false)}
                type="button"
              >
                Отмена
              </button>
              {options?.clients.length ? (
                <button
                  className="primary-button"
                  disabled={isSaving || !form.startsAt}
                  type="submit"
                >
                  {isSaving ? "Создаём…" : "Создать запись"}
                </button>
              ) : null}
            </footer>
          </form>
        </Modal>
      ) : null}

      {selectedAppointment ? (
        <Modal
          description={`${selectedAppointment.service.titleRu} · ${timeFormatter.format(
            new Date(selectedAppointment.startsAt)
          )}`}
          onClose={() => setSelectedAppointment(null)}
          size="workspace"
          title={
            selectedAppointment.client.fullName ?? selectedAppointment.client.phone
          }
        >
          <div className="appointment-workspace-shell">
            <section className="workspace-record-summary">
              <button
                className="workspace-record-client"
                onClick={() => setWorkspaceTab("client")}
                type="button"
              >
                <span className="workspace-record-avatar" aria-hidden="true">
                  {(selectedAppointment.client.fullName ?? "К")
                    .slice(0, 1)
                    .toUpperCase()}
                </span>
                <span>
                  <small>Клиент</small>
                  <strong>
                    {selectedAppointment.client.fullName ?? "Без имени"}
                  </strong>
                  <span>
                    <Phone aria-hidden="true" size={12} />
                    {selectedAppointment.client.phone}
                  </span>
                </span>
              </button>

              <div className="workspace-record-facts">
                <div>
                  <small>Услуга</small>
                  <strong>{selectedAppointment.service.titleRu}</strong>
                </div>
                <div>
                  <small>Дата и время</small>
                  <strong>
                    {dateTimeFormatter.format(
                      new Date(selectedAppointment.startsAt)
                    )}
                  </strong>
                </div>
                <div>
                  <small>Мастер</small>
                  <strong>{selectedAppointment.staff.displayName}</strong>
                </div>
                <div>
                  <small>Итого</small>
                  <strong>
                    {formatMoney(
                      selectedAppointment.priceMinor,
                      selectedAppointment.currency
                    )}
                  </strong>
                </div>
              </div>

              <div className="workspace-record-actions">
                <span
                  className={`status status-${statusMeta[selectedAppointment.status].tone}`}
                >
                  {statusMeta[selectedAppointment.status].label}
                </span>
                {closableStatuses.includes(
                  selectedAppointment.status as (typeof closableStatuses)[number]
                ) ? (
                  <button
                    className="workspace-payment-button"
                    onClick={focusPayment}
                    type="button"
                  >
                    <CreditCard aria-hidden="true" size={16} />
                    Оформить оплату
                  </button>
                ) : selectedAppointment.status === "completed" ? (
                  <button
                    className="workspace-payment-button is-complete"
                    onClick={focusPayment}
                    type="button"
                  >
                    <CreditCard aria-hidden="true" size={16} />
                    Оплата проведена
                  </button>
                ) : null}
              </div>
            </section>
            <nav aria-label="Разделы карточки записи" className="workspace-tabs">
              {workspaceTabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    aria-current={workspaceTab === tab.value ? "page" : undefined}
                    className={workspaceTab === tab.value ? "is-active" : ""}
                    key={tab.value}
                    onClick={() => setWorkspaceTab(tab.value)}
                    type="button"
                  >
                    <Icon aria-hidden="true" size={15} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>
            <div className="modal-form appointment-editor appointment-workspace-body">
            {isWorkspaceLoading ? (
              <div className="workspace-loading" role="status">
                <LoaderCircle aria-hidden="true" className="spin" size={18} />
                Загружаем карточку клиента…
              </div>
            ) : null}
            {workspaceError ? (
              <p className="feedback feedback-error" role="alert">
                {workspaceError}
              </p>
            ) : null}
            {workspaceTab === "appointment" ? (
              <>
            <div className="workspace-appointment-layout">
            <dl className="appointment-details">
              <div>
                <dt>Мастер</dt>
                <dd>{selectedAppointment.staff.displayName}</dd>
              </div>
              <div>
                <dt>Телефон</dt>
                <dd>{selectedAppointment.client.phone}</dd>
              </div>
              <div>
                <dt>Статус</dt>
                <dd>{statusMeta[selectedAppointment.status].label}</dd>
              </div>
              <div>
                <dt>Источник записи</dt>
                <dd>{appointmentSourceLabel(selectedAppointment)}</dd>
              </div>
              <div>
                <dt>Стоимость</dt>
                <dd>
                  {formatMoney(
                    selectedAppointment.priceMinor,
                    selectedAppointment.currency
                  )}
                </dd>
              </div>
              <div>
                <dt>Подтверждение визита</dt>
                <dd>
                  {attendanceMeta[
                    selectedAppointment.attendanceConfirmationStatus
                  ]}
                </dd>
              </div>
            </dl>

            <section className="editor-section">
              <div className="editor-section-heading">
                <div>
                  <p className="section-kicker">Модерация</p>
                  <h2>Статус записи</h2>
                </div>
              </div>
              <div className="form-grid form-grid-two">
                <label className="form-field">
                  <span>Новый статус</span>
                  <select
                    onChange={(event) =>
                      setStatus(
                        event.target.value as (typeof manageableStatuses)[number]
                      )
                    }
                    value={status}
                  >
                    {manageableStatuses.map((value) => (
                      <option key={value} value={value}>
                        {statusMeta[value].label}
                      </option>
                    ))}
                  </select>
                </label>
                {status === "canceled" ? (
                  <label className="form-field">
                    <span>Инициатор отмены</span>
                    <select
                      onChange={(event) =>
                        setCanceledBy(event.target.value as "client" | "studio")
                      }
                      value={canceledBy}
                    >
                      <option value="studio">Студия</option>
                      <option value="client">Клиент</option>
                    </select>
                  </label>
                ) : null}
              </div>
              {status === "canceled" ? (
                <label className="form-field">
                  <span>Причина отмены</span>
                  <input
                    maxLength={1000}
                    onChange={(event) => setCancellationReason(event.target.value)}
                    value={cancellationReason}
                  />
                </label>
              ) : null}
              <button
                className="secondary-button editor-action"
                disabled={isSaving}
                onClick={() => void updateStatus()}
                type="button"
              >
                Обновить статус
              </button>
            </section>

            <section className="editor-section">
              <div className="editor-section-heading">
                <div>
                  <p className="section-kicker">Личная метка</p>
                  <h2>Цвет записи</h2>
                </div>
              </div>
              <div className="color-swatch-row">
                <button
                  aria-label="Цвет по умолчанию (по статусу)"
                  aria-pressed={selectedAppointment.colorTag === null}
                  className={`color-swatch color-swatch-auto${
                    selectedAppointment.colorTag === null
                      ? " color-swatch-selected"
                      : ""
                  }`}
                  disabled={isSaving}
                  onClick={() => void updateColor(null)}
                  title="По статусу"
                  type="button"
                />
                {appointmentColorTags.map((tag) => (
                  <button
                    aria-label={tag}
                    aria-pressed={selectedAppointment.colorTag === tag}
                    className={`color-swatch color-swatch-${tag}${
                      selectedAppointment.colorTag === tag
                        ? " color-swatch-selected"
                        : ""
                    }`}
                    disabled={isSaving}
                    key={tag}
                    onClick={() => void updateColor(tag)}
                    type="button"
                  />
                ))}
              </div>
            </section>

            {closableStatuses.includes(
              selectedAppointment.status as (typeof closableStatuses)[number]
            ) ? (
              <section className="editor-section workspace-payment-section" id="appointment-payment">
                <div className="editor-section-heading">
                  <div>
                    <p className="section-kicker">Визит состоялся</p>
                    <h2>Закрыть запись с оплатой</h2>
                  </div>
                </div>
                {closePayments.map((row, index) => (
                  <div className="form-grid form-grid-two close-payment-row" key={index}>
                    <label className="form-field">
                      <span>Способ оплаты</span>
                      <select
                        onChange={(event) =>
                          updateClosePaymentRow(index, {
                            method: event.target.value as PaymentMethod
                          })
                        }
                        value={row.method}
                      >
                        {Object.entries(paymentMethodMeta).map(
                          ([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          )
                        )}
                      </select>
                    </label>
                    <label className="form-field">
                      <span>Сумма</span>
                      <input
                        inputMode="decimal"
                        onChange={(event) =>
                          updateClosePaymentRow(index, {
                            amount: event.target.value
                          })
                        }
                        placeholder="0"
                        value={row.amount}
                      />
                    </label>
                    {row.method !== "cash" ? (
                      <label className="form-field">
                        <span>Номер транзакции</span>
                        <input
                          maxLength={200}
                          onChange={(event) =>
                            updateClosePaymentRow(index, {
                              externalTransactionId: event.target.value
                            })
                          }
                          value={row.externalTransactionId}
                        />
                      </label>
                    ) : null}
                    {row.method === "other" ? (
                      <label className="form-field form-field-span-two">
                        <span>Комментарий к способу оплаты</span>
                        <input
                          maxLength={500}
                          onChange={(event) =>
                            updateClosePaymentRow(index, {
                              note: event.target.value
                            })
                          }
                          placeholder="Обязательно укажите, как принята оплата"
                          value={row.note}
                        />
                      </label>
                    ) : null}
                    <button
                      aria-label="Удалить платёж"
                      className="secondary-button"
                      onClick={() => removeClosePaymentRow(index)}
                      type="button"
                    >
                      Убрать
                    </button>
                  </div>
                ))}
                <button
                  className="secondary-button"
                  onClick={addClosePaymentRow}
                  type="button"
                >
                  Добавить платёж
                </button>
                <div className="workspace-bonus-close">
                  <div>
                    <span>Бонусный баланс</span>
                    <strong>
                      {workspace?.statistics.bonusBalancePoints ?? 0} бонусов
                    </strong>
                    <small>1 бонус уменьшает оплату на 1 единицу валюты</small>
                  </div>
                  <label className="form-field">
                    <span>Списать бонусов</span>
                    <input
                      inputMode="numeric"
                      min="0"
                      onChange={(event) =>
                        setBonusRedemptionPoints(event.target.value)
                      }
                      type="number"
                      value={bonusRedemptionPoints}
                    />
                  </label>
                  <label className="form-field">
                    <span>Начислить бонусов</span>
                    <input
                      inputMode="numeric"
                      min="0"
                      onChange={(event) =>
                        setBonusAccrualPoints(event.target.value)
                      }
                      type="number"
                      value={bonusAccrualPoints}
                    />
                  </label>
                </div>
                <label className="form-field">
                  <span>Причина расхождения (скидка, долг, возврат)</span>
                  <input
                    maxLength={1000}
                    onChange={(event) =>
                      setCloseAdjustmentReason(event.target.value)
                    }
                    placeholder="Заполните, если сумма платежей не равна стоимости"
                    value={closeAdjustmentReason}
                  />
                </label>
                <label className="form-field">
                  <span>Комментарий к закрытию</span>
                  <input
                    maxLength={1000}
                    onChange={(event) => setCloseNote(event.target.value)}
                    value={closeNote}
                  />
                </label>
                <button
                  className="primary-button editor-action"
                  disabled={isClosing}
                  onClick={() => void closeAppointment()}
                  type="button"
                >
                  {isClosing ? "Закрываем…" : "Закрыть запись"}
                </button>
              </section>
            ) : null}

            {selectedAppointment.status === "completed" ? (
              <section className="editor-section workspace-payment-section" id="appointment-payment">
                <div className="editor-section-heading">
                  <div>
                    <p className="section-kicker">Оплата</p>
                    <h2>Запись закрыта</h2>
                  </div>
                </div>
                {selectedAppointment.payments.length ? (
                  <ul className="payment-summary-list">
                    {selectedAppointment.payments.map((payment) => (
                      <li key={payment.id}>
                        {paymentMethodMeta[payment.method]} ·{" "}
                        {formatMoney(payment.amountMinor, payment.currency)}
                        {payment.externalTransactionId
                          ? ` · ${payment.externalTransactionId}`
                          : ""}
                        {payment.note ? ` · ${payment.note}` : ""}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted-label">
                    Платежи не зафиксированы (закрыто с корректировкой).
                  </p>
                )}
                <p className="muted-label">
                  Закрыл:{" "}
                  {selectedAppointment.closedBy?.staffProfile?.displayName ??
                    selectedAppointment.closedBy?.email ??
                    "—"}
                </p>
                <label className="form-field">
                  <span>Причина повторного открытия</span>
                  <input
                    maxLength={1000}
                    onChange={(event) => setReopenReason(event.target.value)}
                    value={reopenReason}
                  />
                </label>
                <button
                  className="secondary-button editor-action"
                  disabled={isClosing}
                  onClick={() => void reopenAppointment()}
                  type="button"
                >
                  Переоткрыть запись
                </button>
              </section>
            ) : null}

            <section className="editor-section">
              <div className="editor-section-heading">
                <div>
                  <p className="section-kicker">Перед визитом</p>
                  <h2>Подтверждение клиента</h2>
                </div>
              </div>
              <div className="editor-inline-action">
                <label className="form-field">
                  <span>Состояние</span>
                  <select
                    onChange={(event) =>
                      setAttendanceStatus(event.target.value as AttendanceStatus)
                    }
                    value={attendanceStatus}
                  >
                    {Object.entries(attendanceMeta).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="secondary-button"
                  disabled={isSaving}
                  onClick={() => void updateAttendance()}
                  type="button"
                >
                  Сохранить
                </button>
              </div>
            </section>

            <section className="editor-section">
              <div className="editor-section-heading">
                <div>
                  <p className="section-kicker">Изменение времени</p>
                  <h2>Перенос записи</h2>
                </div>
                <button
                  className="secondary-button"
                  onClick={() => setIsRescheduling((value) => !value)}
                  type="button"
                >
                  {isRescheduling ? "Скрыть" : "Перенести"}
                </button>
              </div>
              {isRescheduling ? (
                <div className="reschedule-fields">
                  <div className="form-grid form-grid-two">
                    <label className="form-field">
                      <span>Мастер</span>
                      <select
                        onChange={(event) => {
                          setRescheduleStaffId(event.target.value);
                          setRescheduleStartsAt("");
                        }}
                        required
                        value={rescheduleStaffId}
                      >
                        {options?.staff.map((staff) => (
                          <option key={staff.id} value={staff.id}>
                            {staff.displayName}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="form-field">
                      <span>Услуга</span>
                      <select
                        onChange={(event) => {
                          setRescheduleServiceId(event.target.value);
                          setRescheduleStartsAt("");
                        }}
                        required
                        value={rescheduleServiceId}
                      >
                        {options?.services.map((service) => (
                          <option key={service.id} value={service.id}>
                            {service.titleRu} · {service.durationMinutes} мин
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="form-field">
                      <span>Новая дата</span>
                      <input
                        max={moveDate(
                          moscowDateKey(),
                          bookingRules.bookingHorizonDays
                        )}
                        min={moscowDateKey()}
                        onChange={(event) => {
                          setRescheduleDate(event.target.value);
                          setRescheduleStartsAt("");
                        }}
                        required
                        type="date"
                        value={rescheduleDate}
                      />
                    </label>
                    <label className="form-field">
                      <span>Инициатор переноса</span>
                      <select
                        onChange={(event) =>
                          setRescheduleRequestedBy(
                            event.target.value as "client" | "studio"
                          )
                        }
                        value={rescheduleRequestedBy}
                      >
                        <option value="studio">Студия</option>
                        <option value="client">Клиент</option>
                      </select>
                    </label>
                  </div>
                  <AvailabilityPicker
                    error={rescheduleAvailabilityError}
                    isLoading={isRescheduleAvailabilityLoading}
                    onSelect={setRescheduleStartsAt}
                    selectedStartsAt={rescheduleStartsAt}
                    slots={rescheduleSlots}
                  />
                  <button
                    className="primary-button editor-action"
                    disabled={isSaving || !rescheduleStartsAt}
                    onClick={() => void rescheduleAppointment()}
                    type="button"
                  >
                    Подтвердить перенос
                  </button>
                </div>
              ) : null}
            </section>

            </div>
              </>
            ) : null}

            {workspaceTab === "client" && workspace ? (
              <div className="workspace-panel">
                <section className="workspace-client-hero">
                  <div className="workspace-avatar" aria-hidden="true">
                    {(workspace.appointment.client.fullName ?? "К")
                      .slice(0, 1)
                      .toUpperCase()}
                  </div>
                  <div>
                    <p className="section-kicker">Клиент</p>
                    <h2>
                      {workspace.appointment.client.fullName ?? "Без имени"}
                    </h2>
                    <p>{workspace.appointment.client.phone}</p>
                  </div>
                  <span className="workspace-loyalty-status">
                    {workspace.appointment.client.loyaltyStatus?.titleRu ??
                      "Статус не назначен"}
                  </span>
                </section>

                {workspace.appointment.client.allergenAssignments.length ||
                workspace.appointment.client.customAllergyNote ? (
                  <section className="workspace-alert">
                    <TriangleAlert aria-hidden="true" size={18} />
                    <div>
                      <strong>Проверьте аллергии перед визитом</strong>
                      <p>
                        {[
                          ...workspace.appointment.client.allergenAssignments.map(
                            (assignment) => assignment.allergen.title
                          ),
                          workspace.appointment.client.customAllergyNote
                        ]
                          .filter(Boolean)
                          .join(", ")}
                      </p>
                    </div>
                  </section>
                ) : null}

                <dl className="workspace-definition-grid">
                  <div>
                    <dt>Email</dt>
                    <dd>{workspace.appointment.client.email ?? "Не указан"}</dd>
                  </div>
                  <div>
                    <dt>Telegram</dt>
                    <dd>
                      {workspace.appointment.client.telegramUsername
                        ? `@${workspace.appointment.client.telegramUsername.replace(/^@/, "")}`
                        : "Не указан"}
                    </dd>
                  </div>
                  <div>
                    <dt>WhatsApp</dt>
                    <dd>
                      {workspace.appointment.client.whatsappPhone ?? "Не указан"}
                    </dd>
                  </div>
                  <div>
                    <dt>Предоплата</dt>
                    <dd>
                      {workspace.appointment.client.requiresPrepayment
                        ? workspace.appointment.client.prepaymentReason ??
                          "Обязательна"
                        : "Не требуется"}
                    </dd>
                  </div>
                </dl>

                <section className="workspace-subsection">
                  <div className="editor-section-heading">
                    <div>
                      <p className="section-kicker">Только для сотрудников</p>
                      <h2>Внутренние теги</h2>
                    </div>
                  </div>
                  {workspace.appointment.client.privateTagAssignments.length ? (
                    <div className="workspace-tag-cloud">
                      {workspace.appointment.client.privateTagAssignments.map(
                        (assignment) => (
                          <span
                            key={assignment.id}
                            style={
                              assignment.tag.color
                                ? { borderColor: assignment.tag.color }
                                : undefined
                            }
                          >
                            {assignment.tag.title}
                          </span>
                        )
                      )}
                    </div>
                  ) : (
                    <p className="workspace-empty">Теги не назначены.</p>
                  )}
                  <p className="workspace-note">
                    {workspace.appointment.client.notes ??
                      "Внутренних заметок пока нет."}
                  </p>
                </section>
              </div>
            ) : null}

            {workspaceTab === "history" && workspace ? (
              <div className="workspace-panel">
                <div className="workspace-panel-heading">
                  <div>
                    <p className="section-kicker">Все визиты клиента</p>
                    <h2>История записей</h2>
                  </div>
                  <strong>{workspace.statistics.totalAppointments}</strong>
                </div>
                {workspace.history.length ? (
                  <div className="workspace-table-wrap">
                    <table className="workspace-table">
                      <thead>
                        <tr>
                          <th>Дата</th>
                          <th>Мастер</th>
                          <th>Услуга</th>
                          <th>Статус</th>
                          <th>Сумма</th>
                        </tr>
                      </thead>
                      <tbody>
                        {workspace.history.map((appointment) => (
                          <tr key={appointment.id}>
                            <td>{dateTimeFormatter.format(new Date(appointment.startsAt))}</td>
                            <td>{appointment.staff.displayName}</td>
                            <td>{appointment.service.titleRu}</td>
                            <td>
                              <span className={`status status-${statusMeta[appointment.status].tone}`}>
                                {statusMeta[appointment.status].label}
                              </span>
                            </td>
                            <td>
                              {formatMoney(
                                appointment.payments.length
                                  ? appointment.payments.reduce(
                                      (sum, payment) => sum + payment.amountMinor,
                                      0
                                    )
                                  : appointment.priceMinor,
                                appointment.currency
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="workspace-empty">Других записей пока нет.</p>
                )}
              </div>
            ) : null}

            {workspaceTab === "statistics" && workspace ? (
              <div className="workspace-panel">
                <div className="workspace-panel-heading">
                  <div>
                    <p className="section-kicker">Поведение клиента</p>
                    <h2>Статистика посещений</h2>
                  </div>
                </div>
                <div className="workspace-metrics">
                  <div>
                    <span>Всего записей</span>
                    <strong>{workspace.statistics.totalAppointments}</strong>
                  </div>
                  <div>
                    <span>Завершено</span>
                    <strong>{workspace.statistics.completedAppointments}</strong>
                  </div>
                  <div>
                    <span>Отменено</span>
                    <strong>{workspace.statistics.canceledAppointments}</strong>
                  </div>
                  <div>
                    <span>Неявки</span>
                    <strong>{workspace.statistics.noShowAppointments}</strong>
                  </div>
                  <div>
                    <span>Визитов в месяц</span>
                    <strong>{workspace.statistics.visitsPerMonth}</strong>
                  </div>
                  <div>
                    <span>Последний визит</span>
                    <strong>
                      {workspace.statistics.lastCompletedAt
                        ? dateTimeFormatter.format(
                            new Date(workspace.statistics.lastCompletedAt)
                          )
                        : "—"}
                    </strong>
                  </div>
                </div>
                <div className="workspace-finance-grid">
                  {Object.entries(workspace.statistics.spendByCurrency).map(
                    ([currency, amount]) => (
                      <div key={currency}>
                        <span>Потрачено · {currency}</span>
                        <strong>{formatMoney(amount, currency)}</strong>
                        <small>
                          Средний чек {formatMoney(
                            workspace.statistics.averageCheckByCurrency[currency] ?? 0,
                            currency
                          )}
                        </small>
                      </div>
                    )
                  )}
                </div>
              </div>
            ) : null}

            {workspaceTab === "bonuses" && workspace ? (
              <div className="workspace-panel">
                <div className="workspace-panel-heading">
                  <div>
                    <p className="section-kicker">Программа лояльности</p>
                    <h2>Бонусный счёт</h2>
                  </div>
                  <strong>{workspace.statistics.bonusBalancePoints}</strong>
                </div>
                <p className="workspace-note">
                  Начисление и списание для текущего визита выполняются при его
                  финансовом закрытии на вкладке «Запись». Ручную корректировку
                  баланса вне визита можно сделать в карточке клиента.
                </p>
                {workspace.appointment.client.loyaltyTransactions.length ? (
                  <div className="workspace-ledger">
                    {workspace.appointment.client.loyaltyTransactions.map(
                      (transaction) => (
                        <div key={transaction.id}>
                          <span
                            className={
                              transaction.pointsDelta >= 0
                                ? "ledger-positive"
                                : "ledger-negative"
                            }
                          >
                            {transaction.pointsDelta >= 0 ? "+" : ""}
                            {transaction.pointsDelta}
                          </span>
                          <div>
                            <strong>{transaction.reason ?? "Операция по бонусам"}</strong>
                            <small>
                              {dateTimeFormatter.format(new Date(transaction.createdAt))}
                              {" · "}
                              {transaction.createdBy?.staffProfile?.displayName ??
                                transaction.createdBy?.email ??
                                "Система"}
                            </small>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                ) : (
                  <p className="workspace-empty">Операций пока нет.</p>
                )}
              </div>
            ) : null}

            {workspaceTab === "notifications" && workspace ? (
              <div className="workspace-panel">
                <div className="workspace-panel-heading">
                  <div>
                    <p className="section-kicker">Связь с клиентом</p>
                    <h2>Уведомления по записи</h2>
                  </div>
                </div>
                {workspace.notificationJobs.length ? (
                  <div className="workspace-ledger">
                    {workspace.notificationJobs.map((notification) => (
                      <div key={notification.id}>
                        <span className="notification-channel">
                          {notification.channel.toUpperCase()}
                        </span>
                        <div>
                          <strong>
                            {notification.templateCode ?? "Уведомление"}
                          </strong>
                          <small>
                            {dateTimeFormatter.format(
                              new Date(notification.scheduledAt)
                            )}
                            {notification.sentAt
                              ? " · отправлено"
                              : notification.failedAt
                                ? " · ошибка"
                                : " · запланировано"}
                          </small>
                          {notification.error ? <p>{notification.error}</p> : null}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="workspace-empty">
                    Уведомления по этой записи ещё не создавались.
                  </p>
                )}
              </div>
            ) : null}

            {workspaceTab === "activity" && workspace ? (
              <div className="workspace-panel">
                <div className="workspace-panel-heading">
                  <div>
                    <p className="section-kicker">Неизменяемая хронология</p>
                    <h2>История изменений</h2>
                  </div>
                </div>
                {workspace.appointment.events.length ? (
                  <div className="workspace-timeline">
                    {workspace.appointment.events.map((event) => (
                      <div key={event.id}>
                        <span aria-hidden="true" />
                        <div>
                          <strong>
                            {event.fromStatus
                              ? `${statusMeta[event.fromStatus].label} → `
                              : ""}
                            {statusMeta[event.toStatus].label}
                          </strong>
                          <p>{event.note ?? "Статус записи изменён"}</p>
                          <small>
                            {dateTimeFormatter.format(new Date(event.createdAt))}
                            {" · "}
                            {event.actor?.staffProfile?.displayName ??
                              event.actor?.email ??
                              "Система"}
                          </small>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="workspace-empty">Изменений пока нет.</p>
                )}
              </div>
            ) : null}

            {formError ? (
              <p className="feedback feedback-error" role="alert">
                {formError}
              </p>
            ) : null}
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
