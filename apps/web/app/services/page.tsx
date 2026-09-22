"use client";

import { Pencil, Plus, Scissors } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ApiError, apiRequest } from "../lib/api";
import { Modal } from "../ui/modal";

type Currency = "RUB" | "EUR" | "USD";

type Service = {
  id: string;
  slug: string;
  titleRu: string;
  titleEn: string | null;
  titleEs: string | null;
  category: string | null;
  durationMinutes: number;
  bufferAfterMinutes: number;
  isActive: boolean;
  prices: Array<{ currency: Currency; amountMinor: number }>;
};

type ServiceForm = {
  titleRu: string;
  titleEn: string;
  titleEs: string;
  category: string;
  durationMinutes: string;
  bufferAfterMinutes: string;
  isActive: boolean;
  RUB: string;
  EUR: string;
  USD: string;
};

const emptyForm: ServiceForm = {
  titleRu: "",
  titleEn: "",
  titleEs: "",
  category: "Маникюр",
  durationMinutes: "60",
  bufferAfterMinutes: "0",
  isActive: true,
  RUB: "",
  EUR: "",
  USD: ""
};

const transliteration: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh",
  з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o",
  п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts",
  ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu",
  я: "ya"
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .split("")
    .map((character) => transliteration[character] ?? character)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function priceValue(service: Service, currency: Currency) {
  const amountMinor =
    service.prices.find((price) => price.currency === currency)?.amountMinor ?? 0;
  return String(amountMinor / 100);
}

function amountMinor(value: string) {
  return Math.round(Number(value.replace(",", ".")) * 100);
}

function formatPrice(service: Service, currency: Currency) {
  const minor =
    service.prices.find((price) => price.currency === currency)?.amountMinor ?? 0;
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(minor / 100);
}

function serviceErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === "service_slug_already_exists") {
      return "Услуга с таким названием уже существует.";
    }
    if (error.status === 401 || error.status === 403) {
      return "Сессия завершилась. Обновите страницу и войдите снова.";
    }
  }
  return "Не удалось сохранить услугу. Попробуйте ещё раз.";
}

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState<ServiceForm>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const loadServices = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await apiRequest<{ services: Service[] }>(
        "/v1/admin/services"
      );
      setServices(response.services);
    } catch {
      setLoadError("Не удалось загрузить услуги.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadServices();
  }, [loadServices]);

  function openCreateForm() {
    setEditingService(null);
    setForm(emptyForm);
    setFormError(null);
    setIsFormOpen(true);
  }

  function openEditForm(service: Service) {
    setEditingService(service);
    setForm({
      titleRu: service.titleRu,
      titleEn: service.titleEn ?? "",
      titleEs: service.titleEs ?? "",
      category: service.category ?? "Маникюр",
      durationMinutes: String(service.durationMinutes),
      bufferAfterMinutes: String(service.bufferAfterMinutes),
      isActive: service.isActive,
      RUB: priceValue(service, "RUB"),
      EUR: priceValue(service, "EUR"),
      USD: priceValue(service, "USD")
    });
    setFormError(null);
    setIsFormOpen(true);
  }

  function updateForm<Key extends keyof ServiceForm>(
    key: Key,
    value: ServiceForm[Key]
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submitService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setFormError(null);
    setNotice(null);

    const prices = {
      RUB: amountMinor(form.RUB),
      EUR: amountMinor(form.EUR),
      USD: amountMinor(form.USD)
    };

    if (Object.values(prices).some((price) => !Number.isFinite(price) || price < 0)) {
      setFormError("Проверьте цены во всех трёх валютах.");
      setIsSaving(false);
      return;
    }

    const payload = {
      ...(!editingService ? { slug: slugify(form.titleRu) } : {}),
      titleRu: form.titleRu.trim(),
      titleEn: form.titleEn.trim() || null,
      titleEs: form.titleEs.trim() || null,
      category: form.category.trim() || null,
      durationMinutes: Number(form.durationMinutes),
      bufferAfterMinutes: Number(form.bufferAfterMinutes),
      isActive: form.isActive,
      prices
    };

    try {
      await apiRequest(
        editingService
          ? `/v1/admin/services/${editingService.id}`
          : "/v1/admin/services",
        {
          method: editingService ? "PATCH" : "POST",
          body: JSON.stringify(payload)
        }
      );
      setIsFormOpen(false);
      setNotice(editingService ? "Услуга обновлена." : "Услуга добавлена.");
      await loadServices();
    } catch (error) {
      setFormError(serviceErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  const activeCount = services.filter((service) => service.isActive).length;

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Каталог</p>
          <h1>Услуги и цены</h1>
          <p className="page-description">
            Длительность, доступность и стоимость услуг в трёх валютах.
          </p>
        </div>
        <button className="primary-button" onClick={openCreateForm} type="button">
          <Plus aria-hidden="true" size={18} />
          Добавить услугу
        </button>
      </header>

      {notice ? (
        <p className="feedback feedback-success" role="status">
          {notice}
        </p>
      ) : null}

      <section className="panel table-panel">
        <div className="table-toolbar">
          <div>
            <p className="section-kicker">Каталог услуг</p>
            <h2>Маникюр</h2>
          </div>
          <span className="muted-label">
            {isLoading
              ? "Загрузка…"
              : `${activeCount} активных · ${services.length} всего`}
          </span>
        </div>

        {loadError ? (
          <div className="table-message table-message-error" role="alert">
            <p>{loadError}</p>
            <button
              className="secondary-button"
              onClick={() => void loadServices()}
              type="button"
            >
              Повторить
            </button>
          </div>
        ) : !isLoading && services.length === 0 ? (
          <div className="empty-table-state">
            <Scissors aria-hidden="true" size={24} />
            <div>
              <strong>Услуг пока нет</strong>
              <span>Добавьте первую услугу и укажите её стоимость.</span>
            </div>
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Услуга</th>
                  <th>Длительность</th>
                  <th>RUB</th>
                  <th>EUR</th>
                  <th>USD</th>
                  <th>Статус</th>
                  <th aria-label="Действия" />
                </tr>
              </thead>
              <tbody>
                {services.map((service) => (
                  <tr key={service.id}>
                    <td>
                      <strong>{service.titleRu}</strong>
                      <small>
                        {[service.titleEn, service.titleEs]
                          .filter(Boolean)
                          .join(" · ") || service.category || "Без категории"}
                      </small>
                    </td>
                    <td>
                      <span>{service.durationMinutes} мин</span>
                      <small>
                        {service.bufferAfterMinutes
                          ? `Перерыв ${service.bufferAfterMinutes} мин`
                          : "Без перерыва"}
                      </small>
                    </td>
                    <td className="price-cell">{formatPrice(service, "RUB")}</td>
                    <td className="price-cell">{formatPrice(service, "EUR")}</td>
                    <td className="price-cell">{formatPrice(service, "USD")}</td>
                    <td>
                      <span
                        className={`status ${
                          service.isActive ? "status-success" : "status-neutral"
                        }`}
                      >
                        {service.isActive ? "Активна" : "Скрыта"}
                      </span>
                    </td>
                    <td className="action-cell">
                      <button
                        aria-label={`Изменить услугу ${service.titleRu}`}
                        className="icon-button table-action"
                        onClick={() => openEditForm(service)}
                        title="Изменить"
                        type="button"
                      >
                        <Pencil aria-hidden="true" size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {isFormOpen ? (
        <Modal
          description="Название, длительность и цены для онлайн-записи."
          onClose={() => setIsFormOpen(false)}
          title={editingService ? "Изменить услугу" : "Новая услуга"}
        >
          <form className="modal-form" onSubmit={(event) => void submitService(event)}>
            <div className="form-grid form-grid-two">
              <label className="form-field">
                <span>Название на русском</span>
                <input
                  autoFocus
                  maxLength={120}
                  onChange={(event) => updateForm("titleRu", event.target.value)}
                  required
                  value={form.titleRu}
                />
              </label>
              <label className="form-field">
                <span>Категория</span>
                <input
                  maxLength={80}
                  onChange={(event) => updateForm("category", event.target.value)}
                  value={form.category}
                />
              </label>
              <label className="form-field">
                <span>Название на английском</span>
                <input
                  maxLength={120}
                  onChange={(event) => updateForm("titleEn", event.target.value)}
                  value={form.titleEn}
                />
              </label>
              <label className="form-field">
                <span>Название на испанском</span>
                <input
                  maxLength={120}
                  onChange={(event) => updateForm("titleEs", event.target.value)}
                  value={form.titleEs}
                />
              </label>
              <label className="form-field">
                <span>Длительность, мин</span>
                <input
                  max={720}
                  min={15}
                  onChange={(event) =>
                    updateForm("durationMinutes", event.target.value)
                  }
                  required
                  step={15}
                  type="number"
                  value={form.durationMinutes}
                />
              </label>
              <label className="form-field">
                <span>Перерыв после, мин</span>
                <input
                  max={240}
                  min={0}
                  onChange={(event) =>
                    updateForm("bufferAfterMinutes", event.target.value)
                  }
                  required
                  step={5}
                  type="number"
                  value={form.bufferAfterMinutes}
                />
              </label>
            </div>

            <fieldset className="price-fieldset">
              <legend>Стоимость</legend>
              <div className="form-grid form-grid-three">
                {(["RUB", "EUR", "USD"] as const).map((currency) => (
                  <label className="form-field" key={currency}>
                    <span>{currency}</span>
                    <input
                      min={0}
                      onChange={(event) =>
                        updateForm(currency, event.target.value)
                      }
                      required
                      step="0.01"
                      type="number"
                      value={form[currency]}
                    />
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="checkbox-field">
              <input
                checked={form.isActive}
                onChange={(event) => updateForm("isActive", event.target.checked)}
                type="checkbox"
              />
              <span>
                <strong>Услуга активна</strong>
                <small>Клиенты смогут выбрать её при записи.</small>
              </span>
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
                {isSaving ? "Сохраняем…" : "Сохранить"}
              </button>
            </footer>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
