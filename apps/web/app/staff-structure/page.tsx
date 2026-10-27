"use client";

import { Archive, ArchiveRestore, ChevronRight, Pencil, Plus } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactElement
} from "react";
import { ApiError, apiRequest } from "../lib/api";
import { Modal } from "../ui/modal";

type NamedRef = { id: string; title: string };
type OrgUnit = {
  id: string;
  title: string;
  typeId: string;
  parentId: string | null;
  organizationId: string;
  cityId: string | null;
  countryId: string | null;
  isArchived: boolean;
  type: NamedRef;
  organization: NamedRef;
  city: NamedRef | null;
  country: NamedRef | null;
  managers: Array<{
    id: string;
    staff: { id: string; displayName: string };
    managerType: NamedRef;
  }>;
};

type Directories = {
  countries: NamedRef[];
  cities: Array<NamedRef & { countryId: string }>;
  organizations: NamedRef[];
  orgUnitTypes: NamedRef[];
};

type OrgUnitForm = {
  title: string;
  typeId: string;
  organizationId: string;
  parentId: string;
  cityId: string;
  countryId: string;
};

function emptyForm(directories: Directories | null, parentId = ""): OrgUnitForm {
  return {
    title: "",
    typeId: directories?.orgUnitTypes[0]?.id ?? "",
    organizationId: directories?.organizations[0]?.id ?? "",
    parentId,
    cityId: "",
    countryId: ""
  };
}

function orgUnitErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === "org_unit_cycle") {
      return "Нельзя переместить подразделение внутрь его же дочернего объекта.";
    }
    if (error.code === "org_unit_reference_not_found") {
      return "Проверьте выбранные тип, организацию, город и страну.";
    }
    if (error.status === 401 || error.status === 403) {
      return "Недостаточно прав или сессия завершилась.";
    }
  }
  return "Не удалось сохранить подразделение. Попробуйте ещё раз.";
}

function buildTree(units: OrgUnit[]) {
  const byParent = new Map<string | null, OrgUnit[]>();
  for (const unit of units) {
    const key = unit.parentId;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(unit);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.title.localeCompare(b.title, "ru"));
  }
  return byParent;
}

