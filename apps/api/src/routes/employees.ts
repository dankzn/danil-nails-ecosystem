import {
  Currency,
  EmployeeDocumentType,
  EmployeeEventType,
  EmployeeNoteCategory,
  EmploymentStatus,
  EmploymentType,
  Prisma,
  TrainingStatus,
  UserRole,
  type DatabaseClient
} from "@danil-nails/db";
import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { authorize } from "../auth/session.js";
import { currentMonthKey, payrollPreview } from "../payroll/calculation.js";

const dateSchema = z.iso.date().nullable().optional();
const optionalEmailSchema = z.union([z.email(), z.literal("")]).nullable().optional();
const staffRoleSchema = z.enum(["admin", "master"]);
const employmentStatusSchema = z.enum(["active", "probation", "leave"]);
const employmentTypeSchema = z.enum([
  "full_time",
  "part_time",
  "contractor",
  "intern"
]);
const idSchema = z.object({ id: z.string().cuid() });
const childIdSchema = z.object({ id: z.string().cuid(), childId: z.string().cuid() });
const employeeQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  status: z
    .enum(["all", "active", "probation", "leave", "dismissed"])
    .default("all")
});

const employeeCreateSchema = z.object({
  displayName: z.string().trim().min(2).max(120),
  legalName: z.string().trim().max(160).nullable().optional(),
  email: optionalEmailSchema,
  phone: z.string().trim().max(30).nullable().optional(),
  role: staffRoleSchema.default("master"),
  positionId: z.string().cuid().nullable().optional(),
  primaryOrgUnitId: z.string().cuid().nullable().optional(),
  primaryOrganizationId: z.string().cuid().nullable().optional(),
  cityId: z.string().cuid().nullable().optional(),
  countryId: z.string().cuid().nullable().optional(),
  employmentStatus: employmentStatusSchema.default("active"),
  employmentType: employmentTypeSchema.default("full_time"),
  hiredAt: dateSchema,
  probationEndsAt: dateSchema,
  dateOfBirth: dateSchema,
  workPhone: z.string().trim().max(30).nullable().optional(),
  personalEmail: optionalEmailSchema,
  address: z.string().trim().max(500).nullable().optional(),
  emergencyContactName: z.string().trim().max(160).nullable().optional(),
  emergencyContactPhone: z.string().trim().max(30).nullable().optional(),
  bio: z.string().trim().max(2000).nullable().optional(),
  isBookable: z.boolean().default(true),
  serviceIds: z.array(z.string().cuid()).max(100).default([])
});

const employeeUpdateSchema = employeeCreateSchema
  .omit({ serviceIds: true, role: true, employmentStatus: true, employmentType: true, isBookable: true })
  .partial()
  .extend({
    // z.default() survives .partial() (an omitted key still resolves to the
    // default instead of undefined), which silently reset these fields to
    // their create-time defaults on every single-field edit. Redeclare them
    // without a default so "omitted" genuinely means "leave unchanged".
    serviceIds: z.array(z.string().cuid()).max(100).optional(),
    role: staffRoleSchema.optional(),
    employmentStatus: employmentStatusSchema.optional(),
    employmentType: employmentTypeSchema.optional(),
    isBookable: z.boolean().optional()
  });

const dismissalSchema = z.object({
  dismissedAt: z.iso.date(),
  reason: z.string().trim().min(2).max(1000)
});
const rehireSchema = z.object({
  hiredAt: z.iso.date(),
  employmentStatus: z.enum(["active", "probation"]).default("active"),
  reason: z.string().trim().max(1000).nullable().optional(),
  isBookable: z.boolean().default(true)
});
const noteSchema = z.object({
  category: z
    .enum(["general", "performance", "recognition", "incident", "hr"])
    .default("general"),
  title: z.string().trim().max(160).nullable().optional(),
  body: z.string().trim().min(2).max(5000),
  eventDate: dateSchema
});
const trainingSchema = z.object({
  title: z.string().trim().min(2).max(200),
  provider: z.string().trim().max(200).nullable().optional(),
  status: z
    .enum(["planned", "in_progress", "completed", "canceled"])
    .default("planned"),
  startsAt: dateSchema,
  endsAt: dateSchema,
  completedAt: dateSchema,
  costMinor: z.number().int().nonnegative().nullable().optional(),
  currency: z.enum(["RUB", "EUR", "USD"]).nullable().optional(),
  certificateUrl: z.union([z.url(), z.literal("")]).nullable().optional(),
  notes: z.string().trim().max(3000).nullable().optional()
});
const trainingUpdateSchema = trainingSchema.partial();
const documentSchema = z.object({
  type: z.enum([
    "employment_contract",
    "nda",
    "consent",
    "medical_book",
    "certificate",
    "other"
  ]),
  title: z.string().trim().min(2).max(200),
  issuedAt: dateSchema,
  expiresAt: dateSchema,
  notes: z.string().trim().max(2000).nullable().optional()
});

