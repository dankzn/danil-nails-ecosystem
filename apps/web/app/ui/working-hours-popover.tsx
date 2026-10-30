"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { apiRequest } from "../lib/api";

export type DayRange = { startsAt: string; endsAt: string };

type Props = {
  staffId: string;
  date: string;
  initialRanges: DayRange[];
  anchor: { x: number; y: number };
  onClose: () => void;
  onSaved: (ranges: DayRange[]) => void;
};

const timeOptions = Array.from({ length: 48 }, (_, index) => {
  const hours = String(Math.floor(index / 2)).padStart(2, "0");
  const minutes = index % 2 === 0 ? "00" : "30";
  return `${hours}:${minutes}`;
});

function toHoursMinutes(value: string) {
  return value.slice(0, 5);
}

export function WorkingHoursPopover({
  staffId,
  date,
  initialRanges,
  anchor,
  onClose,
  onSaved
}: Props) {
  const hasInitialBreak = initialRanges.length > 1;
  const [start1, setStart1] = useState(
    toHoursMinutes(initialRanges[0]?.startsAt ?? "10:00")
  );
  const [end1, setEnd1] = useState(
    toHoursMinutes(
      initialRanges[0]?.endsAt ?? (hasInitialBreak ? "14:00" : "20:00")
    )
  );
  const [hasBreak, setHasBreak] = useState(hasInitialBreak);
  const [start2, setStart2] = useState(
    toHoursMinutes(initialRanges[1]?.startsAt ?? "15:00")
  );
  const [end2, setEnd2] = useState(toHoursMinutes(initialRanges[1]?.endsAt ?? "20:00"));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(ranges: DayRange[]) {
    setIsSaving(true);
    setError(null);
    try {
      const response = await apiRequest<{ date: string; ranges: DayRange[] }>(
        "/v1/admin/schedule/day",
        {
          method: "PUT",
          body: JSON.stringify({ staffId, date, ranges })
        }
      );
      onSaved(response.ranges);
      onClose();
    } catch {
      setError("Не удалось сохранить. Попробуйте ещё раз.");
    } finally {
      setIsSaving(false);
    }
  }

  function handleDone() {
    const ranges = hasBreak
      ? [
          { startsAt: start1, endsAt: end1 },
          { startsAt: start2, endsAt: end2 }
        ]
      : [{ startsAt: start1, endsAt: end1 }];
    void save(ranges);
  }

  return (
    <>
      <div className="working-hours-backdrop" onClick={onClose} />
      <div
        className="working-hours-popover"
        onClick={(event) => event.stopPropagation()}
        style={{ left: anchor.x, top: anchor.y }}
      >
        <div className="working-hours-popover-head">
          <h3>Рабочее время</h3>
          <button aria-label="Закрыть" onClick={onClose} type="button">
            <X aria-hidden="true" size={16} />
          </button>
        </div>

        <div className="working-hours-popover-row">
          <select onChange={(event) => setStart1(event.target.value)} value={start1}>
            {timeOptions.map((time) => (
              <option key={time} value={time}>
                {time}
              </option>
            ))}
          </select>
          <span>—</span>
          <select onChange={(event) => setEnd1(event.target.value)} value={end1}>
            {timeOptions.map((time) => (
              <option key={time} value={time}>
                {time}
              </option>
            ))}
          </select>
        </div>

        <label className="checkbox-field working-hours-popover-break">
          <input
            checked={hasBreak}
            onChange={(event) => setHasBreak(event.target.checked)}
            type="checkbox"
          />
          <span>С перерывом</span>
        </label>

        {hasBreak ? (
          <div className="working-hours-popover-row">
            <select onChange={(event) => setStart2(event.target.value)} value={start2}>
              {timeOptions.map((time) => (
                <option key={time} value={time}>
                  {time}
                </option>
              ))}
            </select>
            <span>—</span>
            <select onChange={(event) => setEnd2(event.target.value)} value={end2}>
              {timeOptions.map((time) => (
                <option key={time} value={time}>
                  {time}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <button
          className="dikidi-link working-hours-popover-dayoff"
          disabled={isSaving}
          onClick={() => void save([])}
          type="button"
        >
          сделать день нерабочим
        </button>

        {error ? (
          <p className="feedback feedback-error" role="alert">
            {error}
          </p>
        ) : null}

        <button
          className="dikidi-button-blue working-hours-popover-done"
          disabled={isSaving}
          onClick={handleDone}
          type="button"
        >
          {isSaving ? "Сохраняем…" : "Готово"}
        </button>
      </div>
    </>
  );
}
