"use client";

import { ChevronDown, ChevronLeft, ChevronRight, CircleAlert } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { apiUrl } from "../../lib/api-url";
import { apiRequest } from "../../lib/api";

type Granularity = "month" | "quarter" | "year";

type RetentionRow = {
  totalClients: number;
  newClients: number;
  returnedTotal: number;
  returnedNew: number;
  lostTotal: number;
  lostNew: number;
};

type RetentionStaff = {
  id: string;
  displayName: string;
  photoUrl: string | null;
  positionTitle: string | null;
};

type RetentionResponse = {
  staff: RetentionStaff[];
  company: RetentionRow;
  byStaff: Record<string, RetentionRow>;
};

type FiltersResponse = {
  staff: Array<{ id: string; displayName: string; positionTitle: string | null }>;
  staffCategories: string[];
  services: Array<{ id: string; titleRu: string; category: string | null }>;
  serviceCategories: string[];
};

const zeroRow: RetentionRow = {
  totalClients: 0,
  newClients: 0,
  returnedTotal: 0,
  returnedNew: 0,
  lostTotal: 0,
  lostNew: 0
};

const monthNamesShort = [
  "янв",
  "фев",
  "мар",
  "апр",
  "май",
  "июн",
  "июл",
  "авг",
  "сен",
  "окт",
  "ноя",
  "дек"
];

function dateKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function periodRange(granularity: Granularity, anchor: Date) {
  const year = anchor.getUTCFullYear();
  if (granularity === "month") {
    const month = anchor.getUTCMonth();
    return {
      from: dateKey(new Date(Date.UTC(year, month, 1))),
      to: dateKey(new Date(Date.UTC(year, month + 1, 0)))
    };
  }
  if (granularity === "quarter") {
    const quarter = Math.floor(anchor.getUTCMonth() / 3);
    return {
      from: dateKey(new Date(Date.UTC(year, quarter * 3, 1))),
      to: dateKey(new Date(Date.UTC(year, quarter * 3 + 3, 0)))
    };
  }
  return {
    from: dateKey(new Date(Date.UTC(year, 0, 1))),
    to: dateKey(new Date(Date.UTC(year, 11, 31)))
  };
}

function shiftAnchor(granularity: Granularity, anchor: Date, direction: 1 | -1) {
  const year = anchor.getUTCFullYear();
  if (granularity === "month") {
    return new Date(Date.UTC(year, anchor.getUTCMonth() + direction, 1));
  }
  if (granularity === "quarter") {
    return new Date(Date.UTC(year, anchor.getUTCMonth() + direction * 3, 1));
  }
  return new Date(Date.UTC(year + direction, anchor.getUTCMonth(), 1));
}

function formatRangeLong(range: { from: string; to: string }) {
  const format = (value: string) => {
    const [y, m, d] = value.split("-");
    return `${d}.${m}.${y}`;
  };
  return `${format(range.from)} - ${format(range.to)}`;
}

function formatRangeShort(range: { from: string; to: string }) {
  const format = (value: string) => {
    const parts = value.split("-").map(Number);
    const month = parts[1] ?? 1;
    const day = parts[2] ?? 1;
    return `${String(day).padStart(2, "0")} ${monthNamesShort[month - 1]}`;
  };
  return `${format(range.from)} - ${format(range.to)}`;
}

