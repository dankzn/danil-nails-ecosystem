"use client";

import {
  ChevronDown,
  HelpCircle,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Settings,
  Trash2,
  Users
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useState,
  type FormEvent
} from "react";
import { ApiError, apiRequest } from "../lib/api";
import { Modal } from "../ui/modal";

type ClientCategory =
  | "regular"
  | "sleeping"
  | "lost"
  | "never_visited"
  | "new"
  | "blocked"
  | "deleted"
  | "penalized";

type ClientSummary = {
  visitCount: number;
  lastVisitAt: string | null;
  totalSpentMinor: number;
  averageCheckMinor: number;
};

type Client = {
  id: string;
  userId: string | null;
  fullName: string | null;
  phone: string;
  email: string | null;
  telegramUsername: string | null;
  whatsappPhone: string | null;
  allergies: string | null;
  noKnownAllergies: boolean;
  customAllergyNote: string | null;
  notes: string | null;
  requiresPrepayment: boolean;
  prepaymentReason: string | null;
  discountPercent: number;
  isBlocked: boolean;
  deletedAt: string | null;
  loyaltyStatus: { titleRu: string } | null;
  privateTagAssignments: Array<{ tag: { id: string; title: string } }>;
  allergenAssignments: Array<{
    allergen: { id: string; title: string; description: string | null };
  }>;
  summary: ClientSummary;
};

type ClientForm = {
  fullName: string;
  phone: string;
  email: string;
  telegramUsername: string;
  whatsappPhone: string;
  allergens: string[];
  notes: string;
  privateTags: string[];
  requiresPrepayment: boolean;
  prepaymentReason: string;
  discountPercent: string;
  isBlocked: boolean;
};

const emptyForm: ClientForm = {
  fullName: "",
  phone: "",
  email: "",
  telegramUsername: "",
  whatsappPhone: "",
  allergens: [],
  notes: "",
  privateTags: [],
  requiresPrepayment: false,
  prepaymentReason: "",
  discountPercent: "0",
  isBlocked: false
};

const categoryMeta: Record<
  ClientCategory,
  { label: string; hint: string; colorClass: string }
> = {
  regular: {
    label: "Постоянные",
    hint: "2 и более записи за 3 месяца",
    colorClass: "client-category-green"
  },
  sleeping: {
    label: "Спящие",
    hint: "не записывались более 3 месяцев",
    colorClass: "client-category-amber"
  },
  lost: {
    label: "Пропавшие",
    hint: "не записывались более 6 месяцев",
    colorClass: "client-category-red"
  },
  never_visited: {
    label: "Не посещали",
    hint: "нет записей данных клиентов",
    colorClass: "client-category-neutral"
  },
  new: {
    label: "Новые",
    hint: "",
    colorClass: "client-category-neutral"
  },
  blocked: {
    label: "Заблокированы",
    hint: "не могут записаться онлайн",
    colorClass: "client-category-red"
  },
  deleted: {
    label: "Удалены",
    hint: "удалены из списка клиентов",
    colorClass: "client-category-green"
  },
  penalized: {
    label: "Штрафники",
    hint: "нарушили условия записи",
    colorClass: "client-category-red"
  }
};

const avatarPalette = [
  "#aef7c1",
  "#ffd98e",
  "#ffb3c7",
  "#c9b8ff",
  "#9fd8ff",
  "#ffcf9f",
  "#b8f0e6",
  "#f0b8e6"
];

function avatarColor(seed: string) {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return avatarPalette[hash % avatarPalette.length];
}

const visitDateFormatter = new Intl.DateTimeFormat("ru-RU", {
  timeZone: "Europe/Moscow",
  day: "2-digit",
  month: "2-digit",
  year: "numeric"
});
const visitTimeFormatter = new Intl.DateTimeFormat("ru-RU", {
  timeZone: "Europe/Moscow",
  hour: "2-digit",
  minute: "2-digit"
});
const shortDateFormatter = new Intl.DateTimeFormat("ru-RU", {
  timeZone: "Europe/Moscow",
  day: "2-digit",
  month: "2-digit"
});
const moneyFormatter = new Intl.NumberFormat("ru-RU");

function formatLastVisit(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  return `${visitDateFormatter.format(date)} в ${visitTimeFormatter.format(date)}`;
}

function formatMoneyMinor(minor: number) {
  return moneyFormatter.format(Math.round(minor / 100));
}

function optionalValue(value: string) {
  const normalized = value.trim();
  return normalized ? normalized : null;
}

