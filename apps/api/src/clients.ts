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

export type RetentionRow = {
  totalClients: number;
  newClients: number;
  returnedTotal: number;
  returnedNew: number;
  lostTotal: number;
  lostNew: number;
};

function summarizeRetention(
  visitClientIds: Set<string>,
  returnClientIds: Set<string>,
  isNewClient: (clientId: string) => boolean
): RetentionRow {
  let newClients = 0;
  let returnedTotal = 0;
  let returnedNew = 0;

  for (const clientId of visitClientIds) {
    const isNew = isNewClient(clientId);
    if (isNew) newClients += 1;
    if (returnClientIds.has(clientId)) {
      returnedTotal += 1;
      if (isNew) returnedNew += 1;
    }
  }

  return {
    totalClients: visitClientIds.size,
    newClients,
    returnedTotal,
    returnedNew,
    lostTotal: visitClientIds.size - returnedTotal,
    lostNew: newClients - returnedNew
  };
}

// "Visited" this staff member's clients in the visit period, then checks
// whether each one came back to the SAME staff member in the return
// period ("Вернувшиеся") or didn't ("Потерянные"). The company row does
// the same across all staff combined (a client counts once even if they
// saw several masters). isNewClient flags a client whose very first-ever
// completed visit (any staff, any time) falls inside the visit period.
export function computeRetention(options: {
  visits: Array<{ clientId: string; staffId: string }>;
  returns: Array<{ clientId: string; staffId: string }>;
  isNewClient: (clientId: string) => boolean;
  staffIds: string[];
}): { company: RetentionRow; byStaff: Record<string, RetentionRow> } {
  const companyVisitClients = new Set(options.visits.map((v) => v.clientId));
  const companyReturnClients = new Set(options.returns.map((v) => v.clientId));
  const company = summarizeRetention(
    companyVisitClients,
    companyReturnClients,
    options.isNewClient
  );

  const byStaff: Record<string, RetentionRow> = {};
  for (const staffId of options.staffIds) {
    const visitClients = new Set(
      options.visits.filter((v) => v.staffId === staffId).map((v) => v.clientId)
    );
    const returnClients = new Set(
      options.returns.filter((v) => v.staffId === staffId).map((v) => v.clientId)
    );
    byStaff[staffId] = summarizeRetention(
      visitClients,
      returnClients,
      options.isNewClient
    );
  }

  return { company, byStaff };
}
