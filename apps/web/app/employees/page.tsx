"use client";

import {
  Award,
  BookOpenCheck,
  BriefcaseBusiness,
  FileClock,
  FilePlus2,
  FolderOpen,
  GraduationCap,
  History,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  UserMinus,
  UserPlus,
  UsersRound
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  useCallback,
  useEffect,
  useState,
  type FormEvent
} from "react";
import { ApiError, apiRequest } from "../lib/api";
import { Modal } from "../ui/modal";

type EmploymentStatus = "active" | "probation" | "leave" | "dismissed";
type EmploymentType = "owner" | "full_time" | "part_time" | "contractor" | "intern";
type UserRole = "owner" | "admin" | "master";
type TrainingStatus = "planned" | "in_progress" | "completed" | "canceled";
type ServiceOption = { id: string; titleRu: string; isActive: boolean };

type Employee = {
  id: string;
  displayName: string;
  legalName: string | null;
  position: string | null;
  bio: string | null;
  employmentStatus: EmploymentStatus;
  employmentType: EmploymentType;
  hiredAt: string | null;
  probationEndsAt: string | null;
  dismissedAt: string | null;
  dateOfBirth: string | null;
  workPhone: string | null;
  personalEmail: string | null;
  address: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  isBookable: boolean;
  user: {
    id: string;
    role: UserRole;
    email: string | null;
    phone: string | null;
    isActive: boolean;
    accountReady: boolean;
  };
  services: Array<{ service: ServiceOption }>;
  _count: {
    appointments: number;
    employeeNotes: number;
    trainings: number;
    documents: number;
  };
};

type EmployeeNote = {
  id: string;
  category: "general" | "performance" | "recognition" | "incident" | "hr";
  title: string | null;
  body: string;
  eventDate: string | null;
  createdAt: string;
  createdBy: { staffProfile: { displayName: string } | null } | null;
};
type EmployeeTraining = {
  id: string;
  title: string;
  provider: string | null;
  status: TrainingStatus;
  startsAt: string | null;
  endsAt: string | null;
  completedAt: string | null;
  costMinor: number | null;
  currency: "RUB" | "EUR" | "USD" | null;
  certificateUrl: string | null;
  notes: string | null;
};
type EmployeeDocument = {
  id: string;
  type: "employment_contract" | "nda" | "consent" | "medical_book" | "certificate" | "other";
  title: string;
  issuedAt: string | null;
  expiresAt: string | null;
  notes: string | null;
};
type EmployeeEvent = {
  id: string;
  type: string;
  occurredAt: string;
  reason: string | null;
  details: Record<string, unknown> | null;
  actor: { staffProfile: { displayName: string } | null } | null;
};
type EmployeeDetail = Employee & {
  employeeNotes: EmployeeNote[];
  trainings: EmployeeTraining[];
  documents: EmployeeDocument[];
  employeeEvents: EmployeeEvent[];
};

type EmployeeForm = {
  displayName: string;
  legalName: string;
  email: string;
  phone: string;
  role: UserRole;
  position: string;
  employmentStatus: Exclude<EmploymentStatus, "dismissed">;
  employmentType: EmploymentType;
  hiredAt: string;
  probationEndsAt: string;
  dateOfBirth: string;
  workPhone: string;
  personalEmail: string;
  address: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  bio: string;
  isBookable: boolean;
  serviceIds: string[];
};

type Metrics = {
  active: number;
  probation: number;
  leave: number;
  dismissed: number;
  pendingTrainings: number;
};
type DetailTab = "profile" | "notes" | "training" | "documents" | "history";

const statusMeta: Record<EmploymentStatus, { label: string; tone: string }> = {
  active: { label: "Работает", tone: "success" },
  probation: { label: "Испытательный срок", tone: "warning" },
  leave: { label: "Отпуск / отсутствие", tone: "info" },
  dismissed: { label: "Уволен", tone: "neutral" }
};
const employmentTypeLabels: Record<EmploymentType, string> = {
  owner: "Владелец",
  full_time: "Полная занятость",
  part_time: "Частичная занятость",
  contractor: "Подрядчик",
  intern: "Стажёр"
};
const roleLabels: Record<UserRole, string> = {
  owner: "Владелец",
  admin: "Администратор",
  master: "Мастер"
};
const noteLabels: Record<EmployeeNote["category"], string> = {
  general: "Общее",
  performance: "Результаты",
  recognition: "Благодарность",
  incident: "Инцидент",
  hr: "Кадровое"
};
const trainingLabels: Record<TrainingStatus, string> = {
  planned: "Запланировано",
  in_progress: "Идёт обучение",
  completed: "Завершено",
  canceled: "Отменено"
};
const documentLabels: Record<EmployeeDocument["type"], string> = {
  employment_contract: "Трудовой договор",
  nda: "Соглашение о конфиденциальности",
  consent: "Согласие",
  medical_book: "Медицинская книжка",
  certificate: "Сертификат",
  other: "Другое"
};
const eventLabels: Record<string, string> = {
  hired: "Принят на работу",
  status_changed: "Изменён кадровый статус",
  leave_started: "Начато отсутствие",
  leave_ended: "Возвращён из отсутствия",
  dismissed: "Уволен",
  rehired: "Повторно принят",
  role_changed: "Изменена роль доступа",
  profile_updated: "Обновлено личное дело"
};

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC"
});
const today = new Date().toISOString().slice(0, 10);

function emptyEmployeeForm(): EmployeeForm {
  return {
    displayName: "",
    legalName: "",
    email: "",
    phone: "",
    role: "master",
    position: "Мастер маникюра",
    employmentStatus: "active",
    employmentType: "full_time",
    hiredAt: today,
    probationEndsAt: "",
    dateOfBirth: "",
    workPhone: "",
    personalEmail: "",
    address: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    bio: "",
    isBookable: true,
    serviceIds: []
  };
}

