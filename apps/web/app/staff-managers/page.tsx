"use client";

import { Plus, UserMinus } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ApiError, apiRequest } from "../lib/api";
import { Modal } from "../ui/modal";

type NamedRef = { id: string; title: string };

type ManagerAssignment = {
  id: string;
  startsAt: string;
  endsAt: string | null;
  staff: { id: string; displayName: string };
  managerType: NamedRef;
  orgUnit: NamedRef & { type?: { title: string } };
};

type OrgUnit = { id: string; title: string };
type Employee = { id: string; displayName: string };
type Directories = { managerTypes: NamedRef[] };

const emptyForm = {
  orgUnitId: "",
  staffId: "",
  managerTypeId: ""
};

function managerErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === "org_unit_reference_not_found") {
      return "Проверьте подразделение, сотрудника и тип руководителя.";
    }
    if (error.status === 401 || error.status === 403) {
      return "Недостаточно прав или сессия завершилась.";
    }
  }
  return "Не удалось сохранить назначение. Попробуйте ещё раз.";
}

export default function StaffManagersPage() {
  const [managers, setManagers] = useState<ManagerAssignment[]>([]);
  const [orgUnits, setOrgUnits] = useState<OrgUnit[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [directories, setDirectories] = useState<Directories | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [managersResponse, orgUnitsResponse, employeesResponse, directoriesResponse] =
        await Promise.all([
          apiRequest<{ managers: ManagerAssignment[] }>("/v1/owner/org-unit-managers"),
          apiRequest<{ orgUnits: OrgUnit[] }>("/v1/owner/org-units"),
          apiRequest<{ employees: Employee[] }>("/v1/owner/employees"),
          apiRequest<Directories>("/v1/owner/directories")
        ]);
      setManagers(managersResponse.managers);
      setOrgUnits(orgUnitsResponse.orgUnits);
      setEmployees(employeesResponse.employees);
      setDirectories(directoriesResponse);
    } catch {
      setLoadError("Не удалось загрузить руководителей.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreateForm() {
    setForm({
      orgUnitId: orgUnits[0]?.id ?? "",
      staffId: employees[0]?.id ?? "",
      managerTypeId: directories?.managerTypes[0]?.id ?? ""
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
      await apiRequest(`/v1/owner/org-units/${form.orgUnitId}/managers`, {
        method: "POST",
        body: JSON.stringify({
          staffId: form.staffId,
          managerTypeId: form.managerTypeId
        })
      });
      setIsFormOpen(false);
      setNotice("Руководитель назначен.");
      await load();
    } catch (error) {
      setFormError(managerErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function endAssignment(assignment: ManagerAssignment) {
    setNotice(null);
    try {
      await apiRequest(`/v1/owner/org-unit-managers/${assignment.id}`, {
        method: "PATCH",
        body: JSON.stringify({})
      });
      setNotice("Назначение завершено.");
      await load();
    } catch (error) {
      setLoadError(managerErrorMessage(error));
    }
  }

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Только для владельца</p>
          <h1>Руководители</h1>
          <p className="page-description">
            Кто руководит каждым объектом оргструктуры и в какой роли.
          </p>
        </div>
        <button
          className="primary-button"
          disabled={!orgUnits.length || !employees.length || !directories?.managerTypes.length}
          onClick={openCreateForm}
          type="button"
        >
          <Plus aria-hidden="true" size={18} />
          Назначить руководителя
        </button>
      </header>

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
        ) : managers.length === 0 ? (
          <div className="empty-table-state">
            <div>
              <strong>Пока нет назначений</strong>
              <span>Назначьте руководителя кнопкой выше.</span>
            </div>
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Руководитель</th>
                  <th>Тип объекта</th>
                  <th>Объект руководства</th>
                  <th>Тип руководителя</th>
                  <th aria-label="Действия" />
                </tr>
              </thead>
              <tbody>
                {managers.map((assignment) => (
                  <tr key={assignment.id}>
                    <td>{assignment.staff.displayName}</td>
                    <td>{assignment.orgUnit.type?.title ?? "—"}</td>
                    <td>{assignment.orgUnit.title}</td>
                    <td>{assignment.managerType.title}</td>
                    <td className="action-cell">
                      <button
                        aria-label={`Завершить назначение ${assignment.staff.displayName}`}
                        className="icon-button table-action"
                        onClick={() => void endAssignment(assignment)}
                        title="Завершить назначение"
                        type="button"
                      >
                        <UserMinus aria-hidden="true" size={15} />
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
        <Modal onClose={() => setIsFormOpen(false)} title="Назначить руководителя">
          <form className="modal-form" onSubmit={submitForm}>
            <label className="form-field">
              <span>Объект руководства</span>
              <select
                onChange={(event) =>
                  setForm((current) => ({ ...current, orgUnitId: event.target.value }))
                }
                required
                value={form.orgUnitId}
              >
                {orgUnits.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field">
              <span>Руководитель</span>
              <select
                onChange={(event) =>
                  setForm((current) => ({ ...current, staffId: event.target.value }))
                }
                required
                value={form.staffId}
              >
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field">
              <span>Тип руководителя</span>
              <select
                onChange={(event) =>
                  setForm((current) => ({ ...current, managerTypeId: event.target.value }))
                }
                required
                value={form.managerTypeId}
              >
                {(directories?.managerTypes ?? []).map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.title}
                  </option>
                ))}
              </select>
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
                {isSaving ? "Сохраняем…" : "Назначить"}
              </button>
            </footer>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
