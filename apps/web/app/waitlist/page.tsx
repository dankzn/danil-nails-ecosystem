"use client";

import { Ban, CalendarCheck, Phone, Plus } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ApiError, apiRequest } from "../lib/api";
import { Modal } from "../ui/modal";

type WaitlistStatus = "waiting" | "notified" | "booked" | "canceled";
type Entry = {
  id: string;
  status: WaitlistStatus;
  preferredFrom: string;
  preferredTo: string;
  note: string | null;
  client: { id: string; fullName: string | null; phone: string; telegramUsername: string | null };
  service: { id: string; titleRu: string; durationMinutes: number };
  staff: { id: string; displayName: string } | null;
};
type BookingOptions = {
  clients: Array<{ id: string; fullName: string | null; phone: string }>;
  services: Array<{ id: string; titleRu: string }>;
  staff: Array<{ id: string; displayName: string }>;
};

const statusMeta: Record<WaitlistStatus, { label: string; tone: string }> = {
  waiting: { label: "Ждёт", tone: "warning" },
  notified: { label: "Предупредили", tone: "info" },
  booked: { label: "Записан", tone: "success" },
  canceled: { label: "Отменено", tone: "neutral" }
};

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  timeZone: "Europe/Moscow",
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit"
});

function waitlistErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === "waitlist_reference_not_found") {
      return "Проверьте клиента, услугу и мастера.";
    }
    if (error.status === 401 || error.status === 403) {
      return "Недостаточно прав или сессия завершилась.";
    }
  }
  return "Не удалось сохранить. Попробуйте ещё раз.";
}

function toDateInputValue(daysFromNow: number) {
  const date = new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 16);
}

