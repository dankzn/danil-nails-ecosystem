"use client";

import { useEffect, useState } from "react";
import { UserRound } from "lucide-react";

type AppointmentStatus =
  | "draft"
  | "pending_admin_confirmation"
  | "confirmed"
  | "completed"
  | "canceled"
  | "rescheduled"
  | "no_show";

type ArrivalAppointment = {
  id: string;
  status: AppointmentStatus;
  startsAt: string;
  endsAt: string;
  client: { fullName: string | null; phone: string };
  service: { titleRu: string };
  staff: { displayName: string };
};

const expectedStatuses = new Set<AppointmentStatus>([
  "confirmed",
  "pending_admin_confirmation"
]);

const thresholds = [15, 60, 90] as const;
const thresholdLabels: Record<(typeof thresholds)[number], string> = {
  15: "До 15 минут",
  60: "До 60 минут",
  90: "До 90 минут"
};

const timeFormatter = new Intl.DateTimeFormat("ru-RU", {
  timeZone: "Europe/Moscow",
  hour: "2-digit",
  minute: "2-digit"
});

function minutesUntil(startsAt: string, now: number) {
  return Math.round((new Date(startsAt).getTime() - now) / 60000);
}

export function ArrivalTracker({
  appointments
}: {
  appointments: ArrivalAppointment[];
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);

  const upcoming = appointments
    .filter((appointment) => expectedStatuses.has(appointment.status))
    .map((appointment) => ({
      appointment,
      minutesLeft: minutesUntil(appointment.startsAt, now)
    }))
    .filter(({ minutesLeft }) => minutesLeft >= 0 && minutesLeft <= 90)
    .sort((a, b) => a.minutesLeft - b.minutesLeft);

  const bounds: Array<{ threshold: (typeof thresholds)[number]; lowerBound: number }> = [
    { threshold: 15, lowerBound: -1 },
    { threshold: 60, lowerBound: 15 },
    { threshold: 90, lowerBound: 60 }
  ];
  const groups = bounds.map(({ threshold, lowerBound }) => ({
    threshold,
    items: upcoming.filter(
      ({ minutesLeft }) => minutesLeft > lowerBound && minutesLeft <= threshold
    )
  }));

  const hasAny = upcoming.length > 0;

  return (
    <article className="panel arrival-panel">
      <div className="panel-heading">
        <div>
          <p className="section-kicker">Приход клиентов</p>
          <h2>Скоро придут</h2>
        </div>
      </div>

      {!hasAny ? (
        <div className="dashboard-empty dashboard-empty-compact">
          <span>В ближайшие 90 минут никого не ждём.</span>
        </div>
      ) : (
        <div className="arrival-groups">
          {groups
            .filter((group) => group.items.length)
            .map((group) => (
              <div className="arrival-group" key={group.threshold}>
                <p className={`arrival-group-label arrival-group-${group.threshold}`}>
                  {thresholdLabels[group.threshold]}
                </p>
                <div className="arrival-list">
                  {group.items.map(({ appointment, minutesLeft }) => (
                    <div className="arrival-row" key={appointment.id}>
                      <div className="arrival-countdown">
                        <strong>
                          {minutesLeft === 0 ? "сейчас" : `${minutesLeft} мин`}
                        </strong>
                        <span>{timeFormatter.format(new Date(appointment.startsAt))}</span>
                      </div>
                      <div className="arrival-client">
                        <strong>
                          {appointment.client.fullName ?? appointment.client.phone}
                        </strong>
                        <span>{appointment.service.titleRu}</span>
                      </div>
                      <div className="arrival-master">
                        <UserRound aria-hidden="true" size={14} />
                        <span>{appointment.staff.displayName}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}
    </article>
  );
}