function sameDictionaryTitle(left: string, right: string) {
  return (
    left.toLocaleLowerCase("ru-RU") === right.toLocaleLowerCase("ru-RU")
  );
}

function uniqueDictionaryTitles(titles: string[]) {
  return titles.filter(
    (title, index) =>
      titles.findIndex((candidate) => sameDictionaryTitle(candidate, title)) ===
      index
  );
}

function clientErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === "client_phone_already_exists") {
      return "Клиент с таким номером телефона уже существует.";
    }
    if (error.status === 401 || error.status === 403) {
      return "Сессия завершилась. Обновите страницу и войдите снова.";
    }
  }
  return "Не удалось сохранить клиента. Попробуйте ещё раз.";
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<ClientCategory | null>(null);
  const [categoryCounts, setCategoryCounts] = useState<
    Record<ClientCategory, number> | null
  >(null);
  const [newClientWindowLabel, setNewClientWindowLabel] = useState<string | null>(
    null
  );
  const [staffOptions, setStaffOptions] = useState<
    Array<{ id: string; displayName: string }>
  >([]);
  const [staffFilter, setStaffFilter] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState<ClientForm>(emptyForm);
  const [privateTagOptions, setPrivateTagOptions] = useState<string[]>([]);
  const [newPrivateTag, setNewPrivateTag] = useState("");
  const [allergenOptions, setAllergenOptions] = useState<
    Array<{ title: string; description: string | null }>
  >([]);
  const [newAllergen, setNewAllergen] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isBonusFormOpen, setIsBonusFormOpen] = useState(false);
  const [bonusPoints, setBonusPoints] = useState("");
  const [bonusReason, setBonusReason] = useState("");
  const [isBonusSaving, setIsBonusSaving] = useState(false);
  const [bonusError, setBonusError] = useState<string | null>(null);

  const loadClients = useCallback(
    async (
      query: string,
      activeCategory: ClientCategory | null,
      activeStaffId: string,
      signal?: AbortSignal
    ) => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const searchParams = new URLSearchParams({ limit: "100" });
        if (query.trim()) searchParams.set("search", query.trim());
        if (activeCategory) searchParams.set("category", activeCategory);
        if (activeStaffId) searchParams.set("staffId", activeStaffId);
        const response = await apiRequest<{ clients: Client[] }>(
          `/v1/admin/clients?${searchParams}`,
          signal ? { signal } : {}
        );
        setClients(response.clients);
        setSelectedIds(new Set());
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setLoadError("Не удалось загрузить клиентов.");
      } finally {
        if (!signal?.aborted) setIsLoading(false);
      }
    },
    []
  );

  const loadCategoryCounts = useCallback(async () => {
    try {
      const response = await apiRequest<{
        counts: Record<ClientCategory, number>;
        newClientWindow: { from: string; to: string };
      }>("/v1/admin/clients/category-counts");
      setCategoryCounts(response.counts);
      setNewClientWindowLabel(
        `${shortDateFormatter.format(new Date(response.newClientWindow.from))}-${shortDateFormatter.format(new Date(response.newClientWindow.to))}`
      );
    } catch {
      setCategoryCounts(null);
    }
  }, []);

  const loadClientReferenceData = useCallback(async () => {
    try {
      const response = await apiRequest<{
        privateTags: Array<{ title: string }>;
        allergens: Array<{ title: string; description: string | null }>;
      }>("/v1/admin/client-reference-data");
      setPrivateTagOptions(response.privateTags.map((tag) => tag.title));
      setAllergenOptions(response.allergens);
    } catch {
      setPrivateTagOptions([]);
      setAllergenOptions([]);
    }
  }, []);

  const loadStaffOptions = useCallback(async () => {
    try {
      const response = await apiRequest<{
        staff: Array<{ id: string; displayName: string }>;
      }>("/v1/staff");
      setStaffOptions(response.staff);
    } catch {
      setStaffOptions([]);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      void loadClients(search, category, staffFilter, controller.signal);
    }, 250);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [loadClients, search, category, staffFilter]);

  useEffect(() => {
    void loadClientReferenceData();
    void loadStaffOptions();
  }, [loadClientReferenceData, loadStaffOptions]);

  useEffect(() => {
    void loadCategoryCounts();
  }, [loadCategoryCounts]);

  function refreshAll() {
    void loadClients(search, category, staffFilter);
    void loadCategoryCounts();
  }

  function toggleCategory(value: ClientCategory) {
    setCategory((current) => (current === value ? null : value));
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds((current) =>
      current.size === clients.length ? new Set() : new Set(clients.map((c) => c.id))
    );
  }

  async function submitBulkBonus() {
    const points = Number(bonusPoints);
    if (!Number.isInteger(points) || points <= 0 || !bonusReason.trim()) {
      setBonusError("Укажите целое число баллов больше нуля и причину.");
      return;
    }
    setIsBonusSaving(true);
    setBonusError(null);
    try {
      await Promise.all(
        [...selectedIds].map((id) =>
          apiRequest(`/v1/admin/clients/${id}/loyalty-transactions`, {
            method: "POST",
            body: JSON.stringify({ direction: "accrual", points, reason: bonusReason.trim() })
          })
        )
      );
      setIsBonusFormOpen(false);
      setBonusPoints("");
      setBonusReason("");
      setNotice(`Бонусы начислены: ${selectedIds.size} клиентам.`);
      refreshAll();
    } catch {
      setBonusError("Не удалось начислить бонусы. Попробуйте ещё раз.");
    } finally {
      setIsBonusSaving(false);
    }
  }

  async function deleteSelected() {
    setIsMoreMenuOpen(false);
    try {
      await Promise.all(
        [...selectedIds].map((id) =>
          apiRequest(`/v1/admin/clients/${id}`, { method: "DELETE" })
        )
      );
      setNotice(`Удалено клиентов: ${selectedIds.size}.`);
      refreshAll();
    } catch {
      setLoadError("Не удалось удалить выбранных клиентов.");
    }
  }

  async function restoreClient(id: string) {
    try {
      await apiRequest(`/v1/admin/clients/${id}/restore`, { method: "POST" });
      setNotice("Клиент восстановлен.");
      refreshAll();
    } catch {
      setLoadError("Не удалось восстановить клиента.");
    }
  }

  function openCreateForm() {
    setEditingClient(null);
    setForm(emptyForm);
    setNewPrivateTag("");
    setNewAllergen("");
    setFormError(null);
    setIsFormOpen(true);
  }

  function openEditForm(client: Client) {
    setEditingClient(client);
    setForm({
      fullName: client.fullName ?? "",
      phone: client.phone,
      email: client.email ?? "",
      telegramUsername: client.telegramUsername ?? "",
      whatsappPhone: client.whatsappPhone ?? "",
      allergens: uniqueDictionaryTitles(
        client.allergenAssignments.map(({ allergen }) => allergen.title)
      ),
      notes: client.notes ?? "",
      privateTags: client.privateTagAssignments.map(({ tag }) => tag.title),
      requiresPrepayment: client.requiresPrepayment,
      prepaymentReason: client.prepaymentReason ?? "",
      discountPercent: String(client.discountPercent),
      isBlocked: client.isBlocked
    });
    setFormError(null);
    setNewPrivateTag("");
    setNewAllergen("");
    setIsFormOpen(true);
  }

  function updateForm<Key extends keyof ClientForm>(
    key: Key,
    value: ClientForm[Key]
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function togglePrivateTag(title: string) {
    setForm((current) => ({
      ...current,
      privateTags: current.privateTags.some((tag) =>
        sameDictionaryTitle(tag, title)
      )
        ? current.privateTags.filter((tag) => !sameDictionaryTitle(tag, title))
        : [...current.privateTags, title]
    }));
  }

  function addPrivateTag() {
    const title = newPrivateTag.trim().replace(/\s+/g, " ");
    if (!title) return;
    setPrivateTagOptions((current) =>
      current.some((tag) => sameDictionaryTitle(tag, title))
        ? current
        : [...current, title]
    );
    setForm((current) => ({
      ...current,
      privateTags: current.privateTags.some((tag) =>
        sameDictionaryTitle(tag, title)
      )
        ? current.privateTags
        : [...current.privateTags, title]
    }));
    setNewPrivateTag("");
  }

  function toggleAllergen(title: string) {
    setForm((current) => ({
      ...current,
      allergens: current.allergens.some((item) =>
        sameDictionaryTitle(item, title)
      )
        ? current.allergens.filter(
            (item) => !sameDictionaryTitle(item, title)
          )
        : [...current.allergens, title]
    }));
  }

  function addAllergen() {
    const title = newAllergen.trim().replace(/\s+/g, " ");
    if (!title) return;
    setAllergenOptions((current) =>
      current.some((item) => sameDictionaryTitle(item.title, title))
        ? current
        : [...current, { title, description: null }]
    );
    setForm((current) => ({
      ...current,
      allergens: current.allergens.some((item) =>
        sameDictionaryTitle(item, title)
      )
        ? current.allergens
        : [...current.allergens, title]
    }));
    setNewAllergen("");
  }

  async function submitClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setFormError(null);
    setNotice(null);

    const payload = {
      fullName: form.fullName.trim(),
      phone: form.phone.trim(),
      email: optionalValue(form.email),
      telegramUsername: optionalValue(form.telegramUsername),
      whatsappPhone: optionalValue(form.whatsappPhone),
      allergens: form.allergens,
      notes: optionalValue(form.notes),
      privateTags: form.privateTags,
      requiresPrepayment: form.requiresPrepayment,
      prepaymentReason: form.requiresPrepayment
        ? optionalValue(form.prepaymentReason)
        : null,
      discountPercent: Math.min(100, Math.max(0, Number(form.discountPercent) || 0)),
      isBlocked: form.isBlocked
    };

    try {
      await apiRequest(
        editingClient
          ? `/v1/admin/clients/${editingClient.id}`
          : "/v1/admin/clients",
        {
          method: editingClient ? "PATCH" : "POST",
          body: JSON.stringify(payload)
        }
      );
      setIsFormOpen(false);
      setNotice(editingClient ? "Данные клиента обновлены." : "Клиент добавлен.");
      await Promise.all([
        loadClients(search, category, staffFilter),
        loadClientReferenceData(),
        loadCategoryCounts()
      ]);
    } catch (error) {
      setFormError(clientErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  const visiblePrivateTagOptions = uniqueDictionaryTitles(
    [...privateTagOptions, ...form.privateTags]
  );
  const visibleAllergenOptions = uniqueDictionaryTitles([
    ...allergenOptions.map((allergen) => allergen.title),
    ...form.allergens
  ]).map(
    (title) =>
      allergenOptions.find((allergen) =>
        sameDictionaryTitle(allergen.title, title)
      ) ?? { title, description: null }
  );

  const isDeletedView = category === "deleted";

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">CRM клиентов</p>
          <h1>Клиенты</h1>
          <p className="page-description">
            Список клиентов, визиты и аналитические категории.
          </p>
        </div>
      </header>

      {notice ? (
        <p className="feedback feedback-success" role="status">
          {notice}
        </p>
      ) : null}

      <div className="clients-layout">
        <section className="panel table-panel clients-main">
          <div className="clients-toolbar">
            <label className="search-field clients-search">
              <Search aria-hidden="true" size={16} />
              <input
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Имя клиента или телефон"
                type="search"
                value={search}
              />
            </label>
            <label
              className="search-field clients-search clients-card-search"
              title="Будет добавлено позже"
            >
              <input disabled placeholder="Карта" type="search" />
            </label>

            <HelpCircle
              aria-hidden="true"
              className="clients-help-icon"
              size={18}
            />

            <button
              className="clients-bonus-button"
              disabled={selectedIds.size === 0}
              onClick={() => {
                setBonusPoints("");
                setBonusReason("");
                setBonusError(null);
                setIsBonusFormOpen(true);
              }}
              title={
                selectedIds.size === 0
                  ? "Сначала отметьте клиентов галочками"
                  : undefined
              }
              type="button"
            >
              <span aria-hidden="true">→</span>
              Начислить бонусы
            </button>

            <button className="primary-button" onClick={openCreateForm} type="button">
              Добавить нового клиента
            </button>

            <div className="clients-more-menu">
              <button
                aria-label="Ещё действия"
                className="icon-button clients-more-trigger"
                onClick={() => setIsMoreMenuOpen((current) => !current)}
                type="button"
              >
                <MoreHorizontal aria-hidden="true" size={18} />
              </button>
              {isMoreMenuOpen ? (
                <>
                  <div
                    className="clients-more-backdrop"
                    onClick={() => setIsMoreMenuOpen(false)}
                  />
                  <div className="clients-more-panel">
                    <button
                      disabled={selectedIds.size === 0}
                      onClick={() => void deleteSelected()}
                      type="button"
                    >
                      <Trash2 aria-hidden="true" size={15} />
                      Удалить выбранных
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          </div>

          {loadError ? (
            <div className="table-message table-message-error" role="alert">
              <p>{loadError}</p>
              <button
                className="secondary-button"
                onClick={() => void loadClients(search, category, staffFilter)}
                type="button"
              >
                Повторить
              </button>
            </div>
          ) : !isLoading && clients.length === 0 ? (
            <div className="empty-table-state">
              <Users aria-hidden="true" size={24} />
              <div>
                <strong>{search ? "Ничего не найдено" : "Клиентов пока нет"}</strong>
                <span>
                  {search
                    ? "Попробуйте изменить запрос."
                    : "Первый клиент появится здесь после добавления."}
                </span>
              </div>
            </div>
          ) : (
            <div className="table-scroll">
              <table className="clients-table">
                <thead>
                  <tr>
                    <th className="clients-checkbox-cell">
                      <input
                        checked={
                          clients.length > 0 && selectedIds.size === clients.length
                        }
                        onChange={toggleSelectAll}
                        type="checkbox"
                      />
                    </th>
                    <th>
                      Клиент {clients.length}
                      {isLoading ? null : <span aria-hidden="true"> ↑</span>}
                    </th>
                    <th>Визиты</th>
                    <th>Последний визит</th>
                    <th>Скидка</th>
                    <th>Средний чек</th>
                    <th>Потрачено</th>
                    <th aria-label="Действия" />
                  </tr>
                </thead>
                <tbody>
                  {clients.map((client) => (
                    <tr key={client.id}>
                      <td className="clients-checkbox-cell">
                        <input
                          checked={selectedIds.has(client.id)}
                          onChange={() => toggleSelected(client.id)}
                          type="checkbox"
                        />
                      </td>
                      <td>
                        <div className="clients-identity">
                          <span
                            className="clients-avatar"
                            style={{ background: avatarColor(client.id) }}
                          >
                            {(client.fullName ?? client.phone).slice(0, 1).toUpperCase()}
                          </span>
                          <div>
                            <div className="clients-name-row">
                              <span
                                className={`clients-status-dot${
                                  client.userId ? " is-registered" : ""
                                }`}
                                title={
                                  client.userId
                                    ? "Есть аккаунт в личном кабинете"
                                    : "Добавлен вручную"
                                }
                              />
                              <strong>{client.fullName ?? "Без имени"}</strong>
                            </div>
                            <small>{client.phone}</small>
                          </div>
                        </div>
                      </td>
                      <td className="clients-number-cell">
                        <strong>{client.summary.visitCount}</strong>
                      </td>
                      <td>{formatLastVisit(client.summary.lastVisitAt)}</td>
                      <td className="clients-number-cell">
                        {client.discountPercent}%
                      </td>
                      <td className="clients-number-cell">
                        {formatMoneyMinor(client.summary.averageCheckMinor)}
                      </td>
                      <td className="clients-number-cell">
                        {formatMoneyMinor(client.summary.totalSpentMinor)}
                      </td>
                      <td className="action-cell">
                        {isDeletedView ? (
                          <button
                            aria-label={`Восстановить клиента ${client.fullName ?? client.phone}`}
                            className="secondary-button"
                            onClick={() => void restoreClient(client.id)}
                            type="button"
                          >
                            Восстановить
                          </button>
                        ) : (
                          <button
                            aria-label={`Изменить клиента ${client.fullName ?? client.phone}`}
                            className="icon-button table-action"
                            onClick={() => openEditForm(client)}
                            title="Изменить"
                            type="button"
                          >
                            <Pencil aria-hidden="true" size={15} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside className="panel clients-sidebar">
          <h2>Категории</h2>
          <div className="clients-category-list">
            {(Object.keys(categoryMeta) as ClientCategory[]).map((key) => {
              const meta = categoryMeta[key];
              return (
                <label className="clients-category-row" key={key}>
                  <div className="clients-category-row-head">
                    <input
                      checked={category === key}
                      onChange={() => toggleCategory(key)}
                      type="checkbox"
                    />
                    <span>
                      {meta.label}{" "}
                      <span className={meta.colorClass}>
                        {categoryCounts ? categoryCounts[key] : "…"}
                      </span>
                    </span>
                  </div>
                  <small>
                    {key === "new" && newClientWindowLabel
                      ? (
                          <>
                            за период:{" "}
                            <span className="clients-category-period">
                              {newClientWindowLabel}
                            </span>
                          </>
                        )
                      : meta.hint}
                  </small>
                </label>
              );
            })}
          </div>

          <div className="dikidi-divider" />

          <div className="clients-sidebar-heading" title="Будет добавлено позже">
            <h2>Группы</h2>
            <Settings aria-hidden="true" size={16} />
          </div>
          <label className="clients-group-select" title="Будет добавлено позже">
            <select disabled>
              <option>Все группы</option>
            </select>
            <ChevronDown aria-hidden="true" size={16} />
          </label>

          <div className="clients-sidebar-heading">
            <h2>Поиск по специалистам</h2>
          </div>
          <label className="clients-group-select">
            <select
              onChange={(event) => setStaffFilter(event.target.value)}
              value={staffFilter}
            >
              <option value="">Все специалисты</option>
              {staffOptions.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.displayName}
                </option>
              ))}
            </select>
            <ChevronDown aria-hidden="true" size={16} />
          </label>
        </aside>
      </div>

      {isBonusFormOpen ? (
        <Modal
          description={`Будет начислено выбранным клиентам: ${selectedIds.size}.`}
          onClose={() => setIsBonusFormOpen(false)}
          title="Начислить бонусы"
        >
          <div className="modal-form">
            <label className="form-field">
              <span>Баллы</span>
              <input
                inputMode="numeric"
                onChange={(event) => setBonusPoints(event.target.value)}
                value={bonusPoints}
              />
            </label>
            <label className="form-field">
              <span>Причина</span>
              <input
                maxLength={500}
                onChange={(event) => setBonusReason(event.target.value)}
                value={bonusReason}
              />
            </label>
            {bonusError ? (
              <p className="feedback feedback-error" role="alert">
                {bonusError}
              </p>
            ) : null}
            <footer className="modal-actions">
              <button
                className="secondary-button"
                onClick={() => setIsBonusFormOpen(false)}
                type="button"
              >
                Отмена
              </button>
              <button
                className="primary-button"
                disabled={isBonusSaving}
                onClick={() => void submitBulkBonus()}
                type="button"
              >
                {isBonusSaving ? "Начисляем…" : "Начислить"}
              </button>
            </footer>
          </div>
        </Modal>
      ) : null}

      {isFormOpen ? (
        <Modal
          description="Контактные данные и служебная информация CRM."
          onClose={() => setIsFormOpen(false)}
          title={editingClient ? "Изменить клиента" : "Новый клиент"}
        >
          <form className="modal-form" onSubmit={(event) => void submitClient(event)}>
            <div className="form-grid form-grid-two">
              <label className="form-field">
                <span>Имя и фамилия</span>
                <input
                  autoFocus
                  maxLength={160}
                  onChange={(event) => updateForm("fullName", event.target.value)}
                  required
                  value={form.fullName}
                />
              </label>
              <label className="form-field">
                <span>Телефон</span>
                <input
                  autoComplete="tel"
                  maxLength={30}
                  onChange={(event) => updateForm("phone", event.target.value)}
                  required
                  type="tel"
                  value={form.phone}
                />
              </label>
              <label className="form-field">
                <span>Email</span>
                <input
                  autoComplete="email"
                  onChange={(event) => updateForm("email", event.target.value)}
                  type="email"
                  value={form.email}
                />
              </label>
              <label className="form-field">
                <span>Telegram</span>
                <input
                  maxLength={80}
                  onChange={(event) =>
                    updateForm("telegramUsername", event.target.value)
                  }
                  placeholder="@username"
                  value={form.telegramUsername}
                />
              </label>
              <label className="form-field">
                <span>WhatsApp</span>
                <input
                  maxLength={30}
                  onChange={(event) =>
                    updateForm("whatsappPhone", event.target.value)
                  }
                  type="tel"
                  value={form.whatsappPhone}
                />
              </label>
            </div>

            <fieldset className="tag-fieldset allergen-fieldset">
              <legend>Аллергии и чувствительность</legend>
              {editingClient?.noKnownAllergies ? (
                <p className="legacy-allergy-note">
                  Клиент указал в личном кабинете: нет известных аллергий.
                </p>
              ) : null}
              {editingClient?.customAllergyNote ? (
                <p className="legacy-allergy-note">
                  Свой аллерген со слов клиента (личный кабинет, не входит в
                  общий справочник): {editingClient.customAllergyNote}
                </p>
              ) : null}
              {editingClient?.allergies ? (
                <p className="legacy-allergy-note">
                  Старая свободная запись об аллергии (сохранена как есть,
                  перенесите нужное в теги ниже вручную):{" "}
                  {editingClient.allergies}
                </p>
              ) : null}
              <div className="tag-cloud" aria-label="Аллергены клиента">
                {visibleAllergenOptions.map((allergen) => {
                  const isSelected = form.allergens.some((title) =>
                    sameDictionaryTitle(title, allergen.title)
                  );
                  return (
                    <button
                      aria-pressed={isSelected}
                      className={`tag-option allergen-option${
                        isSelected ? " allergen-option-selected" : ""
                      }`}
                      key={allergen.title}
                      onClick={() => toggleAllergen(allergen.title)}
                      title={allergen.description ?? undefined}
                      type="button"
                    >
                      {allergen.title}
                    </button>
                  );
                })}
              </div>
              <div className="tag-create-row">
                <label className="form-field">
                  <span>Другой аллерген</span>
                  <input
                    maxLength={120}
                    onChange={(event) => setNewAllergen(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addAllergen();
                      }
                    }}
                    placeholder="Название вещества или материала"
                    value={newAllergen}
                  />
                </label>
                <button
                  aria-label="Добавить аллерген"
                  className="secondary-button"
                  disabled={!newAllergen.trim()}
                  onClick={addAllergen}
                  type="button"
                >
                  <Plus aria-hidden="true" size={16} />
                  Добавить
                </button>
              </div>
              <small>
                Сведения со слов клиента. При выраженной реакции требуется
                уточнить рекомендации врача до процедуры.
              </small>
            </fieldset>

            <label className="form-field">
              <span>Внутренняя заметка</span>
              <textarea
                maxLength={4000}
                onChange={(event) => updateForm("notes", event.target.value)}
                rows={3}
                value={form.notes}
              />
            </label>

            <fieldset className="tag-fieldset">
              <legend>Внутренние метки</legend>
              <div className="tag-cloud" aria-label="Внутренние метки клиента">
                {visiblePrivateTagOptions.map((title) => {
                  const isSelected = form.privateTags.some((tag) =>
                    sameDictionaryTitle(tag, title)
                  );
                  return (
                    <button
                      aria-pressed={isSelected}
                      className={`tag-option${
                        isSelected ? " tag-option-selected" : ""
                      }`}
                      key={title}
                      onClick={() => togglePrivateTag(title)}
                      type="button"
                    >
                      {title}
                    </button>
                  );
                })}
              </div>
              <div className="tag-create-row">
                <label className="form-field">
                  <span>Новая метка</span>
                  <input
                    maxLength={80}
                    onChange={(event) => setNewPrivateTag(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addPrivateTag();
                      }
                    }}
                    placeholder="Например, любит тишину"
                    value={newPrivateTag}
                  />
                </label>
                <button
                  aria-label="Добавить внутреннюю метку"
                  className="secondary-button"
                  disabled={!newPrivateTag.trim()}
                  onClick={addPrivateTag}
                  type="button"
                >
                  <Plus aria-hidden="true" size={16} />
                  Добавить
                </button>
              </div>
              <small>
                Метки видны только сотрудникам внутри CRM и никогда не
                показываются клиенту.
              </small>
            </fieldset>

            <label className="checkbox-field">
              <input
                checked={form.requiresPrepayment}
                onChange={(event) =>
                  updateForm("requiresPrepayment", event.target.checked)
                }
                type="checkbox"
              />
              <span>
                <strong>Требовать предоплату</strong>
                <small>Применяется к следующей записи клиента.</small>
              </span>
            </label>

            {form.requiresPrepayment ? (
              <label className="form-field">
                <span>Причина предоплаты</span>
                <input
                  maxLength={500}
                  onChange={(event) =>
                    updateForm("prepaymentReason", event.target.value)
                  }
                  value={form.prepaymentReason}
                />
              </label>
            ) : null}

            <label className="form-field">
              <span>Скидка, %</span>
              <input
                inputMode="numeric"
                max={100}
                min={0}
                onChange={(event) => updateForm("discountPercent", event.target.value)}
                value={form.discountPercent}
              />
            </label>

            <label className="checkbox-field">
              <input
                checked={form.isBlocked}
                onChange={(event) => updateForm("isBlocked", event.target.checked)}
                type="checkbox"
              />
              <span>
                <strong>Клиент заблокирован</strong>
                <small>
                  Не сможет записаться через сайт или бота. Запись из CRM
                  по-прежнему доступна.
                </small>
              </span>
            </label>

            {editingClient ? (
              <LoyaltyTransactionsSection clientId={editingClient.id} />
            ) : null}

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

type LoyaltyTransaction = {
  id: string;
  type: "accrual" | "redemption" | "adjustment" | "reversal";
  pointsDelta: number;
  reason: string | null;
  createdAt: string;
  appointmentId: string | null;
  createdByDisplayName: string | null;
};

const loyaltyTypeLabels: Record<LoyaltyTransaction["type"], string> = {
  accrual: "Начисление",
  redemption: "Списание",
  adjustment: "Корректировка",
  reversal: "Отмена операции"
};

const loyaltyDateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit"
});

function LoyaltyTransactionsSection({ clientId }: { clientId: string }) {
  const [balance, setBalance] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<LoyaltyTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeDirection, setActiveDirection] = useState<
    "accrual" | "redemption" | null
  >(null);
  const [points, setPoints] = useState("");
  const [reason, setReason] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await apiRequest<{
        balancePoints: number;
        transactions: LoyaltyTransaction[];
      }>(`/v1/admin/clients/${clientId}/loyalty-transactions`);
      setBalance(data.balancePoints);
      setTransactions(data.transactions);
    } catch {
      setLoadError("Не удалось загрузить историю бонусов.");
    } finally {
      setIsLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  function openForm(direction: "accrual" | "redemption") {
    setActiveDirection(direction);
    setPoints("");
    setReason("");
    setSaveError(null);
  }

  function suppressEnterSubmit(event: { key: string; preventDefault: () => void }) {
    if (event.key === "Enter") event.preventDefault();
  }

  async function submitAdjustment() {
    if (!activeDirection) return;
    const parsedPoints = Number(points);
    if (!Number.isInteger(parsedPoints) || parsedPoints <= 0 || !reason.trim()) {
      setSaveError("Укажите целое число баллов больше нуля и причину.");
      return;
    }
    setIsSaving(true);
    setSaveError(null);
    try {
      await apiRequest(`/v1/admin/clients/${clientId}/loyalty-transactions`, {
        method: "POST",
        body: JSON.stringify({
          direction: activeDirection,
          points: parsedPoints,
          reason: reason.trim()
        })
      });
      setActiveDirection(null);
      await load();
    } catch {
      setSaveError("Не удалось сохранить операцию.");
    } finally {
      setIsSaving(false);
    }
  }

  const accrued = transactions
    .filter((transaction) => transaction.pointsDelta > 0)
    .reduce((sum, transaction) => sum + transaction.pointsDelta, 0);
  const redeemed = transactions
    .filter((transaction) => transaction.pointsDelta < 0)
    .reduce((sum, transaction) => sum + Math.abs(transaction.pointsDelta), 0);

  return (
    <fieldset className="tag-fieldset">
      <legend>Бонусы</legend>

      <div className="loyalty-summary">
        <span>
          <strong>Баланс:</strong> {isLoading ? "…" : (balance ?? 0)}
        </span>
        <span>
          <strong>Начислено:</strong> {isLoading ? "…" : accrued}
        </span>
        <span>
          <strong>Списано:</strong> {isLoading ? "…" : redeemed}
        </span>
      </div>

      <div className="loyalty-actions">
        <button
          className="secondary-button"
          onClick={() => openForm("accrual")}
          type="button"
        >
          Начислить
        </button>
        <button
          className="secondary-button"
          onClick={() => openForm("redemption")}
          type="button"
        >
          Списать
        </button>
      </div>

      {activeDirection ? (
        <div className="loyalty-adjustment-form">
          <label className="form-field">
            <span>Баллы</span>
            <input
              inputMode="numeric"
              onChange={(event) => setPoints(event.target.value)}
              onKeyDown={suppressEnterSubmit}
              value={points}
            />
          </label>
          <label className="form-field">
            <span>Причина</span>
            <input
              maxLength={500}
              onChange={(event) => setReason(event.target.value)}
              onKeyDown={suppressEnterSubmit}
              value={reason}
            />
          </label>
          {saveError ? (
            <p className="feedback feedback-error" role="alert">
              {saveError}
            </p>
          ) : null}
          <div className="loyalty-actions">
            <button
              className="secondary-button"
              onClick={() => setActiveDirection(null)}
              type="button"
            >
              Отмена
            </button>
            <button
              className="primary-button"
              disabled={isSaving}
              onClick={() => void submitAdjustment()}
              type="button"
            >
              {isSaving ? "Сохраняем…" : "Подтвердить"}
            </button>
          </div>
        </div>
      ) : null}

      {loadError ? (
        <p className="feedback feedback-error" role="alert">
          {loadError}
        </p>
      ) : !isLoading && transactions.length === 0 ? (
        <small>Операций пока нет.</small>
      ) : transactions.length > 0 ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Тип</th>
                <th>Баллы</th>
                <th>Причина</th>
                <th>Автор</th>
                <th>Дата</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((transaction) => (
                <tr key={transaction.id}>
                  <td>{loyaltyTypeLabels[transaction.type]}</td>
                  <td>
                    {transaction.pointsDelta > 0
                      ? `+${transaction.pointsDelta}`
                      : transaction.pointsDelta}
                  </td>
                  <td>{transaction.reason ?? "—"}</td>
                  <td>{transaction.createdByDisplayName ?? "—"}</td>
                  <td>{loyaltyDateFormatter.format(new Date(transaction.createdAt))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </fieldset>
  );
}
