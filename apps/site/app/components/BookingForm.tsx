"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { Dictionary } from "../i18n/dictionary";
import type { Locale } from "../i18n/locales";
import { apiUrl } from "../lib/api-url";
import { useAuthStatus } from "../lib/use-auth";

type ServicePrice = { currency: string; amountMinor: number };
type Service = {
  id: string;
  titleRu: string;
  titleEn: string | null;
  titleEs: string | null;
  durationMinutes: number;
  prices: ServicePrice[];
};
type Staff = { id: string; displayName: string };
type Slot = { startsAt: string; endsAt: string };

type Status = "idle" | "submitting" | "success" | "error";

function serviceTitle(service: Service, lang: Locale) {
  if (lang === "en" && service.titleEn) return service.titleEn;
  if (lang === "es" && service.titleEs) return service.titleEs;
  if (lang === "fr" && service.titleEn) return service.titleEn;
  return service.titleRu;
}

function formatPrice(service: Service) {
  const rub = service.prices.find((price) => price.currency === "RUB");
  if (!rub) return null;
  return `${Math.round(rub.amountMinor / 100).toLocaleString("ru-RU")} ₽`;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function maxDateIso() {
  const date = new Date();
  date.setDate(date.getDate() + 60);
  return date.toISOString().slice(0, 10);
}

function formatSlotTime(iso: string) {
  return new Date(iso).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Moscow"
  });
}

