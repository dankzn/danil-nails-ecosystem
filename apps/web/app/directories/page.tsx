"use client";

import { Archive, ArchiveRestore, Pencil, Plus } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ApiError, apiRequest } from "../lib/api";
import { Modal } from "../ui/modal";

type Entry = { id: string; title: string; isArchived: boolean };
type CityEntry = Entry & { countryId: string; country: { id: string; title: string } };
type PositionEntry = {
  id: string;
  titleRu: string;
  titleEn: string | null;
  titleEs: string | null;
  titleFr: string | null;
  isInternal: boolean;
  isMasterRole: boolean;
  isArchived: boolean;
};

type Directories = {
  positions: PositionEntry[];
  countries: Entry[];
  cities: CityEntry[];
  organizations: Entry[];
  orgUnitTypes: Entry[];
  managerTypes: Entry[];
};

const simpleTabs = [
  { key: "countries", label: "Страны", kind: "countries" },
  { key: "organizations", label: "Организации", kind: "organizations" },
  { key: "orgUnitTypes", label: "Типы оргобъектов", kind: "org-unit-types" },
  { key: "managerTypes", label: "Типы руководителей", kind: "manager-types" }
] as const;
type SimpleTabKey = (typeof simpleTabs)[number]["key"];
type TabKey = SimpleTabKey | "cities" | "positions";

const emptyPositionForm = {
  titleRu: "",
  titleEn: "",
  titleEs: "",
  titleFr: "",
  isInternal: false,
  isMasterRole: true
};

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: "positions", label: "Должности" },
  { key: "cities", label: "Города" },
  { key: "countries", label: "Страны" },
  { key: "organizations", label: "Организации" },
  { key: "orgUnitTypes", label: "Типы оргобъектов" },
  { key: "managerTypes", label: "Типы руководителей" }
];

function directoryErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === "directory_entry_already_exists") {
      return "Запись с таким названием уже существует.";
    }
    if (error.code === "country_not_found") return "Страна не найдена.";
    if (error.status === 401 || error.status === 403) {
      return "Недостаточно прав или сессия завершилась.";
    }
  }
  return "Не удалось сохранить справочник. Попробуйте ещё раз.";
}