function withPercent(value: number, total: number) {
  if (total <= 0) return `${value}`;
  return `${value} (${Math.round((value / total) * 100)}%)`;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export default function RetentionPage() {
  const today = new Date();
  const todayUtc = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  const [granularity, setGranularity] = useState<Granularity>("month");
  const [returnAnchor, setReturnAnchor] = useState(todayUtc);
  const [visitAnchor, setVisitAnchor] = useState(() => shiftAnchor("month", todayUtc, -1));
  const [staffCategory, setStaffCategory] = useState("");
  const [staffId, setStaffId] = useState("");
  const [serviceCategory, setServiceCategory] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [filters, setFilters] = useState<FiltersResponse | null>(null);
  const [data, setData] = useState<RetentionResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const returnPeriod = periodRange(granularity, returnAnchor);
  const visitPeriod = periodRange(granularity, visitAnchor);

  function changeGranularity(next: Granularity) {
    setGranularity(next);
    setReturnAnchor(todayUtc);
    setVisitAnchor(shiftAnchor(next, todayUtc, -1));
  }

  const loadFilters = useCallback(async () => {
    try {
      const response = await apiRequest<FiltersResponse>(
        "/v1/admin/clients/retention-filters"
      );
      setFilters(response);
    } catch {
      setFilters(null);
    }
  }, []);

  useEffect(() => {
    void loadFilters();
  }, [loadFilters]);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setLoadError(null);
    const searchParams = new URLSearchParams({
      visitFrom: visitPeriod.from,
      visitTo: visitPeriod.to,
      returnFrom: returnPeriod.from,
      returnTo: returnPeriod.to
    });
    if (staffId) searchParams.set("staffId", staffId);
    if (staffCategory) searchParams.set("staffCategory", staffCategory);
    if (serviceId) searchParams.set("serviceId", serviceId);
    if (serviceCategory) searchParams.set("serviceCategory", serviceCategory);

    apiRequest<RetentionResponse>(
      `/v1/admin/clients/retention?${searchParams}`,
      { signal: controller.signal }
    )
      .then((response) => setData(response))
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setLoadError("Не удалось загрузить данные возвращаемости.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    granularity,
    returnPeriod.from,
    returnPeriod.to,
    visitPeriod.from,
    visitPeriod.to,
    staffId,
    staffCategory,
    serviceId,
    serviceCategory
  ]);

  function renderCells(row: RetentionRow) {
    return (
      <>
        <td className="retention-number-cell">{row.totalClients}</td>
        <td className="retention-number-cell">
          {withPercent(row.newClients, row.totalClients)}
        </td>
        <td className="retention-number-cell">
          {withPercent(row.returnedTotal, row.totalClients)}
        </td>
        <td className="retention-number-cell">
          {withPercent(row.returnedNew, row.newClients)}
        </td>
        <td className="retention-number-cell retention-lost-cell">{row.lostTotal}</td>
        <td className="retention-number-cell retention-lost-cell">{row.lostNew}</td>
      </>
    );
  }

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Клиенты · аналитика</p>
          <h1>Возвращаемость</h1>
          <p className="page-description">
            Сколько клиентов вернулись к мастеру после визита, а сколько — нет.
          </p>
        </div>
      </header>

      <section className="panel retention-panel">
        <div className="retention-filters-row">
          <div>
            <p className="retention-filter-label">Период возврата</p>
            <div className="retention-period-controls">
              <div className="segmented-control retention-granularity">
                {(["month", "quarter", "year"] as const).map((option) => (
                  <button
                    className={granularity === option ? "is-active" : ""}
                    key={option}
                    onClick={() => changeGranularity(option)}
                    type="button"
                  >
                    {option === "month"
                      ? "Месяц"
                      : option === "quarter"
                        ? "Квартал"
                        : "Год"}
                  </button>
                ))}
              </div>
              <div className="retention-period-nav">
                <button
                  aria-label="Предыдущий период возврата"
                  onClick={() => setReturnAnchor((a) => shiftAnchor(granularity, a, -1))}
                  type="button"
                >
                  <ChevronLeft aria-hidden="true" size={16} />
                </button>
                <span>{formatRangeLong(returnPeriod)}</span>
                <button
                  aria-label="Следующий период возврата"
                  onClick={() => setReturnAnchor((a) => shiftAnchor(granularity, a, 1))}
                  type="button"
                >
                  <ChevronRight aria-hidden="true" size={16} />
                </button>
              </div>
            </div>
          </div>

          <div>
            <p className="retention-filter-label">Период посещения</p>
            <div className="retention-period-nav">
              <button
                aria-label="Предыдущий период посещения"
                onClick={() => setVisitAnchor((a) => shiftAnchor(granularity, a, -1))}
                type="button"
              >
                <ChevronLeft aria-hidden="true" size={16} />
              </button>
              <span>{formatRangeLong(visitPeriod)}</span>
              <button
                aria-label="Следующий период посещения"
                onClick={() => setVisitAnchor((a) => shiftAnchor(granularity, a, 1))}
                type="button"
              >
                <ChevronRight aria-hidden="true" size={16} />
              </button>
            </div>
          </div>
        </div>

        <div className="retention-select-row">
          <label className="retention-select-field">
            <span>Категории сотрудников</span>
            <div className="clients-group-select">
              <select
                onChange={(event) => setStaffCategory(event.target.value)}
                value={staffCategory}
              >
                <option value="">Все категории</option>
                {(filters?.staffCategories ?? []).map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              <ChevronDown aria-hidden="true" size={16} />
            </div>
          </label>
          <label className="retention-select-field">
            <span>Сотрудники</span>
            <div className="clients-group-select">
              <select onChange={(event) => setStaffId(event.target.value)} value={staffId}>
                <option value="">Все сотрудники</option>
                {(filters?.staff ?? []).map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.displayName}
                  </option>
                ))}
              </select>
              <ChevronDown aria-hidden="true" size={16} />
            </div>
          </label>
          <label className="retention-select-field">
            <span>Категории услуг</span>
            <div className="clients-group-select">
              <select
                onChange={(event) => setServiceCategory(event.target.value)}
                value={serviceCategory}
              >
                <option value="">Все категории</option>
                {(filters?.serviceCategories ?? []).map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              <ChevronDown aria-hidden="true" size={16} />
            </div>
          </label>
          <label className="retention-select-field">
            <span>Услуги</span>
            <div className="clients-group-select">
              <select
                onChange={(event) => setServiceId(event.target.value)}
                value={serviceId}
              >
                <option value="">Все услуги</option>
                {(filters?.services ?? []).map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.titleRu}
                  </option>
                ))}
              </select>
              <ChevronDown aria-hidden="true" size={16} />
            </div>
          </label>
        </div>

        {loadError ? (
          <div className="table-message table-message-error" role="alert">
            <CircleAlert aria-hidden="true" size={22} />
            <p>{loadError}</p>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="retention-table" aria-busy={isLoading}>
              <thead>
                <tr>
                  <th className="retention-staff-head" rowSpan={2}>
                    Сотрудник
                  </th>
                  <th colSpan={2}>
                    Клиентов за период посещения
                    <br />
                    <small>{formatRangeShort(visitPeriod)}</small>
                  </th>
                  <th colSpan={2}>
                    Вернувшиеся в периоде
                    <br />
                    <small>{formatRangeShort(returnPeriod)}</small>
                  </th>
                  <th colSpan={2}>
                    Потерянные в периоде
                    <br />
                    <small>{formatRangeShort(returnPeriod)}</small>
                  </th>
                </tr>
                <tr>
                  <th>Всего</th>
                  <th>Новые</th>
                  <th>Всего</th>
                  <th>Новые</th>
                  <th>Всего</th>
                  <th>Новые</th>
                </tr>
              </thead>
              <tbody>
                {data ? (
                  <>
                    <tr className="retention-company-row">
                      <td>
                        <div className="retention-identity">
                          <span className="retention-company-avatar" aria-hidden="true" />
                          <strong>По компании</strong>
                        </div>
                      </td>
                      {renderCells(data.company)}
                    </tr>
                    {data.staff.map((member) => (
                      <tr key={member.id}>
                        <td>
                          <div className="retention-identity">
                            <span className="calendar-grid-avatar retention-avatar">
                              {member.photoUrl ? (
                                <img alt="" src={`${apiUrl}${member.photoUrl}`} />
                              ) : (
                                initials(member.displayName)
                              )}
                            </span>
                            <div>
                              <strong>{member.displayName}</strong>
                              {member.positionTitle ? (
                                <small>{member.positionTitle}</small>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        {renderCells(data.byStaff[member.id] ?? zeroRow)}
                      </tr>
                    ))}
                  </>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
