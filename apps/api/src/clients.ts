import { AppointmentStatus } from "@danil-nails/db";

export const dayMs = 86400000;
export const clientCategories = [
  "regular",
  "sleeping",
  "lost",
  "never_visited",
  "new",
  "blocked",
  "deleted",
  "penalized"
] as const;
export type ClientCategory = (typeof clientCategories)[number];

export type ClientCategoryInput = {
  id: string;
  createdAt: Date;
  isBlocked: boolean;
  deletedAt: Date | null;
  appointments: Array<{ startsAt: Date; status: AppointmentStatus }>;
};

// 2+ actual visits within the last ~3 months.
const regularWindowMs = 90 * dayMs;
// Last visit between ~3 and ~6 months ago.
const sleepingWindowMs = 182 * dayMs;
// Created within the last 7 days.
const newClientWindowMs = 7 * dayMs;

export function categorizeClient(
  client: ClientCategoryInput,
  now: Date
): Set<ClientCategory> {
  const categories = new Set<ClientCategory>();

  if (client.deletedAt) {
    categories.add("deleted");
    return categories;
  }

  const completedVisits = client.appointments.filter(
    (appointment) => appointment.status === AppointmentStatus.completed
  );
  const lastVisit = completedVisits.reduce<Date | null>(
    (latest, visit) =>
      !latest || visit.startsAt > latest ? visit.startsAt : latest,
    null
  );

  if (client.isBlocked) categories.add("blocked");
  if (client.appointments.some((a) => a.status === AppointmentStatus.no_show)) {
    categories.add("penalized");
  }
  if (now.getTime() - client.createdAt.getTime() <= newClientWindowMs) {
    categories.add("new");
  }

  if (completedVisits.length === 0) {
    categories.add("never_visited");
    return categories;
  }

  const recentVisits = completedVisits.filter(
    (visit) => now.getTime() - visit.startsAt.getTime() <= regularWindowMs
  ).length;
  if (recentVisits >= 2) categories.add("regular");

  const sinceLastVisit = now.getTime() - lastVisit!.getTime();
  if (sinceLastVisit > sleepingWindowMs) categories.add("lost");
  else if (sinceLastVisit > regularWindowMs) categories.add("sleeping");

  return categories;
}

export function categorizeClients(
  clients: ClientCategoryInput[],
  now: Date
): Record<ClientCategory, string[]> {
  const result: Record<ClientCategory, string[]> = {
    regular: [],
    sleeping: [],
    lost: [],
    never_visited: [],
    new: [],
    blocked: [],
    deleted: [],
    penalized: []
  };

  for (const client of clients) {
    for (const category of categorizeClient(client, now)) {
      result[category].push(client.id);
    }
  }

  return result;
}

// The "Новые" sidebar label shows the rolling window it counts
// ("за период: DD.MM-DD.MM"), inclusive of today.
export function newClientWindow(now: Date) {
  return {
    from: new Date(now.getTime() - newClientWindowMs),
    to: now
  };
}