export function BookingForm({ dict, lang }: { dict: Dictionary["booking"]; lang: Locale }) {
  const auth = useAuthStatus();

  const [services, setServices] = useState<Service[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [serviceId, setServiceId] = useState("");
  const [staffId, setStaffId] = useState("");
  const [date, setDate] = useState(todayIso());
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${apiUrl}/v1/services`)
      .then((response) => response.json())
      .then((data) => setServices(data.services ?? []))
      .catch(() => setServices([]));

    fetch(`${apiUrl}/v1/staff`)
      .then((response) => response.json())
      .then((data) => {
        const list: Staff[] = data.staff ?? [];
        setStaffList(list);
        if (list.length === 1 && list[0]) setStaffId(list[0].id);
      })
      .catch(() => setStaffList([]));
  }, []);

  useEffect(() => {
    setSelectedSlot(null);
    setSlots([]);

    if (!serviceId || !staffId || !date) return;

    let cancelled = false;
    setSlotsLoading(true);
    setSlotsError(null);

    const query = new URLSearchParams({ serviceId, staffId, date });
    fetch(`${apiUrl}/v1/availability?${query.toString()}`)
      .then((response) => {
        if (!response.ok) throw new Error("unavailable");
        return response.json();
      })
      .then((data) => {
        if (cancelled) return;
        setSlots(data.slots ?? []);
      })
      .catch(() => {
        if (!cancelled) setSlotsError(dict.errorUnavailable);
      })
      .finally(() => {
        if (!cancelled) setSlotsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [serviceId, staffId, date, dict.errorUnavailable]);

  const selectedService = useMemo(
    () => services.find((service) => service.id === serviceId) ?? null,
    [services, serviceId]
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedSlot) return;
    setErrorMessage(null);
    setStatus("submitting");

    const form = new FormData(event.currentTarget);
    const isSignedIn = auth.status === "signed-in";

    try {
      const response = await fetch(`${apiUrl}/v1/appointments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          serviceId,
          staffId,
          startsAt: selectedSlot,
          clientComment: form.get("comment") || undefined,
          ...(isSignedIn
            ? {}
            : {
                guest: {
                  fullName: form.get("fullName"),
                  phone: form.get("phone"),
                  email: form.get("email") || undefined
                }
              })
        })
      });

      if (response.ok) {
        setStatus("success");
        return;
      }

      if (response.status === 409) {
        setStatus("error");
        setErrorMessage(dict.errorSlotTaken);
        return;
      }

      if (response.status === 503) {
        setStatus("error");
        setErrorMessage(dict.errorUnavailable);
        return;
      }

      setStatus("error");
      setErrorMessage(dict.errorInvalid);
    } catch {
      setStatus("error");
      setErrorMessage(dict.errorNetwork);
    }
  }

  if (status === "success") {
    return (
      <div className="register-success">
        <h2>{dict.successTitle}</h2>
        <p>{dict.successBody}</p>
      </div>
    );
  }

  return (
    <form className="register-form booking-form" onSubmit={handleSubmit}>
      <div className="register-field">
        <label htmlFor="serviceId">{dict.serviceLabel}</label>
        <select
          id="serviceId"
          name="serviceId"
          required
          value={serviceId}
          onChange={(event) => setServiceId(event.target.value)}
        >
          <option value="" disabled>
            {dict.servicePlaceholder}
          </option>
          {services.map((service) => {
            const price = formatPrice(service);
            return (
              <option key={service.id} value={service.id}>
                {serviceTitle(service, lang)} · {service.durationMinutes} мин
                {price ? ` · ${price}` : ""}
              </option>
            );
          })}
        </select>
      </div>

      {staffList.length > 1 ? (
        <div className="register-field">
          <label htmlFor="staffId">{dict.masterLabel}</label>
          <select
            id="staffId"
            name="staffId"
            required
            value={staffId}
            onChange={(event) => setStaffId(event.target.value)}
          >
            <option value="" disabled>
              {dict.masterLabel}
            </option>
            {staffList.map((staff) => (
              <option key={staff.id} value={staff.id}>
                {staff.displayName}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="register-field">
        <label htmlFor="date">{dict.dateLabel}</label>
        <input
          id="date"
          name="date"
          type="date"
          required
          min={todayIso()}
          max={maxDateIso()}
          value={date}
          onChange={(event) => setDate(event.target.value)}
        />
      </div>

      <div className="register-field">
        <span className="booking-slots-label">{dict.timeLabel}</span>
        {!serviceId || !staffId ? (
          <p className="register-hint">{dict.timePlaceholder}</p>
        ) : slotsLoading ? (
          <p className="register-hint">{dict.loadingSlotsLabel}</p>
        ) : slotsError ? (
          <p className="register-error">{slotsError}</p>
        ) : slots.length === 0 ? (
          <p className="register-hint">{dict.noSlotsLabel}</p>
        ) : (
          <div className="booking-slots" role="group" aria-label={dict.timeLabel}>
            {slots.map((slot) => (
              <button
                key={slot.startsAt}
                type="button"
                className={`booking-slot${selectedSlot === slot.startsAt ? " booking-slot-selected" : ""}`}
                aria-pressed={selectedSlot === slot.startsAt}
                onClick={() => setSelectedSlot(slot.startsAt)}
              >
                {formatSlotTime(slot.startsAt)}
              </button>
            ))}
          </div>
        )}
      </div>

      {auth.status === "signed-in" ? (
        <p className="register-hint">{dict.signedInAs}</p>
      ) : (
        <>
          <div className="register-field">
            <label htmlFor="fullName">{dict.fullNameLabel}</label>
            <input id="fullName" name="fullName" type="text" required minLength={2} maxLength={160} />
          </div>
          <div className="register-field">
            <label htmlFor="phone">{dict.phoneLabel}</label>
            <input id="phone" name="phone" type="tel" required minLength={7} maxLength={30} />
          </div>
          <div className="register-field">
            <label htmlFor="email">{dict.emailLabel}</label>
            <input id="email" name="email" type="email" maxLength={200} />
          </div>
        </>
      )}

      <div className="register-field">
        <label htmlFor="comment">{dict.commentLabel}</label>
        <textarea id="comment" name="comment" rows={3} maxLength={2000} />
      </div>

      {status === "error" && errorMessage ? (
        <p className="register-error" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <button
        type="submit"
        className="btn btn-solid register-submit"
        disabled={status === "submitting" || !selectedSlot}
      >
        <span>{status === "submitting" ? dict.submittingLabel : dict.submitLabel}</span>
      </button>
    </form>
  );
}