const employeeListInclude = {
  user: {
    select: {
      id: true,
      role: true,
      email: true,
      phone: true,
      isActive: true,
      passwordHash: true
    }
  },
  position: { select: { id: true, title: true } },
  primaryOrgUnit: { select: { id: true, title: true } },
  primaryOrganization: { select: { id: true, title: true } },
  city: { select: { id: true, title: true } },
  country: { select: { id: true, title: true } },
  services: {
    include: {
      service: { select: { id: true, titleRu: true, isActive: true } }
    }
  },
  _count: {
    select: {
      appointments: true,
      employeeNotes: true,
      trainings: true,
      documents: true
    }
  }
} satisfies Prisma.StaffProfileInclude;

const employeeDetailInclude = {
  ...employeeListInclude,
  employeeNotes: {
    include: {
      createdBy: {
        select: { staffProfile: { select: { displayName: true } } }
      }
    },
    orderBy: [{ eventDate: "desc" }, { createdAt: "desc" }]
  },
  trainings: { orderBy: [{ startsAt: "desc" }, { createdAt: "desc" }] },
  documents: { orderBy: [{ expiresAt: "asc" }, { createdAt: "desc" }] },
  employeeEvents: {
    include: {
      actor: { select: { staffProfile: { select: { displayName: true } } } }
    },
    orderBy: { occurredAt: "desc" },
    take: 100
  }
} satisfies Prisma.StaffProfileInclude;

function optionalText(value: string | null | undefined) {
  return value?.trim() || null;
}

function dateValue(value: string | null | undefined) {
  if (!value) return null;
  return new Date(`${value}T12:00:00.000Z`);
}

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

function sendInvalidPayload(reply: FastifyReply) {
  return reply.code(400).send({ error: "invalid_employee_payload" });
}

function serializeEmployee<T extends { user: { passwordHash: string | null } }>(employee: T) {
  const { passwordHash, ...user } = employee.user;
  return { ...employee, user: { ...user, accountReady: Boolean(passwordHash) } };
}

function profileData(input: z.infer<typeof employeeUpdateSchema>) {
  return {
    ...(input.legalName !== undefined ? { legalName: optionalText(input.legalName) } : {}),
    ...(input.positionId !== undefined ? { positionId: input.positionId } : {}),
    ...(input.primaryOrgUnitId !== undefined
      ? { primaryOrgUnitId: input.primaryOrgUnitId }
      : {}),
    ...(input.primaryOrganizationId !== undefined
      ? { primaryOrganizationId: input.primaryOrganizationId }
      : {}),
    ...(input.cityId !== undefined ? { cityId: input.cityId } : {}),
    ...(input.countryId !== undefined ? { countryId: input.countryId } : {}),
    ...(input.bio !== undefined ? { bio: optionalText(input.bio) } : {}),
    ...(input.employmentStatus !== undefined
      ? { employmentStatus: EmploymentStatus[input.employmentStatus] }
      : {}),
    ...(input.employmentType !== undefined
      ? { employmentType: EmploymentType[input.employmentType] }
      : {}),
    ...(input.hiredAt !== undefined ? { hiredAt: dateValue(input.hiredAt) } : {}),
    ...(input.probationEndsAt !== undefined
      ? { probationEndsAt: dateValue(input.probationEndsAt) }
      : {}),
    ...(input.dateOfBirth !== undefined
      ? { dateOfBirth: dateValue(input.dateOfBirth) }
      : {}),
    ...(input.workPhone !== undefined ? { workPhone: optionalText(input.workPhone) } : {}),
    ...(input.personalEmail !== undefined
      ? { personalEmail: optionalText(input.personalEmail)?.toLowerCase() ?? null }
      : {}),
    ...(input.address !== undefined ? { address: optionalText(input.address) } : {}),
    ...(input.emergencyContactName !== undefined
      ? { emergencyContactName: optionalText(input.emergencyContactName) }
      : {}),
    ...(input.emergencyContactPhone !== undefined
      ? { emergencyContactPhone: optionalText(input.emergencyContactPhone) }
      : {}),
    ...(input.isBookable !== undefined ? { isBookable: input.isBookable } : {})
  };
}