function optionalValue(value: string) {
  return value.trim() || null;
}

function dateInput(value: string | null) {
  return value?.slice(0, 10) ?? "";
}

function formatDate(value: string | null) {
  return value ? dateFormatter.format(new Date(value)) : "Не указано";
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function employeeErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === "employee_contact_already_exists") {
      return "Сотрудник с такой почтой или телефоном уже существует.";
    }
    if (error.code === "owner_employee_protected") {
      return "Учётную запись владельца нельзя уволить или изменить её роль.";
    }
    if (error.status === 401 || error.status === 403) {
      return "Этот раздел доступен только владельцу.";
    }
  }
  return "Не удалось сохранить данные. Проверьте поля и попробуйте снова.";
}

function employeeToForm(employee: Employee): EmployeeForm {
  return {
    displayName: employee.displayName,
    legalName: employee.legalName ?? "",
    email: employee.user.email ?? "",
    phone: employee.user.phone ?? "",
    role: employee.user.role,
    position: employee.position ?? "",
    employmentStatus:
      employee.employmentStatus === "dismissed" ? "active" : employee.employmentStatus,
    employmentType: employee.employmentType,
    hiredAt: dateInput(employee.hiredAt),
    probationEndsAt: dateInput(employee.probationEndsAt),
    dateOfBirth: dateInput(employee.dateOfBirth),
    workPhone: employee.workPhone ?? "",
    personalEmail: employee.personalEmail ?? "",
    address: employee.address ?? "",
    emergencyContactName: employee.emergencyContactName ?? "",
    emergencyContactPhone: employee.emergencyContactPhone ?? "",
    bio: employee.bio ?? "",
    isBookable: employee.isBookable,
    serviceIds: employee.services.map(({ service }) => service.id)
  };
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [metrics, setMetrics] = useState<Metrics>({
    active: 0,
    probation: 0,
    leave: 0,
    dismissed: 0,
    pendingTrainings: 0
  });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [employeeForm, setEmployeeForm] = useState<EmployeeForm>(() =>
    emptyEmployeeForm()
  );
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeDetail | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState<DetailTab>("profile");
  const [actionTarget, setActionTarget] = useState<{
    employee: Employee;
    kind: "dismiss" | "rehire";
  } | null>(null);
  const [actionDate, setActionDate] = useState(today);
  const [actionReason, setActionReason] = useState("");
  const [noteForm, setNoteForm] = useState({
    category: "general" as EmployeeNote["category"],
    title: "",
    body: "",
    eventDate: today
  });
  const [trainingForm, setTrainingForm] = useState({
    title: "",
    provider: "",
    status: "planned" as TrainingStatus,
    startsAt: today,
    endsAt: "",
    cost: "",
    currency: "RUB" as "RUB" | "EUR" | "USD",
    certificateUrl: "",
    notes: ""
  });
  const [documentForm, setDocumentForm] = useState({
    type: "employment_contract" as EmployeeDocument["type"],
    title: "",
    issuedAt: today,
    expiresAt: "",
    notes: ""
  });

  const loadEmployees = useCallback(async (query: string, status: string) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams({ status });
      if (query.trim()) params.set("search", query.trim());
      const response = await apiRequest<{
        employees: Employee[];
        services: ServiceOption[];
        metrics: Metrics;
      }>(`/v1/owner/employees?${params}`);
      setEmployees(response.employees);
      setServices(response.services);
      setMetrics(response.metrics);
    } catch (error) {
      setLoadError(employeeErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadEmployees(search, statusFilter);
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [loadEmployees, search, statusFilter]);

  const loadEmployeeDetail = useCallback(async (employeeId: string) => {
    setIsDetailLoading(true);
    setFormError(null);
    try {
      const response = await apiRequest<{ employee: EmployeeDetail }>(
        `/v1/owner/employees/${employeeId}`
      );
      setSelectedEmployee(response.employee);
    } catch (error) {
      setFormError(employeeErrorMessage(error));
    } finally {
      setIsDetailLoading(false);
    }
  }, []);

  function openCreateForm() {
    setEditingEmployee(null);
    setEmployeeForm(emptyEmployeeForm());
    setFormError(null);
    setIsFormOpen(true);
  }

  function openEditForm(employee: Employee) {
    setSelectedEmployee(null);
    setEditingEmployee(employee);
    setEmployeeForm(employeeToForm(employee));
    setFormError(null);
    setIsFormOpen(true);
  }

  function updateEmployeeForm<Key extends keyof EmployeeForm>(
    key: Key,
    value: EmployeeForm[Key]
  ) {
    setEmployeeForm((current) => ({ ...current, [key]: value }));
  }

  async function submitEmployee(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setFormError(null);
    setNotice(null);
    const isOwner = editingEmployee?.user.role === "owner";
    const payload = {
      displayName: employeeForm.displayName.trim(),
      legalName: optionalValue(employeeForm.legalName),
      email: optionalValue(employeeForm.email),
      phone: optionalValue(employeeForm.phone),
      ...(!isOwner ? { role: employeeForm.role } : {}),
      position: optionalValue(employeeForm.position),
      employmentStatus: employeeForm.employmentStatus,
      ...(!isOwner ? { employmentType: employeeForm.employmentType } : {}),
      hiredAt: optionalValue(employeeForm.hiredAt),
      probationEndsAt: optionalValue(employeeForm.probationEndsAt),
      dateOfBirth: optionalValue(employeeForm.dateOfBirth),
      workPhone: optionalValue(employeeForm.workPhone),
      personalEmail: optionalValue(employeeForm.personalEmail),
      address: optionalValue(employeeForm.address),
      emergencyContactName: optionalValue(employeeForm.emergencyContactName),
      emergencyContactPhone: optionalValue(employeeForm.emergencyContactPhone),
      bio: optionalValue(employeeForm.bio),
      isBookable: employeeForm.isBookable,
      serviceIds: employeeForm.serviceIds
    };

    try {
      await apiRequest(
        editingEmployee
          ? `/v1/owner/employees/${editingEmployee.id}`
          : "/v1/owner/employees",
        {
          method: editingEmployee ? "PATCH" : "POST",
          body: JSON.stringify(payload)
        }
      );
      setIsFormOpen(false);
      setNotice(editingEmployee ? "Личное дело обновлено." : "Сотрудник добавлен.");
      await loadEmployees(search, statusFilter);
    } catch (error) {
      setFormError(employeeErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function refreshDetail() {
    if (selectedEmployee) await loadEmployeeDetail(selectedEmployee.id);
    await loadEmployees(search, statusFilter);
  }

  async function submitNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedEmployee) return;
    setIsSaving(true);
    setFormError(null);
    try {
      await apiRequest(`/v1/owner/employees/${selectedEmployee.id}/notes`, {
        method: "POST",
        body: JSON.stringify({
          ...noteForm,
          title: optionalValue(noteForm.title),
          eventDate: optionalValue(noteForm.eventDate)
        })
      });
      setNoteForm({ category: "general", title: "", body: "", eventDate: today });
      await refreshDetail();
    } catch (error) {
      setFormError(employeeErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function submitTraining(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedEmployee) return;
    setIsSaving(true);
    setFormError(null);
    const parsedCost = trainingForm.cost
      ? Math.round(Number(trainingForm.cost.replace(",", ".")) * 100)
      : null;
    if (parsedCost !== null && (!Number.isFinite(parsedCost) || parsedCost < 0)) {
      setFormError("Проверьте стоимость обучения.");
      setIsSaving(false);
      return;
    }
    try {
      await apiRequest(`/v1/owner/employees/${selectedEmployee.id}/trainings`, {
        method: "POST",
        body: JSON.stringify({
          title: trainingForm.title.trim(),
          provider: optionalValue(trainingForm.provider),
          status: trainingForm.status,
          startsAt: optionalValue(trainingForm.startsAt),
          endsAt: optionalValue(trainingForm.endsAt),
          completedAt: trainingForm.status === "completed" ? today : null,
          costMinor: parsedCost,
          currency: parsedCost === null ? null : trainingForm.currency,
          certificateUrl: optionalValue(trainingForm.certificateUrl),
          notes: optionalValue(trainingForm.notes)
        })
      });
      setTrainingForm({
        title: "",
        provider: "",
        status: "planned",
        startsAt: today,
        endsAt: "",
        cost: "",
        currency: "RUB",
        certificateUrl: "",
        notes: ""
      });
      await refreshDetail();
    } catch (error) {
      setFormError(employeeErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function completeTraining(training: EmployeeTraining) {
    if (!selectedEmployee) return;
    setIsSaving(true);
    try {
      await apiRequest(
        `/v1/owner/employees/${selectedEmployee.id}/trainings/${training.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({ status: "completed", completedAt: today })
        }
      );
      await refreshDetail();
    } catch (error) {
      setFormError(employeeErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function submitDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedEmployee) return;
    setIsSaving(true);
    setFormError(null);
    try {
      await apiRequest(`/v1/owner/employees/${selectedEmployee.id}/documents`, {
        method: "POST",
        body: JSON.stringify({
          ...documentForm,
          title: documentForm.title.trim(),
          issuedAt: optionalValue(documentForm.issuedAt),
          expiresAt: optionalValue(documentForm.expiresAt),
          notes: optionalValue(documentForm.notes)
        })
      });
      setDocumentForm({
        type: "employment_contract",
        title: "",
        issuedAt: today,
        expiresAt: "",
        notes: ""
      });
      await refreshDetail();
    } catch (error) {
      setFormError(employeeErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteChild(kind: "notes" | "trainings" | "documents", childId: string) {
    if (!selectedEmployee) return;
    setIsSaving(true);
    setFormError(null);
    try {
      await apiRequest(
        `/v1/owner/employees/${selectedEmployee.id}/${kind}/${childId}`,
        { method: "DELETE" }
      );
      await refreshDetail();
    } catch (error) {
      setFormError(employeeErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  function openEmployeeAction(employee: Employee, kind: "dismiss" | "rehire") {
    setSelectedEmployee(null);
    setActionTarget({ employee, kind });
    setActionDate(today);
    setActionReason("");
    setFormError(null);
  }

  async function submitEmployeeAction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!actionTarget) return;
    setIsSaving(true);
    setFormError(null);
    try {
      await apiRequest(
        `/v1/owner/employees/${actionTarget.employee.id}/${
          actionTarget.kind === "dismiss" ? "dismiss" : "rehire"
        }`,
        {
          method: "POST",
          body: JSON.stringify(
            actionTarget.kind === "dismiss"
              ? { dismissedAt: actionDate, reason: actionReason.trim() }
              : {
                  hiredAt: actionDate,
                  employmentStatus: "active",
                  reason: optionalValue(actionReason),
                  isBookable: true
                }
          )
        }
      );
      setNotice(
        actionTarget.kind === "dismiss"
          ? "Сотрудник уволен, доступ к CRM закрыт."
          : "Сотрудник повторно принят."
      );
      setActionTarget(null);
      await loadEmployees(search, statusFilter);
    } catch (error) {
      setFormError(employeeErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Только для владельца</p>
          <h1>Сотрудники</h1>
          <p className="page-description">
            Команда, личные дела, кадровые статусы, документы и обучение.
          </p>
        </div>
        <button className="primary-button" onClick={openCreateForm} type="button">
          <UserPlus aria-hidden="true" size={18} />
          Добавить сотрудника
        </button>
      </header>

      {notice ? (
        <p className="feedback feedback-success" role="status">
          {notice}
        </p>
      ) : null}

      <section className="employee-metric-grid" aria-label="Показатели команды">
        {(
          [
            { label: "Работают", value: metrics.active, Icon: UsersRound },
            { label: "Испытательный срок", value: metrics.probation, Icon: ShieldCheck },
            { label: "Отсутствуют", value: metrics.leave, Icon: FileClock },
            { label: "Обучение", value: metrics.pendingTrainings, Icon: GraduationCap },
            { label: "Уволены", value: metrics.dismissed, Icon: UserMinus }
          ] satisfies Array<{ label: string; value: number; Icon: LucideIcon }>
        ).map(({ label, value, Icon }) => (
          <article className="employee-metric" key={label}>
            <Icon aria-hidden="true" size={18} />
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </section>

      <section className="panel table-panel">
        <div className="table-toolbar employee-toolbar">
          <label className="search-field">
            <Search aria-hidden="true" size={17} />
            <span className="sr-only">Найти сотрудника</span>
            <input
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Имя, должность или почта"
              type="search"
              value={search}
            />
          </label>
          <label className="employee-filter">
            <span className="sr-only">Кадровый статус</span>
            <select
              onChange={(event) => setStatusFilter(event.target.value)}
              value={statusFilter}
            >
              <option value="all">Все статусы</option>
              <option value="active">Работают</option>
              <option value="probation">Испытательный срок</option>
              <option value="leave">Отсутствуют</option>
              <option value="dismissed">Уволены</option>
            </select>
          </label>
          <span className="muted-label">
            {isLoading ? "Загрузка…" : `${employees.length} в списке`}
          </span>
        </div>

        {loadError ? (
          <div className="table-message table-message-error" role="alert">
            <p>{loadError}</p>
            <button
              className="secondary-button"
              onClick={() => void loadEmployees(search, statusFilter)}
              type="button"
            >
              Повторить
            </button>
          </div>
        ) : !isLoading && employees.length === 0 ? (
          <div className="empty-table-state">
            <BriefcaseBusiness aria-hidden="true" size={24} />
            <div>
              <strong>Сотрудники не найдены</strong>
              <span>Измените фильтр или добавьте нового сотрудника.</span>
            </div>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="employee-table">
              <thead>
                <tr>
                  <th>Сотрудник</th>
                  <th>Должность</th>
                  <th>Статус</th>
                  <th>Занятость</th>
                  <th>CRM</th>
                  <th>Личное дело</th>
                  <th aria-label="Действия" />
                </tr>
              </thead>
              <tbody>
                {employees.map((employee) => {
                  const meta = statusMeta[employee.employmentStatus];
                  return (
                    <tr key={employee.id}>
                      <td>
                        <div className="employee-name-cell">
                          <span className="employee-avatar">{initials(employee.displayName)}</span>
                          <span>
                            <strong>{employee.displayName}</strong>
                            <small>{employee.user.email ?? employee.user.phone ?? "Без контакта"}</small>
                          </span>
                        </div>
                      </td>
                      <td>
                        <span>{employee.position ?? "Не указана"}</span>
                        <small>{roleLabels[employee.user.role]}</small>
                      </td>
                      <td>
                        <span className={`status status-${meta.tone}`}>{meta.label}</span>
                      </td>
                      <td>{employmentTypeLabels[employee.employmentType]}</td>
                      <td>
                        <span
                          className={`status ${
                            employee.user.isActive ? "status-success" : "status-neutral"
                          }`}
                        >
                          {employee.user.isActive
                            ? employee.user.accountReady
                              ? "Доступ есть"
                              : "Без пароля"
                            : "Закрыт"}
                        </span>
                      </td>
                      <td>
                        <strong>{employee._count.employeeNotes + employee._count.trainings + employee._count.documents}</strong>
                        <small>записей</small>
                      </td>
                      <td className="action-cell">
                        <button
                          aria-label={`Открыть личное дело ${employee.displayName}`}
                          className="icon-button table-action"
                          onClick={() => {
                            setDetailTab("profile");
                            void loadEmployeeDetail(employee.id);
                          }}
                          title="Открыть личное дело"
                          type="button"
                        >
                          <FolderOpen aria-hidden="true" size={16} />
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
          description="Контакты, роль, занятость и данные личного дела."
          onClose={() => setIsFormOpen(false)}
          size="wide"
          title={editingEmployee ? "Изменить сотрудника" : "Новый сотрудник"}
        >
          <form className="modal-form employee-form" onSubmit={(event) => void submitEmployee(event)}>
            <fieldset className="hr-fieldset">
              <legend>Основные данные</legend>
              <div className="form-grid form-grid-two">
                <label className="form-field">
                  <span>Отображаемое имя</span>
                  <input
                    autoFocus
                    maxLength={120}
                    onChange={(event) => updateEmployeeForm("displayName", event.target.value)}
                    required
                    value={employeeForm.displayName}
                  />
                </label>
                <label className="form-field">
                  <span>ФИО по документам</span>
                  <input
                    maxLength={160}
                    onChange={(event) => updateEmployeeForm("legalName", event.target.value)}
                    value={employeeForm.legalName}
                  />
                </label>
                <label className="form-field">
                  <span>Должность</span>
                  <input
                    maxLength={120}
                    onChange={(event) => updateEmployeeForm("position", event.target.value)}
                    value={employeeForm.position}
                  />
                </label>
                <label className="form-field">
                  <span>Дата рождения</span>
                  <input
                    onChange={(event) => updateEmployeeForm("dateOfBirth", event.target.value)}
                    type="date"
                    value={employeeForm.dateOfBirth}
                  />
                </label>
              </div>
            </fieldset>

            <fieldset className="hr-fieldset">
              <legend>Контакты и доступ</legend>
              <div className="form-grid form-grid-two">
                <label className="form-field">
                  <span>Почта для входа</span>
                  <input
                    maxLength={200}
                    onChange={(event) => updateEmployeeForm("email", event.target.value)}
                    type="email"
                    value={employeeForm.email}
                  />
                </label>
                <label className="form-field">
                  <span>Телефон аккаунта</span>
                  <input
                    maxLength={30}
                    onChange={(event) => updateEmployeeForm("phone", event.target.value)}
                    value={employeeForm.phone}
                  />
                </label>
                <label className="form-field">
                  <span>Рабочий телефон</span>
                  <input
                    maxLength={30}
                    onChange={(event) => updateEmployeeForm("workPhone", event.target.value)}
                    value={employeeForm.workPhone}
                  />
                </label>
                <label className="form-field">
                  <span>Личная почта</span>
                  <input
                    maxLength={200}
                    onChange={(event) => updateEmployeeForm("personalEmail", event.target.value)}
                    type="email"
                    value={employeeForm.personalEmail}
                  />
                </label>
                <label className="form-field">
                  <span>Роль в CRM</span>
                  <select
                    disabled={editingEmployee?.user.role === "owner"}
                    onChange={(event) =>
                      updateEmployeeForm("role", event.target.value as UserRole)
                    }
                    value={employeeForm.role}
                  >
                    {editingEmployee?.user.role === "owner" ? (
                      <option value="owner">Владелец</option>
                    ) : null}
                    <option value="master">Мастер</option>
                    <option value="admin">Администратор</option>
                  </select>
                </label>
                <label className="checkbox-field employee-bookable-field">
                  <input
                    checked={employeeForm.isBookable}
                    onChange={(event) => updateEmployeeForm("isBookable", event.target.checked)}
                    type="checkbox"
                  />
                  <span>
                    <strong>Доступен для записи</strong>
                    <small>Клиенты смогут выбрать сотрудника.</small>
                  </span>
                </label>
              </div>
            </fieldset>

            <fieldset className="hr-fieldset">
              <legend>Кадровый учёт</legend>
              <div className="form-grid form-grid-three">
                <label className="form-field">
                  <span>Статус</span>
                  <select
                    onChange={(event) =>
                      updateEmployeeForm(
                        "employmentStatus",
                        event.target.value as EmployeeForm["employmentStatus"]
                      )
                    }
                    value={employeeForm.employmentStatus}
                  >
                    <option value="active">Работает</option>
                    <option value="probation">Испытательный срок</option>
                    <option value="leave">Отпуск / отсутствие</option>
                  </select>
                </label>
                <label className="form-field">
                  <span>Тип занятости</span>
                  <select
                    disabled={editingEmployee?.user.role === "owner"}
                    onChange={(event) =>
                      updateEmployeeForm(
                        "employmentType",
                        event.target.value as EmploymentType
                      )
                    }
                    value={employeeForm.employmentType}
                  >
                    {editingEmployee?.user.role === "owner" ? (
                      <option value="owner">Владелец</option>
                    ) : null}
                    <option value="full_time">Полная занятость</option>
                    <option value="part_time">Частичная занятость</option>
                    <option value="contractor">Подрядчик</option>
                    <option value="intern">Стажёр</option>
                  </select>
                </label>
                <label className="form-field">
                  <span>Дата приёма</span>
                  <input
                    onChange={(event) => updateEmployeeForm("hiredAt", event.target.value)}
                    type="date"
                    value={employeeForm.hiredAt}
                  />
                </label>
                <label className="form-field">
                  <span>Испытательный срок до</span>
                  <input
                    onChange={(event) =>
                      updateEmployeeForm("probationEndsAt", event.target.value)
                    }
                    type="date"
                    value={employeeForm.probationEndsAt}
                  />
                </label>
                <label className="form-field form-field-span-two">
                  <span>Адрес</span>
                  <input
                    maxLength={500}
                    onChange={(event) => updateEmployeeForm("address", event.target.value)}
                    value={employeeForm.address}
                  />
                </label>
                <label className="form-field">
                  <span>Экстренный контакт</span>
                  <input
                    maxLength={160}
                    onChange={(event) =>
                      updateEmployeeForm("emergencyContactName", event.target.value)
                    }
                    value={employeeForm.emergencyContactName}
                  />
                </label>
                <label className="form-field">
                  <span>Телефон экстренного контакта</span>
                  <input
                    maxLength={30}
                    onChange={(event) =>
                      updateEmployeeForm("emergencyContactPhone", event.target.value)
                    }
                    value={employeeForm.emergencyContactPhone}
                  />
                </label>
                <label className="form-field form-field-span-three">
                  <span>Служебная информация</span>
                  <textarea
                    maxLength={2000}
                    onChange={(event) => updateEmployeeForm("bio", event.target.value)}
                    value={employeeForm.bio}
                  />
                </label>
              </div>
            </fieldset>

            <fieldset className="hr-fieldset">
              <legend>Услуги сотрудника</legend>
              <div className="service-checkbox-grid">
                {services.map((service) => (
                  <label className="service-checkbox" key={service.id}>
                    <input
                      checked={employeeForm.serviceIds.includes(service.id)}
                      onChange={(event) =>
                        updateEmployeeForm(
                          "serviceIds",
                          event.target.checked
                            ? [...employeeForm.serviceIds, service.id]
                            : employeeForm.serviceIds.filter((id) => id !== service.id)
                        )
                      }
                      type="checkbox"
                    />
                    <span>{service.titleRu}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            {formError ? (
              <p className="feedback feedback-error" role="alert">
                {formError}
              </p>
            ) : null}
            <footer className="modal-actions">
              <button className="secondary-button" onClick={() => setIsFormOpen(false)} type="button">
                Отмена
              </button>
              <button className="primary-button" disabled={isSaving} type="submit">
                {isSaving ? "Сохраняем…" : "Сохранить"}
              </button>
            </footer>
          </form>
        </Modal>
      ) : null}

      {selectedEmployee || isDetailLoading ? (
        <Modal
          description={
            selectedEmployee
              ? `${selectedEmployee.position ?? "Должность не указана"} · ${statusMeta[selectedEmployee.employmentStatus].label}`
              : "Загружаем личное дело"
          }
          onClose={() => setSelectedEmployee(null)}
          size="wide"
          title={selectedEmployee?.displayName ?? "Личное дело"}
        >
          {selectedEmployee ? (
            <div className="employee-detail-shell">
              <div className="employee-profile-summary">
                <span className="employee-profile-avatar">
                  {initials(selectedEmployee.displayName)}
                </span>
                <div>
                  <strong>{selectedEmployee.legalName ?? selectedEmployee.displayName}</strong>
                  <span>
                    {roleLabels[selectedEmployee.user.role]} · {employmentTypeLabels[selectedEmployee.employmentType]}
                  </span>
                </div>
                <div className="employee-profile-actions">
                  <button
                    className="secondary-button button-with-icon"
                    onClick={() => openEditForm(selectedEmployee)}
                    type="button"
                  >
                    <Pencil aria-hidden="true" size={15} />
                    Изменить
                  </button>
                  {selectedEmployee.user.role !== "owner" ? (
                    selectedEmployee.employmentStatus === "dismissed" ? (
                      <button
                        className="secondary-button button-with-icon"
                        onClick={() => openEmployeeAction(selectedEmployee, "rehire")}
                        type="button"
                      >
                        <RotateCcw aria-hidden="true" size={15} />
                        Принять снова
                      </button>
                    ) : (
                      <button
                        className="danger-outline-button button-with-icon"
                        onClick={() => openEmployeeAction(selectedEmployee, "dismiss")}
                        type="button"
                      >
                        <UserMinus aria-hidden="true" size={15} />
                        Уволить
                      </button>
                    )
                  ) : null}
                </div>
              </div>

              <div className="employee-tabs" role="tablist" aria-label="Разделы личного дела">
                {(
                  [
                    { tab: "profile", label: "Профиль", Icon: BriefcaseBusiness },
                    { tab: "notes", label: "Заметки", Icon: Award },
                    { tab: "training", label: "Обучение", Icon: GraduationCap },
                    { tab: "documents", label: "Документы", Icon: FilePlus2 },
                    { tab: "history", label: "История", Icon: History }
                  ] satisfies Array<{ tab: DetailTab; label: string; Icon: LucideIcon }>
                ).map(({ tab, label, Icon }) => (
                  <button
                    aria-selected={detailTab === tab}
                    className={detailTab === tab ? "is-active" : ""}
                    key={tab}
                    onClick={() => {
                      setDetailTab(tab);
                      setFormError(null);
                    }}
                    role="tab"
                    type="button"
                  >
                    <Icon aria-hidden="true" size={15} />
                    {label}
                  </button>
                ))}
              </div>

              <div className="employee-tab-content">
                {formError ? (
                  <p className="feedback feedback-error" role="alert">
                    {formError}
                  </p>
                ) : null}

                {detailTab === "profile" ? (
                  <div className="employee-profile-grid">
                    {[
                      ["Кадровый статус", statusMeta[selectedEmployee.employmentStatus].label],
                      ["Дата приёма", formatDate(selectedEmployee.hiredAt)],
                      ["Испытательный срок", formatDate(selectedEmployee.probationEndsAt)],
                      ["Дата увольнения", formatDate(selectedEmployee.dismissedAt)],
                      ["Дата рождения", formatDate(selectedEmployee.dateOfBirth)],
                      ["Почта CRM", selectedEmployee.user.email ?? "Не указана"],
                      ["Телефон аккаунта", selectedEmployee.user.phone ?? "Не указан"],
                      ["Рабочий телефон", selectedEmployee.workPhone ?? "Не указан"],
                      ["Личная почта", selectedEmployee.personalEmail ?? "Не указана"],
                      ["Адрес", selectedEmployee.address ?? "Не указан"],
                      ["Экстренный контакт", selectedEmployee.emergencyContactName ?? "Не указан"],
                      ["Телефон контакта", selectedEmployee.emergencyContactPhone ?? "Не указан"]
                    ].map(([label, value]) => (
                      <div key={label}>
                        <span>{label}</span>
                        <strong>{value}</strong>
                      </div>
                    ))}
                    <div className="employee-profile-wide">
                      <span>Услуги</span>
                      <strong>
                        {selectedEmployee.services.map(({ service }) => service.titleRu).join(", ") ||
                          "Не назначены"}
                      </strong>
                    </div>
                    <div className="employee-profile-wide">
                      <span>Служебная информация</span>
                      <strong>{selectedEmployee.bio ?? "Не указана"}</strong>
                    </div>
                  </div>
                ) : null}

                {detailTab === "notes" ? (
                  <div className="hr-tab-stack">
                    <form className="hr-inline-form" onSubmit={(event) => void submitNote(event)}>
                      <div className="form-grid form-grid-two">
                        <label className="form-field">
                          <span>Категория</span>
                          <select
                            onChange={(event) =>
                              setNoteForm((current) => ({
                                ...current,
                                category: event.target.value as EmployeeNote["category"]
                              }))
                            }
                            value={noteForm.category}
                          >
                            {Object.entries(noteLabels).map(([value, label]) => (
                              <option key={value} value={value}>{label}</option>
                            ))}
                          </select>
                        </label>
                        <label className="form-field">
                          <span>Дата события</span>
                          <input
                            onChange={(event) =>
                              setNoteForm((current) => ({ ...current, eventDate: event.target.value }))
                            }
                            type="date"
                            value={noteForm.eventDate}
                          />
                        </label>
                        <label className="form-field form-field-span-two">
                          <span>Заголовок</span>
                          <input
                            maxLength={160}
                            onChange={(event) =>
                              setNoteForm((current) => ({ ...current, title: event.target.value }))
                            }
                            value={noteForm.title}
                          />
                        </label>
                        <label className="form-field form-field-span-two">
                          <span>Запись в личное дело</span>
                          <textarea
                            maxLength={5000}
                            onChange={(event) =>
                              setNoteForm((current) => ({ ...current, body: event.target.value }))
                            }
                            required
                            value={noteForm.body}
                          />
                        </label>
                      </div>
                      <button className="primary-button hr-submit-button" disabled={isSaving} type="submit">
                        <Plus aria-hidden="true" size={15} />
                        Добавить запись
                      </button>
                    </form>
                    <div className="hr-record-list">
                      {selectedEmployee.employeeNotes.map((note) => (
                        <article className="hr-record" key={note.id}>
                          <div>
                            <span className="status status-neutral">{noteLabels[note.category]}</span>
                            <strong>{note.title ?? "Запись в личном деле"}</strong>
                            <p>{note.body}</p>
                            <small>
                              {formatDate(note.eventDate ?? note.createdAt)} · {note.createdBy?.staffProfile?.displayName ?? "Владелец"}
                            </small>
                          </div>
                          <button
                            aria-label="Удалить запись"
                            className="icon-button"
                            onClick={() => void deleteChild("notes", note.id)}
                            title="Удалить"
                            type="button"
                          >
                            <Trash2 aria-hidden="true" size={15} />
                          </button>
                        </article>
                      ))}
                      {!selectedEmployee.employeeNotes.length ? (
                        <div className="hr-empty-records">Записей в личном деле пока нет.</div>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {detailTab === "training" ? (
                  <div className="hr-tab-stack">
                    <form className="hr-inline-form" onSubmit={(event) => void submitTraining(event)}>
                      <div className="form-grid form-grid-three">
                        <label className="form-field form-field-span-two">
                          <span>Название обучения</span>
                          <input
                            maxLength={200}
                            onChange={(event) =>
                              setTrainingForm((current) => ({ ...current, title: event.target.value }))
                            }
                            required
                            value={trainingForm.title}
                          />
                        </label>
                        <label className="form-field">
                          <span>Статус</span>
                          <select
                            onChange={(event) =>
                              setTrainingForm((current) => ({
                                ...current,
                                status: event.target.value as TrainingStatus
                              }))
                            }
                            value={trainingForm.status}
                          >
                            {Object.entries(trainingLabels).map(([value, label]) => (
                              <option key={value} value={value}>{label}</option>
                            ))}
                          </select>
                        </label>
                        <label className="form-field">
                          <span>Организатор</span>
                          <input
                            maxLength={200}
                            onChange={(event) =>
                              setTrainingForm((current) => ({ ...current, provider: event.target.value }))
                            }
                            value={trainingForm.provider}
                          />
                        </label>
                        <label className="form-field">
                          <span>Начало</span>
                          <input
                            onChange={(event) =>
                              setTrainingForm((current) => ({ ...current, startsAt: event.target.value }))
                            }
                            type="date"
                            value={trainingForm.startsAt}
                          />
                        </label>
                        <label className="form-field">
                          <span>Окончание</span>
                          <input
                            onChange={(event) =>
                              setTrainingForm((current) => ({ ...current, endsAt: event.target.value }))
                            }
                            type="date"
                            value={trainingForm.endsAt}
                          />
                        </label>
                        <label className="form-field">
                          <span>Стоимость</span>
                          <input
                            min={0}
                            onChange={(event) =>
                              setTrainingForm((current) => ({ ...current, cost: event.target.value }))
                            }
                            step="0.01"
                            type="number"
                            value={trainingForm.cost}
                          />
                        </label>
                        <label className="form-field">
                          <span>Валюта</span>
                          <select
                            onChange={(event) =>
                              setTrainingForm((current) => ({
                                ...current,
                                currency: event.target.value as "RUB" | "EUR" | "USD"
                              }))
                            }
                            value={trainingForm.currency}
                          >
                            <option value="RUB">RUB</option>
                            <option value="EUR">EUR</option>
                            <option value="USD">USD</option>
                          </select>
                        </label>
                        <label className="form-field form-field-span-two">
                          <span>Ссылка на сертификат</span>
                          <input
                            onChange={(event) =>
                              setTrainingForm((current) => ({
                                ...current,
                                certificateUrl: event.target.value
                              }))
                            }
                            type="url"
                            value={trainingForm.certificateUrl}
                          />
                        </label>
                      </div>
                      <button className="primary-button hr-submit-button" disabled={isSaving} type="submit">
                        <BookOpenCheck aria-hidden="true" size={15} />
                        Назначить обучение
                      </button>
                    </form>
                    <div className="hr-record-list">
                      {selectedEmployee.trainings.map((training) => (
                        <article className="hr-record hr-training-record" key={training.id}>
                          <GraduationCap aria-hidden="true" size={20} />
                          <div>
                            <strong>{training.title}</strong>
                            <span>{training.provider ?? "Организатор не указан"}</span>
                            <small>
                              {trainingLabels[training.status]} · {formatDate(training.startsAt)}
                              {training.costMinor !== null && training.currency
                                ? ` · ${new Intl.NumberFormat("ru-RU", { style: "currency", currency: training.currency }).format(training.costMinor / 100)}`
                                : ""}
                            </small>
                          </div>
                          <div className="hr-record-actions">
                            {training.status !== "completed" ? (
                              <button
                                className="secondary-button compact-button"
                                onClick={() => void completeTraining(training)}
                                type="button"
                              >
                                Завершить
                              </button>
                            ) : null}
                            <button
                              aria-label="Удалить обучение"
                              className="icon-button"
                              onClick={() => void deleteChild("trainings", training.id)}
                              title="Удалить"
                              type="button"
                            >
                              <Trash2 aria-hidden="true" size={15} />
                            </button>
                          </div>
                        </article>
                      ))}
                      {!selectedEmployee.trainings.length ? (
                        <div className="hr-empty-records">Обучение пока не назначено.</div>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {detailTab === "documents" ? (
                  <div className="hr-tab-stack">
                    <form className="hr-inline-form" onSubmit={(event) => void submitDocument(event)}>
                      <div className="form-grid form-grid-two">
                        <label className="form-field">
                          <span>Тип документа</span>
                          <select
                            onChange={(event) =>
                              setDocumentForm((current) => ({
                                ...current,
                                type: event.target.value as EmployeeDocument["type"]
                              }))
                            }
                            value={documentForm.type}
                          >
                            {Object.entries(documentLabels).map(([value, label]) => (
                              <option key={value} value={value}>{label}</option>
                            ))}
                          </select>
                        </label>
                        <label className="form-field">
                          <span>Название</span>
                          <input
                            maxLength={200}
                            onChange={(event) =>
                              setDocumentForm((current) => ({ ...current, title: event.target.value }))
                            }
                            required
                            value={documentForm.title}
                          />
                        </label>
                        <label className="form-field">
                          <span>Дата выдачи</span>
                          <input
                            onChange={(event) =>
                              setDocumentForm((current) => ({ ...current, issuedAt: event.target.value }))
                            }
                            type="date"
                            value={documentForm.issuedAt}
                          />
                        </label>
                        <label className="form-field">
                          <span>Действует до</span>
                          <input
                            onChange={(event) =>
                              setDocumentForm((current) => ({ ...current, expiresAt: event.target.value }))
                            }
                            type="date"
                            value={documentForm.expiresAt}
                          />
                        </label>
                        <label className="form-field form-field-span-two">
                          <span>Примечание</span>
                          <textarea
                            maxLength={2000}
                            onChange={(event) =>
                              setDocumentForm((current) => ({ ...current, notes: event.target.value }))
                            }
                            value={documentForm.notes}
                          />
                        </label>
                      </div>
                      <button className="primary-button hr-submit-button" disabled={isSaving} type="submit">
                        <FilePlus2 aria-hidden="true" size={15} />
                        Добавить документ
                      </button>
                    </form>
                    <div className="hr-record-list">
                      {selectedEmployee.documents.map((document) => (
                        <article className="hr-record hr-document-record" key={document.id}>
                          <FilePlus2 aria-hidden="true" size={20} />
                          <div>
                            <strong>{document.title}</strong>
                            <span>{documentLabels[document.type]}</span>
                            <small>
                              Выдан: {formatDate(document.issuedAt)} · Действует до: {formatDate(document.expiresAt)}
                            </small>
                          </div>
                          <button
                            aria-label="Удалить документ"
                            className="icon-button"
                            onClick={() => void deleteChild("documents", document.id)}
                            title="Удалить"
                            type="button"
                          >
                            <Trash2 aria-hidden="true" size={15} />
                          </button>
                        </article>
                      ))}
                      {!selectedEmployee.documents.length ? (
                        <div className="hr-empty-records">Документы пока не добавлены.</div>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {detailTab === "history" ? (
                  <div className="employee-history">
                    {selectedEmployee.employeeEvents.map((event) => (
                      <div className="employee-history-item" key={event.id}>
                        <span className="employee-history-dot" />
                        <div>
                          <strong>{eventLabels[event.type] ?? event.type}</strong>
                          <span>{event.reason ?? "Без комментария"}</span>
                          <small>
                            {formatDate(event.occurredAt)} · {event.actor?.staffProfile?.displayName ?? "Система"}
                          </small>
                        </div>
                      </div>
                    ))}
                    {!selectedEmployee.employeeEvents.length ? (
                      <div className="hr-empty-records">Кадровых событий пока нет.</div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="schedule-loading" role="status">Загружаем личное дело…</div>
          )}
        </Modal>
      ) : null}

      {actionTarget ? (
        <Modal
          description={actionTarget.employee.displayName}
          onClose={() => setActionTarget(null)}
          title={actionTarget.kind === "dismiss" ? "Уволить сотрудника?" : "Повторный приём"}
        >
          <form className="modal-form" onSubmit={(event) => void submitEmployeeAction(event)}>
            <label className="form-field">
              <span>{actionTarget.kind === "dismiss" ? "Дата увольнения" : "Дата приёма"}</span>
              <input
                onChange={(event) => setActionDate(event.target.value)}
                required
                type="date"
                value={actionDate}
              />
            </label>
            <label className="form-field">
              <span>{actionTarget.kind === "dismiss" ? "Основание" : "Комментарий"}</span>
              <textarea
                maxLength={1000}
                onChange={(event) => setActionReason(event.target.value)}
                required={actionTarget.kind === "dismiss"}
                value={actionReason}
              />
            </label>
            {actionTarget.kind === "dismiss" ? (
              <p className="feedback feedback-warning">
                Запись у клиентов сохранится, но доступ к CRM и онлайн-запись сотрудника будут отключены.
              </p>
            ) : null}
            {formError ? (
              <p className="feedback feedback-error" role="alert">{formError}</p>
            ) : null}
            <footer className="modal-actions">
              <button className="secondary-button" onClick={() => setActionTarget(null)} type="button">
                Отмена
              </button>
              <button
                className={actionTarget.kind === "dismiss" ? "danger-button" : "primary-button"}
                disabled={isSaving}
                type="submit"
              >
                {isSaving
                  ? "Сохраняем…"
                  : actionTarget.kind === "dismiss"
                    ? "Уволить"
                    : "Принять снова"}
              </button>
            </footer>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
