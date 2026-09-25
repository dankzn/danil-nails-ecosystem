"use client";

import { bookingRules } from "@danil-nails/shared";
import {
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Pencil,
  TriangleAlert
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ApiError, apiRequest } from "../lib/api";
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
type PaymentMethod = "online_acquiring" | "cash" | "phone_transfer";

type AppointmentPayment = {
  id: string;
  method: PaymentMethod;
  amountMinor: number;
  currency: string;
  externalTransactionId: string | null;
  occurredAt: string;
  receivedBy: {
    email: string | null;
    staffProfile: { displayName: string } | null;
  } | null;
};

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
  staff: Array<{ id: string; displayName: string }>;
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

const attendanceMeta: Record<AttendanceStatus, string> = {
  not_requested: "Не запрашивалось",
  pending: "Ждём ответа клиента",
  confirmed: "Клиент подтвердил визит",
  declined: "Клиент не подтвердил"
};

const paymentMethodMeta: Record<PaymentMethod, string> = {
  online_acquiring: "Онлайн-эквайринг",
  cash: "Наличные",
  phone_transfer: "Перевод по номеру телефона"
};

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
  const [appointments, setAppointments] = useState<Appointment[]>([]);
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
  const [reopenReason, setReopenReason] = useState("");
  const [isClosing, setIsClosing] = useState(false);

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

  function openAppointment(appointment: Appointment) {
    const today = moscowDateKey();
    const latestDate = moveDate(today, bookingRules.bookingHorizonDays);
    const appointmentDate = moscowDateKey(new Date(appointment.startsAt));
    const initialDate =
      appointmentDate >= today && appointmentDate <= latestDate
        ? appointmentDate
        : today;
    setSelectedAppointment(appointment);
    setStatus(
      appointment.status === "canceled" || appointment.status === "no_show"
        ? appointment.status
        : "confirmed"
    );
    setClosePayments(
      closableStatuses.includes(
        appointment.status as (typeof closableStatuses)[number]
      )
        ? [{ method: "cash", amount: "", externalTransactionId: "" }]
        : []
    );
    setCloseAdjustmentReason("");
    setCloseNote("");
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

  function updateForm<Key extends keyof BookingForm>(
    key: Key,
    value: BookingForm[Key]
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function refresh() {
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
      { method: "cash", amount: "", externalTransactionId: "" }
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
      payments.push({
        method: row.method,
        amountMinor,
        externalTransactionId: row.externalTransactionId.trim() || null
      });
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
          adjustmentReason: closeAdjustmentReason.trim() || null
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
        ) : appointments.length === 0 ? (
          <div className="empty-table-state schedule-empty">
            <Clock3 aria-hidden="true" size={24} />
            <div>
              <strong>На этот день записей нет</strong>
              <span>Свободный день или расписание ещё не заполнено.</span>
            </div>
          </div>
        ) : (
          <div className="day-agenda">
            {appointments.map((appointment) => {
              const meta = statusMeta[appointment.status];
              return (
                <article className="agenda-item" key={appointment.id}>
                  <div className="agenda-time">
                    <strong>
                      {timeFormatter.format(new Date(appointment.startsAt))}
                    </strong>
                    <span>{durationMinutes(appointment)} мин</span>
                  </div>
                  <div
                    className={`agenda-line agenda-line-${meta.tone}`}
                    aria-hidden="true"
                  />
                  <div className="agenda-content">
                    <div>
                      <strong>
                        {appointment.client.fullName ?? appointment.client.phone}
                      </strong>
                      <span>{appointment.service.titleRu}</span>
                      <small>
                        {appointment.staff.displayName} · {appointment.client.phone}
                      </small>
                      <small>Источник: {appointmentSourceLabel(appointment)}</small>
                    </div>
                    <div className="agenda-actions">
                      <span className={`status status-${meta.tone}`}>
                        {meta.label}
                      </span>
                      {appointment.attendanceConfirmationStatus !==
                      "not_requested" ? (
                        <small className="attendance-label">
                          {attendanceMeta[
                            appointment.attendanceConfirmationStatus
                          ]}
                        </small>
                      ) : null}
                      <button
                        aria-label={`Открыть запись ${
                          appointment.client.fullName ?? appointment.client.phone
                        }`}
                        className="icon-button"
                        onClick={() => openAppointment(appointment)}
                        title="Открыть запись"
                        type="button"
                      >
                        <Pencil aria-hidden="true" size={15} />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

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
          title={
            selectedAppointment.client.fullName ?? selectedAppointment.client.phone
          }
        >
          <div className="modal-form appointment-editor">
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

            {closableStatuses.includes(
              selectedAppointment.status as (typeof closableStatuses)[number]
            ) ? (
              <section className="editor-section">
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
              <section className="editor-section">
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

            {formError ? (
              <p className="feedback feedback-error" role="alert">
                {formError}
              </p>
            ) : null}
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
