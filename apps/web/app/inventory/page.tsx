"use client";

import { Archive, ArchiveRestore, History, Link2, Pencil, Plus } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ApiError, apiRequest } from "../lib/api";
import { Modal } from "../ui/modal";

type MaterialUnit = "piece" | "ml" | "g";
type ServiceOption = { id: string; titleRu: string };
type ServiceLink = { id: string; serviceId: string; quantity: number; service: ServiceOption };
type Material = {
  id: string;
  title: string;
  sku: string | null;
  unit: MaterialUnit;
  reorderThreshold: number;
  isArchived: boolean;
  onHand: number;
  isLow: boolean;
  serviceLinks: ServiceLink[];
};
type Movement = {
  id: string;
  type: "receipt" | "consumption" | "adjustment" | "write_off";
  quantity: number;
  note: string | null;
  occurredAt: string;
  actor: {
    email: string | null;
    staffProfile: { displayName: string } | null;
  } | null;
  appointment: { id: string; client: { fullName: string | null; phone: string } } | null;
};

const unitLabels: Record<MaterialUnit, string> = {
  piece: "шт",
  ml: "мл",
  g: "г"
};

const movementTypeLabels: Record<Movement["type"], string> = {
  receipt: "Приход",
  consumption: "Списание (услуга)",
  adjustment: "Корректировка",
  write_off: "Порча/списание"
};

function inventoryErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === "material_already_exists") {
      return "Материал с таким названием уже существует.";
    }
    if (error.code === "service_not_found") return "Услуга не найдена.";
    if (error.status === 401 || error.status === 403) {
      return "Недостаточно прав или сессия завершилась.";
    }
  }
  return "Не удалось сохранить. Попробуйте ещё раз.";
}

