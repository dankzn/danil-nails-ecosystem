import {
  AppointmentStatus,
  AttendanceConfirmationStatus,
  UserRole,
  type DatabaseClient
} from "@danil-nails/db";
import { businessConfig } from "@danil-nails/shared";
import type { FastifyInstance, FastifyReply } from "fastify";
import { authorize } from "../auth/session.js";

const dashboardAppointmentInclude = {
  client: { select: { fullName: true, phone: true } },
  service: { select: { titleRu: true } },
  staff: { select: { displayName: true } }
} as const;

type DashboardAlert = {
  id: string;
  type:
    | "appointment_confirmation"
    | "attendance_confirmation"
    | "schedule_missing";
  startsAt: Date;
  clientName: string;
  serviceName: string;
};

function moscowDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: businessConfig.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function dayRange(date: string) {
  const startsAt = new Date(`${date}T00:00:00+03:00`);
  return {
    startsAt,
    endsAt: new Date(startsAt.getTime() + 24 * 60 * 60 * 1000)
  };
}

export function registerDashboardRoutes(
  server: FastifyInstance,
  database: DatabaseClient | null
) {
  const staffGuard = authorize(database, [
    UserRole.owner,
    UserRole.admin,
    UserRole.master
  ]);

  server.get(
    "/v1/admin/dashboard",
    { preHandler: staffGuard },
    async (request, reply: FastifyReply) => {
      const today = moscowDateKey();
      const todayRange = dayRange(today);
      const attentionEndsAt = new Date(
        todayRange.endsAt.getTime() + 24 * 60 * 60 * 1000
      );
      let staffId: string | undefined;

      if (request.crmUser!.role === UserRole.master) {
        const profile = await database!.staffProfile.findUnique({
          where: { userId: request.crmUser!.id },
          select: { id: true }
        });
        if (!profile) return reply.code(403).send({ error: "staff_profile_required" });
        staffId = profile.id;
      }

      const appointmentScope = staffId ? { staffId } : {};
      const [appointments, attentionAppointments, activeServices, staffHours] =
        await Promise.all([
          database!.appointment.findMany({
            where: {
              ...appointmentScope,
              startsAt: { gte: todayRange.startsAt, lt: todayRange.endsAt }
            },
            include: dashboardAppointmentInclude,
            orderBy: { startsAt: "asc" }
          }),
          database!.appointment.findMany({
            where: {
              ...appointmentScope,
              startsAt: { gte: todayRange.startsAt, lt: attentionEndsAt },
              status: {
                notIn: [
                  AppointmentStatus.canceled,
                  AppointmentStatus.rescheduled,
                  AppointmentStatus.completed,
                  AppointmentStatus.no_show
                ]
              },
              OR: [
                { status: AppointmentStatus.pending_admin_confirmation },
                {
                  attendanceConfirmationStatus: {
                    in: [
                      AttendanceConfirmationStatus.pending,
                      AttendanceConfirmationStatus.declined
                    ]
                  }
                }
              ]
            },
            include: dashboardAppointmentInclude,
            orderBy: { startsAt: "asc" }
          }),
          database!.service.count({ where: { isActive: true } }),
          database!.workingHour.count({
            where: staffId ? { staffId, isActive: true } : { isActive: true }
          })
        ]);

      let clientCount: number;
      if (staffId) {
        const clients = await database!.appointment.findMany({
          where: { staffId },
          select: { clientId: true },
          distinct: ["clientId"]
        });
        clientCount = clients.length;
      } else {
        clientCount = await database!.client.count();
      }

      const visibleAppointments = appointments.filter(
        (appointment) =>
          appointment.status !== AppointmentStatus.canceled &&
          appointment.status !== AppointmentStatus.rescheduled
      );
      const busyMinutes = visibleAppointments.reduce(
        (total, appointment) =>
          total +
          Math.round(
            (appointment.endsAt.getTime() - appointment.startsAt.getTime()) /
              60000
          ),
        0
      );
      const alerts: DashboardAlert[] = attentionAppointments.map((appointment) => ({
        id: appointment.id,
        type:
          appointment.status === AppointmentStatus.pending_admin_confirmation
            ? "appointment_confirmation"
            : "attendance_confirmation",
        startsAt: appointment.startsAt,
        clientName: appointment.client.fullName ?? appointment.client.phone,
        serviceName: appointment.service.titleRu
      }));

      if (staffHours === 0) {
        alerts.push({
          id: "schedule-not-configured",
          type: "schedule_missing",
          startsAt: todayRange.startsAt,
          clientName: "Рабочие часы не заданы",
          serviceName: "Заполните график мастера перед открытием онлайн-записи"
        });
      }

      return {
        date: today,
        timezone: businessConfig.timezone,
        displayName: request.crmUser!.displayName,
        metrics: {
          appointmentsToday: visibleAppointments.length,
          busyMinutes,
          attention: alerts.length,
          clients: clientCount,
          activeServices
        },
        appointments: visibleAppointments,
        alerts
      };
    }
  );
}