async function validateServices(database: DatabaseClient, serviceIds: string[]) {
  if (serviceIds.length === 0) return true;
  const uniqueIds = [...new Set(serviceIds)];
  const count = await database.service.count({ where: { id: { in: uniqueIds } } });
  return count === uniqueIds.length;
}

export function registerEmployeeRoutes(
  server: FastifyInstance,
  database: DatabaseClient | null
) {
  const ownerGuard = authorize(database, [UserRole.owner]);

  server.get(
    "/v1/owner/employees",
    { preHandler: ownerGuard },
    async (request, reply) => {
      const query = employeeQuerySchema.safeParse(request.query);
      if (!query.success) return sendInvalidPayload(reply);

      const where: Prisma.StaffProfileWhereInput = {
        ...(query.data.status !== "all"
          ? { employmentStatus: EmploymentStatus[query.data.status] }
          : {}),
        ...(query.data.search
          ? {
              OR: [
                { displayName: { contains: query.data.search, mode: "insensitive" } },
                { legalName: { contains: query.data.search, mode: "insensitive" } },
                { position: { title: { contains: query.data.search, mode: "insensitive" } } },
                { user: { email: { contains: query.data.search, mode: "insensitive" } } }
              ]
            }
          : {})
      };

      const [employees, allEmployees, pendingTrainings, services] = await Promise.all([
        database!.staffProfile.findMany({
          where,
          include: employeeListInclude,
          orderBy: [{ employmentStatus: "asc" }, { displayName: "asc" }]
        }),
        database!.staffProfile.groupBy({
          by: ["employmentStatus"],
          _count: { _all: true }
        }),
        database!.employeeTraining.count({
          where: { status: { in: [TrainingStatus.planned, TrainingStatus.in_progress] } }
        }),
        database!.service.findMany({
          select: { id: true, titleRu: true, isActive: true },
          orderBy: { titleRu: "asc" }
        })
      ]);

      const statusCount = Object.fromEntries(
        allEmployees.map((item) => [item.employmentStatus, item._count._all])
      );
      const payrollMonth = currentMonthKey();
      const payrollContexts = await Promise.all(
        employees.map((employee) =>
          payrollPreview(database!, employee.id, payrollMonth)
        )
      );
      const payrollByStaffId = new Map(
        payrollContexts
          .filter((context) => context !== null)
          .map((context) => [context.staff.id, context])
      );
      return {
        employees: employees.map((employee) => {
          const context = payrollByStaffId.get(employee.id);
          const payroll = context?.payroll;
          return {
            ...serializeEmployee(employee),
            payrollSummary: context
              ? {
                  month: payrollMonth,
                  currency: payroll?.currency ?? context.preview.currency,
                  accruedMinor:
                    payroll?.totalAccruedMinor ?? context.preview.totalMinor,
                  paidMinor: payroll?.totalPaidMinor ?? 0,
                  status: payroll?.status ?? "not_accrued"
                }
              : null
          };
        }),
        services,
        payrollMonth,
        metrics: {
          active: statusCount.active ?? 0,
          probation: statusCount.probation ?? 0,
          leave: statusCount.leave ?? 0,
          dismissed: statusCount.dismissed ?? 0,
          pendingTrainings
        }
      };
    }
  );

  server.get(
    "/v1/owner/employees/:id",
    { preHandler: ownerGuard },
    async (request, reply) => {
      const parameters = idSchema.safeParse(request.params);
      if (!parameters.success) return sendInvalidPayload(reply);
      const employee = await database!.staffProfile.findUnique({
        where: { id: parameters.data.id },
        include: employeeDetailInclude
      });
      if (!employee) return reply.code(404).send({ error: "employee_not_found" });
      return { employee: serializeEmployee(employee) };
    }
  );

  server.post(
    "/v1/owner/employees",
    { preHandler: ownerGuard },
    async (request, reply) => {
      const input = employeeCreateSchema.safeParse(request.body);
      if (!input.success) return sendInvalidPayload(reply);
      if (!(await validateServices(database!, input.data.serviceIds))) {
        return reply.code(400).send({ error: "invalid_employee_services" });
      }

      try {
        const employee = await database!.$transaction(async (transaction) => {
          const user = await transaction.user.create({
            data: {
              role: UserRole[input.data.role],
              email: optionalText(input.data.email)?.toLowerCase() ?? null,
              phone: optionalText(input.data.phone),
              isActive: true
            }
          });
          const staff = await transaction.staffProfile.create({
            data: {
              userId: user.id,
              displayName: input.data.displayName,
              ...profileData(input.data),
              services: {
                create: [...new Set(input.data.serviceIds)].map((serviceId) => ({
                  serviceId
                }))
              }
            }
          });
          await transaction.employeeEvent.create({
            data: {
              staffId: staff.id,
              type: EmployeeEventType.hired,
              occurredAt: dateValue(input.data.hiredAt) ?? new Date(),
              actorUserId: request.crmUser!.id,
              details: {
                role: input.data.role,
                employmentType: input.data.employmentType,
                employmentStatus: input.data.employmentStatus
              }
            }
          });
          return transaction.staffProfile.findUniqueOrThrow({
            where: { id: staff.id },
            include: employeeDetailInclude
          });
        });
        return reply.code(201).send({ employee: serializeEmployee(employee) });
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          return reply.code(409).send({ error: "employee_contact_already_exists" });
        }
        throw error;
      }
    }
  );

  server.patch(
    "/v1/owner/employees/:id",
    { preHandler: ownerGuard },
    async (request, reply) => {
      const parameters = idSchema.safeParse(request.params);
      const input = employeeUpdateSchema.safeParse(request.body);
      if (!parameters.success || !input.success) return sendInvalidPayload(reply);
      if (
        input.data.serviceIds &&
        !(await validateServices(database!, input.data.serviceIds))
      ) {
        return reply.code(400).send({ error: "invalid_employee_services" });
      }

      const current = await database!.staffProfile.findUnique({
        where: { id: parameters.data.id },
        include: { user: true }
      });
      if (!current) return reply.code(404).send({ error: "employee_not_found" });
      if (current.user.role === UserRole.owner && input.data.role !== undefined) {
        return reply.code(409).send({ error: "owner_employee_protected" });
      }

      try {
        const employee = await database!.$transaction(async (transaction) => {
          const nextRole = input.data.role
            ? UserRole[input.data.role]
            : current.user.role;
          await transaction.user.update({
            where: { id: current.userId },
            data: {
              ...(input.data.email !== undefined
                ? { email: optionalText(input.data.email)?.toLowerCase() ?? null }
                : {}),
              ...(input.data.phone !== undefined
                ? { phone: optionalText(input.data.phone) }
                : {}),
              ...(input.data.role !== undefined ? { role: nextRole } : {})
            }
          });
          await transaction.staffProfile.update({
            where: { id: current.id },
            data: {
              ...(input.data.displayName !== undefined
                ? { displayName: input.data.displayName }
                : {}),
              ...profileData(input.data)
            }
          });

          if (input.data.serviceIds) {
            await transaction.staffService.deleteMany({ where: { staffId: current.id } });
            if (input.data.serviceIds.length) {
              await transaction.staffService.createMany({
                data: [...new Set(input.data.serviceIds)].map((serviceId) => ({
                  staffId: current.id,
                  serviceId
                }))
              });
            }
          }

          if (
            input.data.employmentStatus &&
            input.data.employmentStatus !== current.employmentStatus
          ) {
            const eventType =
              input.data.employmentStatus === "leave"
                ? EmployeeEventType.leave_started
                : current.employmentStatus === EmploymentStatus.leave
                  ? EmployeeEventType.leave_ended
                  : EmployeeEventType.status_changed;
            await transaction.employeeEvent.create({
              data: {
                staffId: current.id,
                type: eventType,
                actorUserId: request.crmUser!.id,
                details: {
                  from: current.employmentStatus,
                  to: input.data.employmentStatus
                }
              }
            });
          }
          if (input.data.role && nextRole !== current.user.role) {
            await transaction.employeeEvent.create({
              data: {
                staffId: current.id,
                type: EmployeeEventType.role_changed,
                actorUserId: request.crmUser!.id,
                details: { from: current.user.role, to: nextRole }
              }
            });
          }

          return transaction.staffProfile.findUniqueOrThrow({
            where: { id: current.id },
            include: employeeDetailInclude
          });
        });
        return { employee: serializeEmployee(employee) };
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          return reply.code(409).send({ error: "employee_contact_already_exists" });
        }
        throw error;
      }
    }
  );

  server.post(
    "/v1/owner/employees/:id/dismiss",
    { preHandler: ownerGuard },
    async (request, reply) => {
      const parameters = idSchema.safeParse(request.params);
      const input = dismissalSchema.safeParse(request.body);
      if (!parameters.success || !input.success) return sendInvalidPayload(reply);
      const current = await database!.staffProfile.findUnique({
        where: { id: parameters.data.id },
        include: { user: true }
      });
      if (!current) return reply.code(404).send({ error: "employee_not_found" });
      if (current.user.role === UserRole.owner) {
        return reply.code(409).send({ error: "owner_employee_protected" });
      }

      const employee = await database!.$transaction(async (transaction) => {
        await transaction.session.deleteMany({ where: { userId: current.userId } });
        await transaction.user.update({
          where: { id: current.userId },
          data: { isActive: false }
        });
        await transaction.staffProfile.update({
          where: { id: current.id },
          data: {
            employmentStatus: EmploymentStatus.dismissed,
            dismissedAt: dateValue(input.data.dismissedAt),
            isBookable: false
          }
        });
        await transaction.employeeEvent.create({
          data: {
            staffId: current.id,
            type: EmployeeEventType.dismissed,
            occurredAt: dateValue(input.data.dismissedAt) ?? new Date(),
            reason: input.data.reason,
            actorUserId: request.crmUser!.id
          }
        });
        return transaction.staffProfile.findUniqueOrThrow({
          where: { id: current.id },
          include: employeeDetailInclude
        });
      });
      return { employee: serializeEmployee(employee) };
    }
  );

  server.post(
    "/v1/owner/employees/:id/rehire",
    { preHandler: ownerGuard },
    async (request, reply) => {
      const parameters = idSchema.safeParse(request.params);
      const input = rehireSchema.safeParse(request.body);
      if (!parameters.success || !input.success) return sendInvalidPayload(reply);
      const current = await database!.staffProfile.findUnique({
        where: { id: parameters.data.id },
        include: { user: true }
      });
      if (!current) return reply.code(404).send({ error: "employee_not_found" });
      if (current.employmentStatus !== EmploymentStatus.dismissed) {
        return reply.code(409).send({ error: "employee_not_dismissed" });
      }

      const employee = await database!.$transaction(async (transaction) => {
        await transaction.user.update({
          where: { id: current.userId },
          data: { isActive: true }
        });
        await transaction.staffProfile.update({
          where: { id: current.id },
          data: {
            employmentStatus: EmploymentStatus[input.data.employmentStatus],
            hiredAt: dateValue(input.data.hiredAt),
            dismissedAt: null,
            isBookable: input.data.isBookable
          }
        });
        await transaction.employeeEvent.create({
          data: {
            staffId: current.id,
            type: EmployeeEventType.rehired,
            occurredAt: dateValue(input.data.hiredAt) ?? new Date(),
            reason: input.data.reason ?? null,
            actorUserId: request.crmUser!.id
          }
        });
        return transaction.staffProfile.findUniqueOrThrow({
          where: { id: current.id },
          include: employeeDetailInclude
        });
      });
      return { employee: serializeEmployee(employee) };
    }
  );

  server.post(
    "/v1/owner/employees/:id/notes",
    { preHandler: ownerGuard },
    async (request, reply) => {
      const parameters = idSchema.safeParse(request.params);
      const input = noteSchema.safeParse(request.body);
      if (!parameters.success || !input.success) return sendInvalidPayload(reply);
      const exists = await database!.staffProfile.findUnique({
        where: { id: parameters.data.id },
        select: { id: true }
      });
      if (!exists) return reply.code(404).send({ error: "employee_not_found" });
      const note = await database!.employeeNote.create({
        data: {
          staffId: exists.id,
          category: EmployeeNoteCategory[input.data.category],
          title: optionalText(input.data.title),
          body: input.data.body,
          eventDate: dateValue(input.data.eventDate),
          createdByUserId: request.crmUser!.id
        }
      });
      return reply.code(201).send({ note });
    }
  );

  server.delete(
    "/v1/owner/employees/:id/notes/:childId",
    { preHandler: ownerGuard },
    async (request, reply) => {
      const parameters = childIdSchema.safeParse(request.params);
      if (!parameters.success) return sendInvalidPayload(reply);
      const result = await database!.employeeNote.deleteMany({
        where: { id: parameters.data.childId, staffId: parameters.data.id }
      });
      if (!result.count) return reply.code(404).send({ error: "employee_note_not_found" });
      return reply.code(204).send();
    }
  );

  server.post(
    "/v1/owner/employees/:id/trainings",
    { preHandler: ownerGuard },
    async (request, reply) => {
      const parameters = idSchema.safeParse(request.params);
      const input = trainingSchema.safeParse(request.body);
      if (!parameters.success || !input.success) return sendInvalidPayload(reply);
      const training = await database!.employeeTraining.create({
        data: {
          staffId: parameters.data.id,
          title: input.data.title,
          provider: optionalText(input.data.provider),
          status: TrainingStatus[input.data.status],
          startsAt: dateValue(input.data.startsAt),
          endsAt: dateValue(input.data.endsAt),
          completedAt: dateValue(input.data.completedAt),
          costMinor: input.data.costMinor ?? null,
          currency: input.data.currency ? Currency[input.data.currency] : null,
          certificateUrl: optionalText(input.data.certificateUrl),
          notes: optionalText(input.data.notes)
        }
      });
      return reply.code(201).send({ training });
    }
  );

  server.patch(
    "/v1/owner/employees/:id/trainings/:childId",
    { preHandler: ownerGuard },
    async (request, reply) => {
      const parameters = childIdSchema.safeParse(request.params);
      const input = trainingUpdateSchema.safeParse(request.body);
      if (!parameters.success || !input.success) return sendInvalidPayload(reply);
      const current = await database!.employeeTraining.findFirst({
        where: { id: parameters.data.childId, staffId: parameters.data.id }
      });
      if (!current) return reply.code(404).send({ error: "employee_training_not_found" });
      const training = await database!.employeeTraining.update({
        where: { id: current.id },
        data: {
          ...(input.data.title !== undefined ? { title: input.data.title } : {}),
          ...(input.data.provider !== undefined
            ? { provider: optionalText(input.data.provider) }
            : {}),
          ...(input.data.status !== undefined
            ? { status: TrainingStatus[input.data.status] }
            : {}),
          ...(input.data.startsAt !== undefined
            ? { startsAt: dateValue(input.data.startsAt) }
            : {}),
          ...(input.data.endsAt !== undefined
            ? { endsAt: dateValue(input.data.endsAt) }
            : {}),
          ...(input.data.completedAt !== undefined
            ? { completedAt: dateValue(input.data.completedAt) }
            : {}),
          ...(input.data.costMinor !== undefined
            ? { costMinor: input.data.costMinor }
            : {}),
          ...(input.data.currency !== undefined
            ? {
                currency: input.data.currency
                  ? Currency[input.data.currency]
                  : null
              }
            : {}),
          ...(input.data.certificateUrl !== undefined
            ? { certificateUrl: optionalText(input.data.certificateUrl) }
            : {}),
          ...(input.data.notes !== undefined
            ? { notes: optionalText(input.data.notes) }
            : {})
        }
      });
      return { training };
    }
  );

  server.delete(
    "/v1/owner/employees/:id/trainings/:childId",
    { preHandler: ownerGuard },
    async (request, reply) => {
      const parameters = childIdSchema.safeParse(request.params);
      if (!parameters.success) return sendInvalidPayload(reply);
      const result = await database!.employeeTraining.deleteMany({
        where: { id: parameters.data.childId, staffId: parameters.data.id }
      });
      if (!result.count) {
        return reply.code(404).send({ error: "employee_training_not_found" });
      }
      return reply.code(204).send();
    }
  );

  server.post(
    "/v1/owner/employees/:id/documents",
    { preHandler: ownerGuard },
    async (request, reply) => {
      const parameters = idSchema.safeParse(request.params);
      const input = documentSchema.safeParse(request.body);
      if (!parameters.success || !input.success) return sendInvalidPayload(reply);
      const document = await database!.employeeDocument.create({
        data: {
          staffId: parameters.data.id,
          type: EmployeeDocumentType[input.data.type],
          title: input.data.title,
          issuedAt: dateValue(input.data.issuedAt),
          expiresAt: dateValue(input.data.expiresAt),
          notes: optionalText(input.data.notes)
        }
      });
      return reply.code(201).send({ document });
    }
  );

  server.delete(
    "/v1/owner/employees/:id/documents/:childId",
    { preHandler: ownerGuard },
    async (request, reply) => {
      const parameters = childIdSchema.safeParse(request.params);
      if (!parameters.success) return sendInvalidPayload(reply);
      const result = await database!.employeeDocument.deleteMany({
        where: { id: parameters.data.childId, staffId: parameters.data.id }
      });
      if (!result.count) {
        return reply.code(404).send({ error: "employee_document_not_found" });
      }
      return reply.code(204).send();
    }
  );
}