export default function InventoryPage() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: "",
    sku: "",
    unit: "piece" as MaterialUnit,
    reorderThreshold: "0"
  });

  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    sku: "",
    unit: "piece" as MaterialUnit,
    reorderThreshold: "0"
  });

  const [movementMaterial, setMovementMaterial] = useState<Material | null>(null);
  const [movementForm, setMovementForm] = useState({
    type: "receipt" as "receipt" | "adjustment" | "write_off",
    quantity: "",
    note: ""
  });

  const [linksMaterial, setLinksMaterial] = useState<Material | null>(null);
  const [links, setLinks] = useState<Record<string, string>>({});

  const [historyMaterial, setHistoryMaterial] = useState<Material | null>(null);
  const [history, setHistory] = useState<Movement[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [materialsResponse, optionsResponse] = await Promise.all([
        apiRequest<{ materials: Material[] }>("/v1/owner/materials"),
        apiRequest<{ services: ServiceOption[] }>("/v1/admin/booking-options")
      ]);
      setMaterials(materialsResponse.materials);
      setServices(optionsResponse.services);
    } catch {
      setLoadError("Не удалось загрузить склад.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreateForm() {
    setCreateForm({ title: "", sku: "", unit: "piece", reorderThreshold: "0" });
    setFormError(null);
    setIsCreateOpen(true);
  }

  async function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setFormError(null);
    setNotice(null);
    try {
      await apiRequest("/v1/owner/materials", {
        method: "POST",
        body: JSON.stringify({
          title: createForm.title.trim(),
          sku: createForm.sku.trim() || null,
          unit: createForm.unit,
          reorderThreshold: Number(createForm.reorderThreshold.replace(",", ".")) || 0
        })
      });
      setIsCreateOpen(false);
      setNotice("Материал добавлен.");
      await load();
    } catch (error) {
      setFormError(inventoryErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  function openEditForm(material: Material) {
    setEditingMaterial(material);
    setEditForm({
      title: material.title,
      sku: material.sku ?? "",
      unit: material.unit,
      reorderThreshold: String(material.reorderThreshold)
    });
    setFormError(null);
  }

  async function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingMaterial) return;
    setIsSaving(true);
    setFormError(null);
    try {
      await apiRequest(`/v1/owner/materials/${editingMaterial.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: editForm.title.trim(),
          sku: editForm.sku.trim() || null,
          unit: editForm.unit,
          reorderThreshold: Number(editForm.reorderThreshold.replace(",", ".")) || 0
        })
      });
      setEditingMaterial(null);
      setNotice("Материал обновлён.");
      await load();
    } catch (error) {
      setFormError(inventoryErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function toggleArchived(material: Material) {
    setNotice(null);
    try {
      await apiRequest(`/v1/owner/materials/${material.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isArchived: !material.isArchived })
      });
      setNotice(
        material.isArchived ? "Материал восстановлен." : "Материал отправлен в архив."
      );
      await load();
    } catch (error) {
      setLoadError(inventoryErrorMessage(error));
    }
  }

  function openMovementForm(material: Material) {
    setMovementMaterial(material);
    setMovementForm({ type: "receipt", quantity: "", note: "" });
    setFormError(null);
  }

  async function submitMovement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!movementMaterial) return;
    const quantity = Number(movementForm.quantity.replace(",", "."));
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setFormError("Укажите количество больше нуля.");
      return;
    }
    setIsSaving(true);
    setFormError(null);
    try {
      await apiRequest(`/v1/owner/materials/${movementMaterial.id}/movements`, {
        method: "POST",
        body: JSON.stringify({
          type: movementForm.type,
          quantity,
          note: movementForm.note.trim() || null
        })
      });
      setMovementMaterial(null);
      setNotice("Движение по складу записано.");
      await load();
    } catch (error) {
      setFormError(inventoryErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  function openLinksForm(material: Material) {
    setLinksMaterial(material);
    const initial: Record<string, string> = {};
    for (const link of material.serviceLinks) {
      initial[link.serviceId] = String(link.quantity);
    }
    setLinks(initial);
    setFormError(null);
  }

  async function submitLinks(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!linksMaterial) return;
    setIsSaving(true);
    setFormError(null);
    try {
      const payload = Object.entries(links)
        .filter(([, value]) => value.trim() !== "")
        .map(([serviceId, value]) => ({
          serviceId,
          quantity: Number(value.replace(",", "."))
        }))
        .filter((item) => Number.isFinite(item.quantity) && item.quantity > 0);
      await apiRequest(`/v1/owner/materials/${linksMaterial.id}/services`, {
        method: "PUT",
        body: JSON.stringify({ links: payload })
      });
      setLinksMaterial(null);
      setNotice("Расход материала на услуги обновлён.");
      await load();
    } catch (error) {
      setFormError(inventoryErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function openHistory(material: Material) {
    setHistoryMaterial(material);
    setIsHistoryLoading(true);
    try {
      const response = await apiRequest<{ movements: Movement[] }>(
        `/v1/owner/materials/${material.id}/movements`
      );
      setHistory(response.movements);
    } catch {
      setHistory([]);
    } finally {
      setIsHistoryLoading(false);
    }
  }

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Только для владельца</p>
          <h1>Склад</h1>
          <p className="page-description">
            Остатки материалов, приход/списание и расход на услуги.
          </p>
        </div>
        <button className="primary-button" onClick={openCreateForm} type="button">
          <Plus aria-hidden="true" size={18} />
          Добавить материал
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
            <p>Загружаем склад…</p>
          </div>
        ) : loadError ? (
          <div className="table-message table-message-error" role="alert">
            <p>{loadError}</p>
          </div>
        ) : materials.length === 0 ? (
          <div className="empty-table-state">
            <div>
              <strong>Склад пуст</strong>
              <span>Добавьте первый материал кнопкой выше.</span>
            </div>
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Материал</th>
                  <th>Остаток</th>
                  <th>Точка дозаказа</th>
                  <th>Расход на услуги</th>
                  <th>Статус</th>
                  <th aria-label="Действия" />
                </tr>
              </thead>
              <tbody>
                {materials.map((material) => (
                  <tr key={material.id}>
                    <td>
                      <strong>{material.title}</strong>
                      {material.sku ? <small>{material.sku}</small> : null}
                    </td>
                    <td>
                      <span className={`status ${material.isLow ? "status-danger" : "status-success"}`}>
                        {material.onHand} {unitLabels[material.unit]}
                      </span>
                    </td>
                    <td>
                      {material.reorderThreshold} {unitLabels[material.unit]}
                    </td>
                    <td>
                      {material.serviceLinks.length
                        ? material.serviceLinks
                            .map((link) => `${link.service.titleRu} (${link.quantity})`)
                            .join(", ")
                        : "Не привязан"}
                    </td>
                    <td>
                      <span
                        className={`status ${material.isArchived ? "status-neutral" : "status-success"}`}
                      >
                        {material.isArchived ? "Архив" : "Активен"}
                      </span>
                    </td>
                    <td className="action-cell">
                      <button
                        aria-label={`Движение по ${material.title}`}
                        className="icon-button table-action"
                        onClick={() => openMovementForm(material)}
                        title="Приход/списание"
                        type="button"
                      >
                        <Plus aria-hidden="true" size={15} />
                      </button>
                      <button
                        aria-label={`Привязать услуги к ${material.title}`}
                        className="icon-button table-action"
                        onClick={() => openLinksForm(material)}
                        title="Расход на услуги"
                        type="button"
                      >
                        <Link2 aria-hidden="true" size={15} />
                      </button>
                      <button
                        aria-label={`История ${material.title}`}
                        className="icon-button table-action"
                        onClick={() => void openHistory(material)}
                        title="История движений"
                        type="button"
                      >
                        <History aria-hidden="true" size={15} />
                      </button>
                      <button
                        aria-label={`Изменить ${material.title}`}
                        className="icon-button table-action"
                        onClick={() => openEditForm(material)}
                        title="Изменить"
                        type="button"
                      >
                        <Pencil aria-hidden="true" size={15} />
                      </button>
                      <button
                        aria-label={
                          material.isArchived
                            ? `Восстановить ${material.title}`
                            : `Архивировать ${material.title}`
                        }
                        className="icon-button table-action"
                        onClick={() => void toggleArchived(material)}
                        title={material.isArchived ? "Восстановить" : "Архивировать"}
                        type="button"
                      >
                        {material.isArchived ? (
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

      {isCreateOpen ? (
        <Modal onClose={() => setIsCreateOpen(false)} title="Новый материал">
          <form className="modal-form" onSubmit={submitCreate}>
            <label className="form-field">
              <span>Название</span>
              <input
                maxLength={160}
                onChange={(event) =>
                  setCreateForm((current) => ({ ...current, title: event.target.value }))
                }
                required
                value={createForm.title}
              />
            </label>
            <div className="form-grid form-grid-two">
              <label className="form-field">
                <span>Артикул</span>
                <input
                  maxLength={60}
                  onChange={(event) =>
                    setCreateForm((current) => ({ ...current, sku: event.target.value }))
                  }
                  value={createForm.sku}
                />
              </label>
              <label className="form-field">
                <span>Единица измерения</span>
                <select
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      unit: event.target.value as MaterialUnit
                    }))
                  }
                  value={createForm.unit}
                >
                  <option value="piece">Штуки</option>
                  <option value="ml">Миллилитры</option>
                  <option value="g">Граммы</option>
                </select>
              </label>
            </div>
            <label className="form-field">
              <span>Точка дозаказа</span>
              <input
                inputMode="decimal"
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    reorderThreshold: event.target.value
                  }))
                }
                value={createForm.reorderThreshold}
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
                onClick={() => setIsCreateOpen(false)}
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

      {editingMaterial ? (
        <Modal onClose={() => setEditingMaterial(null)} title="Изменить материал">
          <form className="modal-form" onSubmit={submitEdit}>
            <label className="form-field">
              <span>Название</span>
              <input
                maxLength={160}
                onChange={(event) =>
                  setEditForm((current) => ({ ...current, title: event.target.value }))
                }
                required
                value={editForm.title}
              />
            </label>
            <div className="form-grid form-grid-two">
              <label className="form-field">
                <span>Артикул</span>
                <input
                  maxLength={60}
                  onChange={(event) =>
                    setEditForm((current) => ({ ...current, sku: event.target.value }))
                  }
                  value={editForm.sku}
                />
              </label>
              <label className="form-field">
                <span>Единица измерения</span>
                <select
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      unit: event.target.value as MaterialUnit
                    }))
                  }
                  value={editForm.unit}
                >
                  <option value="piece">Штуки</option>
                  <option value="ml">Миллилитры</option>
                  <option value="g">Граммы</option>
                </select>
              </label>
            </div>
            <label className="form-field">
              <span>Точка дозаказа</span>
              <input
                inputMode="decimal"
                onChange={(event) =>
                  setEditForm((current) => ({
                    ...current,
                    reorderThreshold: event.target.value
                  }))
                }
                value={editForm.reorderThreshold}
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
                onClick={() => setEditingMaterial(null)}
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

      {movementMaterial ? (
        <Modal
          description={`Текущий остаток: ${movementMaterial.onHand} ${unitLabels[movementMaterial.unit]}`}
          onClose={() => setMovementMaterial(null)}
          title={`Движение: ${movementMaterial.title}`}
        >
          <form className="modal-form" onSubmit={submitMovement}>
            <label className="form-field">
              <span>Тип движения</span>
              <select
                onChange={(event) =>
                  setMovementForm((current) => ({
                    ...current,
                    type: event.target.value as typeof movementForm.type
                  }))
                }
                value={movementForm.type}
              >
                <option value="receipt">Приход (закупка)</option>
                <option value="adjustment">Корректировка (инвентаризация)</option>
                <option value="write_off">Порча/списание</option>
              </select>
            </label>
            <label className="form-field">
              <span>Количество ({unitLabels[movementMaterial.unit]})</span>
              <input
                inputMode="decimal"
                onChange={(event) =>
                  setMovementForm((current) => ({ ...current, quantity: event.target.value }))
                }
                required
                value={movementForm.quantity}
              />
            </label>
            <label className="form-field">
              <span>Комментарий</span>
              <input
                maxLength={1000}
                onChange={(event) =>
                  setMovementForm((current) => ({ ...current, note: event.target.value }))
                }
                value={movementForm.note}
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
                onClick={() => setMovementMaterial(null)}
                type="button"
              >
                Отмена
              </button>
              <button className="primary-button" disabled={isSaving} type="submit">
                {isSaving ? "Сохраняем…" : "Записать"}
              </button>
            </footer>
          </form>
        </Modal>
      ) : null}

      {linksMaterial ? (
        <Modal
          description="Сколько материала списывается автоматически при закрытии записи на услугу."
          onClose={() => setLinksMaterial(null)}
          title={`Расход на услуги: ${linksMaterial.title}`}
        >
          <form className="modal-form" onSubmit={submitLinks}>
            <div className="form-grid">
              {services.map((service) => (
                <label className="form-field form-field-inline" key={service.id}>
                  <span>{service.titleRu}</span>
                  <input
                    inputMode="decimal"
                    onChange={(event) =>
                      setLinks((current) => ({ ...current, [service.id]: event.target.value }))
                    }
                    placeholder={`0 ${unitLabels[linksMaterial.unit]}`}
                    value={links[service.id] ?? ""}
                  />
                </label>
              ))}
            </div>
            {formError ? (
              <p className="feedback feedback-error" role="alert">
                {formError}
              </p>
            ) : null}
            <footer className="modal-actions">
              <button
                className="secondary-button"
                onClick={() => setLinksMaterial(null)}
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

      {historyMaterial ? (
        <Modal onClose={() => setHistoryMaterial(null)} title={`История: ${historyMaterial.title}`}>
          {isHistoryLoading ? (
            <p className="muted-label">Загружаем…</p>
          ) : history.length === 0 ? (
            <p className="muted-label">Движений пока нет.</p>
          ) : (
            <ul className="payment-summary-list">
              {history.map((movement) => (
                <li key={movement.id}>
                  {movementTypeLabels[movement.type]} ·{" "}
                  {movement.quantity > 0 ? "+" : ""}
                  {movement.quantity} {unitLabels[historyMaterial.unit]}
                  {movement.note ? ` · ${movement.note}` : ""}
                  {movement.appointment
                    ? ` · запись клиента ${movement.appointment.client.fullName ?? movement.appointment.client.phone}`
                    : ""}
                </li>
              ))}
            </ul>
          )}
        </Modal>
      ) : null}
    </div>
  );
}
