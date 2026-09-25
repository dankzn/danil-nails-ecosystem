"use client";

import { Pencil, Plus, Search, UserPlus, Users } from "lucide-react";
import {
  useCallback,
  useEffect,
  useState,
  type FormEvent
} from "react";
import { ApiError, apiRequest } from "../lib/api";
import { Modal } from "../ui/modal";

type Client = {
  id: string;
  fullName: string | null;
  phone: string;
  email: string | null;
  telegramUsername: string | null;
  whatsappPhone: string | null;
  allergies: string | null;
  notes: string | null;
  requiresPrepayment: boolean;
  prepaymentReason: string | null;
  loyaltyStatus: { titleRu: string } | null;
  privateTagAssignments: Array<{ tag: { id: string; title: string } }>;
  allergenAssignments: Array<{
    allergen: { id: string; title: string; description: string | null };
  }>;
  appointments: Array<{ startsAt: string }>;
  _count: { appointments: number };
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
  prepaymentReason: ""
};

const visitDateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "short",
  year: "numeric"
});

function formatVisitCount(count: number) {
  const lastTwoDigits = count % 100;
  const lastDigit = count % 10;
  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return `${count} визитов`;
  if (lastDigit === 1) return `${count} визит`;
  if (lastDigit >= 2 && lastDigit <= 4) return `${count} визита`;
  return `${count} визитов`;
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

function legacyAllergens(value: string | null) {
  if (!value) return [];
  return value
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
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

  const loadClients = useCallback(async (query: string, signal?: AbortSignal) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const searchParams = new URLSearchParams({ limit: "100" });
      if (query.trim()) searchParams.set("search", query.trim());
      const response = await apiRequest<{ clients: Client[] }>(
        `/v1/admin/clients?${searchParams}`,
        signal ? { signal } : {}
      );
      setClients(response.clients);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setLoadError("Не удалось загрузить клиентов.");
    } finally {
      if (!signal?.aborted) setIsLoading(false);
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

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      void loadClients(search, controller.signal);
    }, 250);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [loadClients, search]);

  useEffect(() => {
    void loadClientReferenceData();
  }, [loadClientReferenceData]);

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
      prepaymentReason: client.prepaymentReason ?? ""
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
        : null
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
      await Promise.all([loadClients(search), loadClientReferenceData()]);
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

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">CRM клиентов</p>
          <h1>Клиенты</h1>
          <p className="page-description">
            Контакты, история визитов и внутренние отметки.
          </p>
        </div>
        <button className="primary-button" onClick={openCreateForm} type="button">
          <UserPlus aria-hidden="true" size={18} />
          Добавить клиента
        </button>
      </header>

      {notice ? (
        <p className="feedback feedback-success" role="status">
          {notice}
        </p>
      ) : null}

      <section className="panel table-panel">
        <div className="table-toolbar">
          <label className="search-field">
            <Search aria-hidden="true" size={17} />
            <span className="sr-only">Найти клиента</span>
            <input
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Имя, телефон или Telegram"
              type="search"
              value={search}
            />
          </label>
          <span className="muted-label">
            {isLoading ? "Загрузка…" : formatVisitCount(clients.length).replace("визит", "клиент")}
          </span>
        </div>

        {loadError ? (
          <div className="table-message table-message-error" role="alert">
            <p>{loadError}</p>
            <button
              className="secondary-button"
              onClick={() => void loadClients(search)}
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
            <table>
              <thead>
                <tr>
                  <th>Клиент</th>
                  <th>Контакты</th>
                  <th>Последний визит</th>
                  <th>Лояльность</th>
                  <th>Аллергии</th>
                  <th>Внутренняя метка</th>
                  <th>Предоплата</th>
                  <th aria-label="Действия" />
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => {
                  const privateTags = client.privateTagAssignments.map(
                    ({ tag }) => tag.title
                  );
                  const clientAllergens = uniqueDictionaryTitles([
                    ...client.allergenAssignments.map(
                      ({ allergen }) => allergen.title
                    ),
                    ...legacyAllergens(client.allergies)
                  ]);
                  const lastVisit = client.appointments[0]?.startsAt;

                  return (
                    <tr key={client.id}>
                      <td>
                        <strong>{client.fullName ?? "Без имени"}</strong>
                        <small>{formatVisitCount(client._count.appointments)}</small>
                      </td>
                      <td>
                        <span>{client.phone}</span>
                        <small>
                          {client.telegramUsername
                            ? `@${client.telegramUsername}`
                            : client.email ?? "Нет дополнительных контактов"}
                        </small>
                      </td>
                      <td>
                        {lastVisit
                          ? visitDateFormatter.format(new Date(lastVisit))
                          : "Ещё не был"}
                      </td>
                      <td>
                        <span className="loyalty-badge">
                          {client.loyaltyStatus?.titleRu ?? "Без статуса"}
                        </span>
                      </td>
                      <td className="tag-cell">
                        {clientAllergens.length ? (
                          <div className="private-tag-list">
                            {clientAllergens.map((title) => (
                              <span
                                className="allergen-badge"
                                key={title}
                                title={title}
                              >
                                {title}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="muted-label">Нет</span>
                        )}
                      </td>
                      <td className="tag-cell">
                        {privateTags.length ? (
                          <div className="private-tag-list">
                            {privateTags.map((title) => (
                              <span
                                className="private-badge"
                                key={title}
                                title={title}
                              >
                                {title}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="muted-label">Нет</span>
                        )}
                      </td>
                      <td>
                        <span
                          className={`status ${
                            client.requiresPrepayment
                              ? "status-danger"
                              : "status-neutral"
                          }`}
                        >
                          {client.requiresPrepayment ? "Обязательна" : "Не требуется"}
                        </span>
                      </td>
                      <td className="action-cell">
                        <button
                          aria-label={`Изменить клиента ${client.fullName ?? client.phone}`}
                          className="icon-button table-action"
                          onClick={() => openEditForm(client)}
                          title="Изменить"
                          type="button"
                        >
                          <Pencil aria-hidden="true" size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

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