export default function WaitlistPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [options, setOptions] = useState<BookingOptions | null>(null);
  const [statusFilter, setStatusFilter] = useState<WaitlistStatus | "all">("waiting");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState({
    clientId: "",
    serviceId: "",
    staffId: "",
    preferredFrom: toDateInputValue(1),
    preferredTo: toDateInputValue(4),
    note: ""
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async (status: WaitlistStatus | "all") => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [entriesResponse, optionsResponse] = await Promise.all([
        apiRequest<{ entries: Entry[] }>(`/v1/admin/waitlist?status=${status}`),
        apiRequest<BookingOptions>("/v1/admin/booking-options")
      ]);
      setEntries(entriesResponse.entries);
      setOptions(optionsResponse);
    } catch {
      setLoadError("Не удалось загрузить лист ожидания.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(statusFilter);
  }, [load, statusFilter]);

  function openCreateForm() {
    setForm({
      clientId: options?.clients[0]?.id ?? "",
      serviceId: options?.services[0]?.id ?? "",
      staffId: "",
      preferredFrom: toDateInputValue(1),
      preferredTo: toDateInputValue(4),
      note: ""
    });
    setFormError(null);
    setIsFormOpen(true);
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setFormError(null);
    setNotice(null);
    try {
      await apiRequest("/v1/admin/waitlist", {
        method: "POST",
        body: JSON.stringify({
          clientId: form.clientId,
          serviceId: form.serviceId,
          staffId: form.staffId || null,
          preferredFrom: new Date(form.preferredFrom).toISOString(),
          preferredTo: new Date(form.preferredTo).toISOString(),
          note: form.note.trim() || null
        })
      });
      setIsFormOpen(false);
      setNotice("Клиент добавлен в лист ожидания.");
      await load(statusFilter);
    } catch (error) {
      setFormError(waitlistErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function updateStatus(entry: Entry, status: WaitlistStatus) {
    setNotice(null);
    try {
      await apiRequest(`/v1/admin/waitlist/${entry.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status })
      });
      setNotice(`Статус изменён: ${statusMeta[status].label}.`);
      await load(statusFilter);
    } catch (error) {
      setLoadError(waitlistErrorMessage(error));
    }
  }

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Записи</p>
          <h1>Лист ожидания</h1>
          <p className="page-description">
            Клиенты, которые хотят записаться раньше — освободившийся слот сначала предлагайте им.
          </p>
        </div>
        <button
          className="primary-button"
          disabled={!options?.clients.length}
          onClick={openCreateForm}
          type="button"
        >
          <Plus aria-hidden="true" size={18} />
          Добавить в лист
        </button>
      </header>

      <div className="tab-bar" role="tablist">
        {(["waiting", "notified", "booked", "canceled", "all"] as const).map((status) => (
          <button
            aria-selected={statusFilter === status}
            className={`tab-button${statusFilter === status ? " tab-button-active" : ""}`}
            key={status}
            onClick={() => setStatusFilter(status)}
            role="tab"
            type="button"
          >
            {status === "all" ? "Все" : statusMeta[status].label}
          </button>
        ))}
      </div>

      {notice ? (
        <p className="feedback feedback-success" role="status">
          {notice}
        </p>
      ) : null}

      <section className="panel table-panel">
        {isLoading ? (
          <div className="table-message" role="status">
            <p>Загружаем список…</p>
          </div>
        ) : loadError ? (
          <div className="table-message table-message-error" role="alert">
            <p>{loadError}</p>
          </div>
        ) : entries.length === 0 ? (
          <div className="empty-table-state">
            <div>
              <strong>Список пуст</strong>
              <span>Добавьте клиента кнопкой выше — например, когда для него нет свободного окна.</span>
            </div>
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Клиент</th>
                  <th>Услуга</th>
                  <th>Мастер</th>
                  <th>Желаемый период</th>
                  <th>Статус</th>
                  <th aria-label="Действия" />
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td>
                      <strong>{entry.client.fullName ?? entry.client.phone}</strong>
                      <small>{entry.client.phone}</small>
                    </td>
                    <td>{entry.service.titleRu}</td>
                    <td>{entry.staff?.displayName ?? "Любой"}</td>
                    <td>
                      <span>
                        {dateFormatter.format(new Date(entry.preferredFrom))} —{" "}
                        {dateFormatter.format(new Date(entry.preferredTo))}
                      </span>
                      {entry.note ? <small className="block-small">{entry.note}</small> : null}
                    </td>
                    <td>
                      <span className={`status status-${statusMeta[entry.status].tone}`}>
                        {statusMeta[entry.status].label}
                      </span>
                    </td>
                    <td className="action-cell">
                      {entry.status === "waiting" || entry.status === "notified" ? (
                        <>
                          <button
                            aria-label={`Клиент предупреждён: ${entry.client.fullName ?? entry.client.phone}`}
                            className="icon-button table-action"
                            onClick={() => void updateStatus(entry, "notified")}
                            title="Отметить, что позвонили"
                            type="button"
                          >
                            <Phone aria-hidden="true" size={15} />
                          </button>
                          <button
                            aria-label={`Записан: ${entry.client.fullName ?? entry.client.phone}`}
                            className="icon-button table-action"
                            onClick={() => void updateStatus(entry, "booked")}
                            title="Отметить, что записан"
                            type="button"
                          >
                            <CalendarCheck aria-hidden="true" size={15} />
                          </button>
                          <button
                            aria-label={`Убрать из листа: ${entry.client.fullName ?? entry.client.phone}`}
                            className="icon-button table-action"
                            onClick={() => void updateStatus(entry, "canceled")}
                            title="Убрать из листа ожидания"
                            type="button"
                          >
                            <Ban aria-hidden="true" size={15} />
                          </button>
                        </>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {isFormOpen ? (
        <Modal onClose={() => setIsFormOpen(false)} title="Добавить в лист ожидания">
          <form className="modal-form" onSubmit={submitForm}>
            <label className="form-field">
              <span>Клиент</span>
              <select
                onChange={(event) =>
                  setForm((current) => ({ ...current, clientId: event.target.value }))
                }
                required
                value={form.clientId}
              >
                {(options?.clients ?? []).map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.fullName ?? client.phone}
                  </option>
                ))}
              </select>
            </label>
            <div className="form-grid form-grid-two">
              <label className="form-field">
                <span>Услуга</span>
                <select
                  onChange={(event) =>
                    setForm((current) => ({ ...current, serviceId: event.target.value }))
                  }
                  required
                  value={form.serviceId}
                >
                  {(options?.services ?? []).map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.titleRu}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                <span>Мастер</span>
                <select
                  onChange={(event) =>
                    setForm((current) => ({ ...current, staffId: event.target.value }))
                  }
                  value={form.staffId}
                >
                  <option value="">Любой</option>
                  {(options?.staff ?? []).map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {staff.displayName}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="form-grid form-grid-two">
              <label className="form-field">
                <span>Желаемо не раньше</span>
                <input
                  onChange={(event) =>
                    setForm((current) => ({ ...current, preferredFrom: event.target.value }))
                  }
                  required
                  type="datetime-local"
                  value={form.preferredFrom}
                />
              </label>
              <label className="form-field">
                <span>Желаемо не позже</span>
                <input
                  onChange={(event) =>
                    setForm((current) => ({ ...current, preferredTo: event.target.value }))
                  }
                  required
                  type="datetime-local"
                  value={form.preferredTo}
                />
              </label>
            </div>
            <label className="form-field">
              <span>Комментарий</span>
              <input
                maxLength={1000}
                onChange={(event) =>
                  setForm((current) => ({ ...current, note: event.target.value }))
                }
                value={form.note}
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
                onClick={() => setIsFormOpen(false)}
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
    </div>
  );
}