export default function DirectoriesPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("positions");
  const [data, setData] = useState<Directories | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newCityCountryId, setNewCityCountryId] = useState("");
  const [newPosition, setNewPosition] = useState(emptyPositionForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [editingEntry, setEditingEntry] = useState<Entry | CityEntry | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editCountryId, setEditCountryId] = useState("");
  const [editingPosition, setEditingPosition] = useState<PositionEntry | null>(null);
  const [editPosition, setEditPosition] = useState(emptyPositionForm);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await apiRequest<Directories>("/v1/owner/directories");
      setData(response);
    } catch {
      setLoadError("Не удалось загрузить справочники.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setNewTitle("");
    setNewCityCountryId(data?.countries[0]?.id ?? "");
    setNewPosition(emptyPositionForm);
    setFormError(null);
  }, [activeTab, data?.countries]);

  function entriesForTab(): Array<
    Entry | CityEntry | (Entry & { isInternal: boolean; isMasterRole: boolean })
  > {
    if (!data) return [];
    if (activeTab === "cities") return data.cities;
    if (activeTab === "positions") {
      return data.positions.map((position) => ({
        id: position.id,
        title: position.titleRu,
        isInternal: position.isInternal,
        isMasterRole: position.isMasterRole,
        isArchived: position.isArchived
      }));
    }
    const tab = simpleTabs.find((item) => item.key === activeTab);
    return tab ? data[tab.key] : [];
  }

  async function createEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (activeTab === "positions") {
      if (!newPosition.titleRu.trim()) {
        setFormError("Введите название на русском.");
        return;
      }
      setIsSaving(true);
      setFormError(null);
      setNotice(null);
      try {
        await apiRequest("/v1/owner/directories/positions", {
          method: "POST",
          body: JSON.stringify({
            titleRu: newPosition.titleRu.trim(),
            titleEn: newPosition.titleEn.trim() || null,
            titleEs: newPosition.titleEs.trim() || null,
            titleFr: newPosition.titleFr.trim() || null,
            isInternal: newPosition.isInternal,
            isMasterRole: newPosition.isMasterRole
          })
        });
        setNewPosition(emptyPositionForm);
        setNotice("Запись добавлена.");
        await load();
      } catch (error) {
        setFormError(directoryErrorMessage(error));
      } finally {
        setIsSaving(false);
      }
      return;
    }

    if (!newTitle.trim()) {
      setFormError("Введите название записи.");
      return;
    }
    setIsSaving(true);
    setFormError(null);
    setNotice(null);
    try {
      if (activeTab === "cities") {
        if (!newCityCountryId) {
          setFormError("Выберите страну.");
          setIsSaving(false);
          return;
        }
        await apiRequest("/v1/owner/directories/cities", {
          method: "POST",
          body: JSON.stringify({ title: newTitle.trim(), countryId: newCityCountryId })
        });
      } else {
        const tab = simpleTabs.find((item) => item.key === activeTab)!;
        await apiRequest(`/v1/owner/directories/${tab.kind}`, {
          method: "POST",
          body: JSON.stringify({ title: newTitle.trim() })
        });
      }
      setNewTitle("");
      setNotice("Запись добавлена.");
      await load();
    } catch (error) {
      setFormError(directoryErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  function openEdit(entry: Entry | CityEntry) {
    if (activeTab === "positions") {
      const position = data?.positions.find((item) => item.id === entry.id);
      if (!position) return;
      setEditingPosition(position);
      setEditPosition({
        titleRu: position.titleRu,
        titleEn: position.titleEn ?? "",
        titleEs: position.titleEs ?? "",
        titleFr: position.titleFr ?? "",
        isInternal: position.isInternal,
        isMasterRole: position.isMasterRole
      });
      setFormError(null);
      return;
    }
    setEditingEntry(entry);
    setEditTitle(entry.title);
    setEditCountryId("countryId" in entry ? entry.countryId : "");
    setFormError(null);
  }

  async function savePositionEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingPosition || !editPosition.titleRu.trim()) return;
    setIsSaving(true);
    setFormError(null);
    try {
      await apiRequest(`/v1/owner/directories/positions/${editingPosition.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          titleRu: editPosition.titleRu.trim(),
          titleEn: editPosition.titleEn.trim() || null,
          titleEs: editPosition.titleEs.trim() || null,
          titleFr: editPosition.titleFr.trim() || null,
          isInternal: editPosition.isInternal,
          isMasterRole: editPosition.isMasterRole
        })
      });
      setEditingPosition(null);
      setNotice("Запись обновлена.");
      await load();
    } catch (error) {
      setFormError(directoryErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingEntry || !editTitle.trim()) return;
    setIsSaving(true);
    setFormError(null);
    try {
      if (activeTab === "cities") {
        await apiRequest(`/v1/owner/directories/cities/${editingEntry.id}`, {
          method: "PATCH",
          body: JSON.stringify({ title: editTitle.trim(), countryId: editCountryId })
        });
      } else {
        const tab = simpleTabs.find((item) => item.key === activeTab)!;
        await apiRequest(`/v1/owner/directories/${tab.kind}/${editingEntry.id}`, {
          method: "PATCH",
          body: JSON.stringify({ title: editTitle.trim() })
        });
      }
      setEditingEntry(null);
      setNotice("Запись обновлена.");
      await load();
    } catch (error) {
      setFormError(directoryErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function toggleArchived(entry: Entry | CityEntry) {
    setNotice(null);
    try {
      const path =
        activeTab === "cities"
          ? `/v1/owner/directories/cities/${entry.id}`
          : activeTab === "positions"
            ? `/v1/owner/directories/positions/${entry.id}`
            : `/v1/owner/directories/${simpleTabs.find((item) => item.key === activeTab)!.kind}/${entry.id}`;
      await apiRequest(path, {
        method: "PATCH",
        body: JSON.stringify({ isArchived: !entry.isArchived })
      });
      setNotice(entry.isArchived ? "Запись восстановлена." : "Запись отправлена в архив.");
      await load();
    } catch (error) {
      setLoadError(directoryErrorMessage(error));
    }
  }

  const entries = entriesForTab();

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Только для владельца</p>
          <h1>Справочники</h1>
          <p className="page-description">
            Должности, география и системные списки, из которых заполняются карточки сотрудников и оргструктура.
          </p>
        </div>
      </header>

      <div className="tab-bar" role="tablist">
        {tabs.map((tab) => (
          <button
            aria-selected={activeTab === tab.key}
            className={`tab-button${activeTab === tab.key ? " tab-button-active" : ""}`}
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            role="tab"
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      {notice ? (
        <p className="feedback feedback-success" role="status">
          {notice}
        </p>
      ) : null}

      <section className="panel table-panel">
        {activeTab === "positions" ? (
          <form className="table-toolbar directory-add-row" onSubmit={createEntry}>
            <div className="directory-add-fields directory-add-fields-position">
              <input
                maxLength={160}
                onChange={(event) =>
                  setNewPosition((form) => ({ ...form, titleRu: event.target.value }))
                }
                placeholder="Название (русский)"
                required
                value={newPosition.titleRu}
              />
              <input
                maxLength={160}
                onChange={(event) =>
                  setNewPosition((form) => ({ ...form, titleEn: event.target.value }))
                }
                placeholder="English"
                value={newPosition.titleEn}
              />
              <input
                maxLength={160}
                onChange={(event) =>
                  setNewPosition((form) => ({ ...form, titleEs: event.target.value }))
                }
                placeholder="Español"
                value={newPosition.titleEs}
              />
              <input
                maxLength={160}
                onChange={(event) =>
                  setNewPosition((form) => ({ ...form, titleFr: event.target.value }))
                }
                placeholder="Français"
                value={newPosition.titleFr}
              />
              <label className="checkbox-field directory-internal-toggle">
                <input
                  checked={newPosition.isInternal}
                  onChange={(event) =>
                    setNewPosition((form) => ({ ...form, isInternal: event.target.checked }))
                  }
                  type="checkbox"
                />
                <span>Внутренняя (не видна клиентам и на сайте)</span>
              </label>
              <label className="checkbox-field directory-internal-toggle">
                <input
                  checked={newPosition.isMasterRole}
                  onChange={(event) =>
                    setNewPosition((form) => ({ ...form, isMasterRole: event.target.checked }))
                  }
                  type="checkbox"
                />
                <span>Мастер (показывать на странице мастеров сайта)</span>
              </label>
            </div>
            <button className="primary-button" disabled={isSaving} type="submit">
              <Plus aria-hidden="true" size={15} />
              Добавить
            </button>
          </form>
        ) : (
          <form className="table-toolbar directory-add-row" onSubmit={createEntry}>
            <div className="directory-add-fields">
              <input
                maxLength={160}
                onChange={(event) => setNewTitle(event.target.value)}
                placeholder="Название новой записи"
                required
                value={newTitle}
              />
              {activeTab === "cities" ? (
                <select
                  onChange={(event) => setNewCityCountryId(event.target.value)}
                  value={newCityCountryId}
                >
                  {(data?.countries ?? []).map((country) => (
                    <option key={country.id} value={country.id}>
                      {country.title}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>
            <button className="primary-button" disabled={isSaving} type="submit">
              <Plus aria-hidden="true" size={15} />
              Добавить
            </button>
          </form>
        )}
        {formError && !editingEntry && !editingPosition ? (
          <p className="feedback feedback-error" role="alert">
            {formError}
          </p>
        ) : null}

        {isLoading ? (
          <div className="table-message" role="status">
            <p>Загружаем справочник…</p>
          </div>
        ) : loadError ? (
          <div className="table-message table-message-error" role="alert">
            <p>{loadError}</p>
          </div>
        ) : entries.length === 0 ? (
          <div className="empty-table-state">
            <div>
              <strong>Пока пусто</strong>
              <span>Добавьте первую запись через форму выше.</span>
            </div>
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Название</th>
                  {activeTab === "cities" ? <th>Страна</th> : null}
                  <th>Статус</th>
                  <th aria-label="Действия" />
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td>{entry.title}</td>
                    {activeTab === "cities" ? (
                      <td>{"country" in entry ? entry.country.title : ""}</td>
                    ) : null}
                    <td>
                      <span
                        className={`status ${entry.isArchived ? "status-neutral" : "status-success"}`}
                      >
                        {entry.isArchived ? "Архив" : "Активна"}
                      </span>
                      {"isInternal" in entry && entry.isInternal ? (
                        <span className="status status-neutral">Внутренняя</span>
                      ) : null}
                      {"isMasterRole" in entry && entry.isMasterRole ? (
                        <span className="status status-success">Мастер</span>
                      ) : null}
                    </td>
                    <td className="action-cell">
                      <button
                        aria-label={`Переименовать ${entry.title}`}
                        className="icon-button table-action"
                        onClick={() => openEdit(entry)}
                        title="Переименовать"
                        type="button"
                      >
                        <Pencil aria-hidden="true" size={15} />
                      </button>
                      <button
                        aria-label={
                          entry.isArchived
                            ? `Восстановить ${entry.title}`
                            : `Архивировать ${entry.title}`
                        }
                        className="icon-button table-action"
                        onClick={() => void toggleArchived(entry)}
                        title={entry.isArchived ? "Восстановить" : "Архивировать"}
                        type="button"
                      >
                        {entry.isArchived ? (
                          <ArchiveRestore aria-hidden="true" size={15} />
                        ) : (
                          <Archive aria-hidden="true" size={15} />
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editingPosition ? (
        <Modal
          description="Изменения сразу применяются везде, где используется эта запись."
          onClose={() => setEditingPosition(null)}
          title="Изменить должность"
        >
          <form className="modal-form" onSubmit={savePositionEdit}>
            <label className="form-field">
              <span>Название (русский)</span>
              <input
                maxLength={160}
                onChange={(event) =>
                  setEditPosition((form) => ({ ...form, titleRu: event.target.value }))
                }
                required
                value={editPosition.titleRu}
              />
            </label>
            <label className="form-field">
              <span>English</span>
              <input
                maxLength={160}
                onChange={(event) =>
                  setEditPosition((form) => ({ ...form, titleEn: event.target.value }))
                }
                value={editPosition.titleEn}
              />
            </label>
            <label className="form-field">
              <span>Español</span>
              <input
                maxLength={160}
                onChange={(event) =>
                  setEditPosition((form) => ({ ...form, titleEs: event.target.value }))
                }
                value={editPosition.titleEs}
              />
            </label>
            <label className="form-field">
              <span>Français</span>
              <input
                maxLength={160}
                onChange={(event) =>
                  setEditPosition((form) => ({ ...form, titleFr: event.target.value }))
                }
                value={editPosition.titleFr}
              />
            </label>
            <label className="checkbox-field">
              <input
                checked={editPosition.isInternal}
                onChange={(event) =>
                  setEditPosition((form) => ({ ...form, isInternal: event.target.checked }))
                }
                type="checkbox"
              />
              <span>Внутренняя (не видна клиентам и на сайте)</span>
            </label>
            <label className="checkbox-field">
              <input
                checked={editPosition.isMasterRole}
                onChange={(event) =>
                  setEditPosition((form) => ({ ...form, isMasterRole: event.target.checked }))
                }
                type="checkbox"
              />
              <span>Мастер (показывать на странице мастеров сайта)</span>
            </label>
            {formError ? (
              <p className="feedback feedback-error" role="alert">
                {formError}
              </p>
            ) : null}
            <footer className="modal-actions">
              <button
                className="secondary-button"
                onClick={() => setEditingPosition(null)}
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

      {editingEntry ? (
        <Modal
          description="Изменения сразу применяются везде, где используется эта запись."
          onClose={() => setEditingEntry(null)}
          title="Переименовать запись"
        >
          <form className="modal-form" onSubmit={saveEdit}>
            <label className="form-field">
              <span>Название</span>
              <input
                maxLength={160}
                onChange={(event) => setEditTitle(event.target.value)}
                required
                value={editTitle}
              />
            </label>
            {activeTab === "cities" ? (
              <label className="form-field">
                <span>Страна</span>
                <select
                  onChange={(event) => setEditCountryId(event.target.value)}
                  value={editCountryId}
                >
                  {(data?.countries ?? []).map((country) => (
                    <option key={country.id} value={country.id}>
                      {country.title}
                    </option>
                  ))}
                </select>
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
                onClick={() => setEditingEntry(null)}
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