export default function StaffStructurePage() {
  const [units, setUnits] = useState<OrgUnit[]>([]);
  const [directories, setDirectories] = useState<Directories | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<OrgUnit | null>(null);
  const [form, setForm] = useState<OrgUnitForm>(emptyForm(null));
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [unitsResponse, directoriesResponse] = await Promise.all([
        apiRequest<{ orgUnits: OrgUnit[] }>("/v1/owner/org-units"),
        apiRequest<Directories>("/v1/owner/directories")
      ]);
      setUnits(unitsResponse.orgUnits);
      setDirectories(directoriesResponse);
    } catch {
      setLoadError("Не удалось загрузить оргструктуру.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const tree = useMemo(() => buildTree(units), [units]);
  const citiesForCountry = (countryId: string) =>
    (directories?.cities ?? []).filter((city) => city.countryId === countryId);

  function openCreateForm(parentId = "") {
    setEditingUnit(null);
    setForm(emptyForm(directories, parentId));
    setFormError(null);
    setIsFormOpen(true);
  }

  function openEditForm(unit: OrgUnit) {
    setEditingUnit(unit);
    setForm({
      title: unit.title,
      typeId: unit.typeId,
      organizationId: unit.organizationId,
      parentId: unit.parentId ?? "",
      cityId: unit.cityId ?? "",
      countryId: unit.countryId ?? ""
    });
    setFormError(null);
    setIsFormOpen(true);
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setFormError(null);
    setNotice(null);
    const payload = {
      title: form.title.trim(),
      typeId: form.typeId,
      organizationId: form.organizationId,
      parentId: form.parentId || null,
      cityId: form.cityId || null,
      countryId: form.countryId || null
    };
    try {
      if (editingUnit) {
        await apiRequest(`/v1/owner/org-units/${editingUnit.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload)
        });
        setNotice("Подразделение обновлено.");
      } else {
        await apiRequest("/v1/owner/org-units", {
          method: "POST",
          body: JSON.stringify(payload)
        });
        setNotice("Подразделение создано.");
      }
      setIsFormOpen(false);
      await load();
    } catch (error) {
      setFormError(orgUnitErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function toggleArchived(unit: OrgUnit) {
    setNotice(null);
    try {
      await apiRequest(`/v1/owner/org-units/${unit.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isArchived: !unit.isArchived })
      });
      setNotice(
        unit.isArchived ? "Подразделение восстановлено." : "Подразделение отправлено в архив."
      );
      await load();
    } catch (error) {
      setLoadError(orgUnitErrorMessage(error));
    }
  }

  function renderNode(unit: OrgUnit, depth: number): ReactElement {
    const children = tree.get(unit.id) ?? [];
    const isCollapsed = collapsed[unit.id];

    return (
      <div className="org-unit-node" key={unit.id}>
        <div className="org-unit-row" style={{ paddingLeft: depth * 22 }}>
          {children.length ? (
            <button
              aria-expanded={!isCollapsed}
              aria-label={isCollapsed ? "Развернуть" : "Свернуть"}
              className="org-unit-collapse"
              onClick={() =>
                setCollapsed((current) => ({ ...current, [unit.id]: !isCollapsed }))
              }
              type="button"
            >
              <ChevronRight
                className={`org-unit-collapse-icon${isCollapsed ? "" : " org-unit-collapse-icon-open"}`}
                size={15}
              />
            </button>
          ) : (
            <span className="org-unit-collapse-spacer" />
          )}
          <div className="org-unit-copy">
            <strong>{unit.title}</strong>
            <small>
              {unit.type.title} · {unit.organization.title}
              {unit.city ? ` · ${unit.city.title}` : ""}
              {unit.isArchived ? " · В архиве" : ""}
            </small>
            {unit.managers.length ? (
              <small className="org-unit-managers">
                {unit.managers
                  .map(
                    (manager) => `${manager.staff.displayName} (${manager.managerType.title})`
                  )
                  .join(", ")}
              </small>
            ) : null}
          </div>
          <div className="org-unit-actions">
            <button
              className="icon-button table-action"
              onClick={() => openCreateForm(unit.id)}
              title="Добавить дочернее подразделение"
              type="button"
            >
              <Plus aria-hidden="true" size={15} />
            </button>
            <button
              className="icon-button table-action"
              onClick={() => openEditForm(unit)}
              title="Изменить"
              type="button"
            >
              <Pencil aria-hidden="true" size={15} />
            </button>
            <button
              className="icon-button table-action"
              onClick={() => void toggleArchived(unit)}
              title={unit.isArchived ? "Восстановить" : "Архивировать"}
              type="button"
            >
              {unit.isArchived ? (
                <ArchiveRestore aria-hidden="true" size={15} />
              ) : (
                <Archive aria-hidden="true" size={15} />
              )}
            </button>
          </div>
        </div>
        {!isCollapsed && children.length
          ? children.map((child) => renderNode(child, depth + 1))
          : null}
      </div>
    );
  }

  const roots = tree.get(null) ?? [];

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Только для владельца</p>
          <h1>Структура подразделений</h1>
          <p className="page-description">
            Иерархия организаций, групп, подразделений и отделов.
          </p>
        </div>
        <button
          className="primary-button"
          disabled={!directories || directories.organizations.length === 0}
          onClick={() => openCreateForm()}
          type="button"
        >
          <Plus aria-hidden="true" size={18} />
          Добавить подразделение
        </button>
      </header>

      {notice ? (
        <p className="feedback feedback-success" role="status">
          {notice}
        </p>
      ) : null}

      <section className="panel org-unit-tree">
        {isLoading ? (
          <div className="table-message" role="status">
            <p>Загружаем оргструктуру…</p>
          </div>
        ) : loadError ? (
          <div className="table-message table-message-error" role="alert">
            <p>{loadError}</p>
          </div>
        ) : !directories?.organizations.length ? (
          <div className="empty-table-state">
            <div>
              <strong>Сначала добавьте организацию</strong>
              <span>
                Раздел «Справочники → Организации» — оттуда подразделения берут привязку.
              </span>
            </div>
          </div>
        ) : roots.length === 0 ? (
          <div className="empty-table-state">
            <div>
              <strong>Оргструктура пуста</strong>
              <span>Добавьте первое подразделение кнопкой выше.</span>
            </div>
          </div>
        ) : (
          <div className="org-unit-list">{roots.map((unit) => renderNode(unit, 0))}</div>
        )}
      </section>

      {isFormOpen ? (
        <Modal
          onClose={() => setIsFormOpen(false)}
          title={editingUnit ? "Изменить подразделение" : "Новое подразделение"}
        >
          <form className="modal-form" onSubmit={submitForm}>
            <label className="form-field">
              <span>Название</span>
              <input
                maxLength={160}
                onChange={(event) =>
                  setForm((current) => ({ ...current, title: event.target.value }))
                }
                required
                value={form.title}
              />
            </label>
            <div className="form-grid form-grid-two">
              <label className="form-field">
                <span>Тип объекта</span>
                <select
                  onChange={(event) =>
                    setForm((current) => ({ ...current, typeId: event.target.value }))
                  }
                  required
                  value={form.typeId}
                >
                  {(directories?.orgUnitTypes ?? []).map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                <span>Организация</span>
                <select
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      organizationId: event.target.value
                    }))
                  }
                  required
                  value={form.organizationId}
                >
                  {(directories?.organizations ?? []).map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.title}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="form-field">
              <span>Родительское подразделение</span>
              <select
                onChange={(event) =>
                  setForm((current) => ({ ...current, parentId: event.target.value }))
                }
                value={form.parentId}
              >
                <option value="">— верхний уровень —</option>
                {units
                  .filter((unit) => unit.id !== editingUnit?.id)
                  .map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.title}
                    </option>
                  ))}
              </select>
            </label>
            <div className="form-grid form-grid-two">
              <label className="form-field">
                <span>Страна</span>
                <select
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      countryId: event.target.value,
                      cityId: ""
                    }))
                  }
                  value={form.countryId}
                >
                  <option value="">Не указана</option>
                  {(directories?.countries ?? []).map((country) => (
                    <option key={country.id} value={country.id}>
                      {country.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                <span>Город</span>
                <select
                  disabled={!form.countryId}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, cityId: event.target.value }))
                  }
                  value={form.cityId}
                >
                  <option value="">Не указан</option>
                  {citiesForCountry(form.countryId).map((city) => (
                    <option key={city.id} value={city.id}>
                      {city.title}
                    </option>
                  ))}
                </select>
              </label>
            </div>
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
