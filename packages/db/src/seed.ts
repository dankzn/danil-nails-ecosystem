import { resolve } from "node:path";
import { config } from "dotenv";
import { initialServices } from "@danil-nails/shared";
import { createDatabaseClient } from "./client.js";
import { Currency, UserRole } from "./generated/client/client.js";
import { hashPassword } from "./security.js";

config({
  path: [resolve(process.cwd(), ".env"), resolve(process.cwd(), "../../.env")],
  quiet: true
});

function requiredEnvironmentValue(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

const databaseUrl = requiredEnvironmentValue("DATABASE_URL");
const ownerEmail = requiredEnvironmentValue("SEED_OWNER_EMAIL").toLowerCase();
const ownerPassword = requiredEnvironmentValue("SEED_OWNER_PASSWORD");
const ownerName = process.env.SEED_OWNER_NAME?.trim() || "Данил Афлиатов";

const prisma = createDatabaseClient(databaseUrl);

async function seed() {
  const passwordHash = await hashPassword(ownerPassword);

  const owner = await prisma.user.upsert({
    where: { email: ownerEmail },
    update: {
      isActive: true,
      passwordHash,
      role: UserRole.owner
    },
    create: {
      email: ownerEmail,
      isActive: true,
      passwordHash,
      role: UserRole.owner
    }
  });

  await prisma.session.deleteMany({ where: { userId: owner.id } });

  const staff = await prisma.staffProfile.upsert({
    where: { userId: owner.id },
    update: {
      displayName: ownerName,
      isBookable: true
    },
    create: {
      userId: owner.id,
      displayName: ownerName,
      isBookable: true
    }
  });

  await prisma.clientLoyaltyStatus.upsert({
    where: { code: "guest" },
    update: { titleRu: "Гость", titleEn: "Guest", titleEs: "Invitado" },
    create: {
      code: "guest",
      titleRu: "Гость",
      titleEn: "Guest",
      titleEs: "Invitado"
    }
  });

  await prisma.clientLoyaltyStatus.upsert({
    where: { code: "regular" },
    update: {
      titleRu: "Постоянный клиент",
      titleEn: "Regular client",
      titleEs: "Cliente habitual"
    },
    create: {
      code: "regular",
      titleRu: "Постоянный клиент",
      titleEn: "Regular client",
      titleEs: "Cliente habitual"
    }
  });

  for (const service of initialServices) {
    const savedService = await prisma.service.upsert({
      where: { slug: service.slug },
      update: {
        durationMinutes: service.defaultDurationMinutes,
        isActive: true,
        titleEn: service.name.en,
        titleEs: service.name.es,
        titleRu: service.name.ru
      },
      create: {
        slug: service.slug,
        durationMinutes: service.defaultDurationMinutes,
        isActive: true,
        titleEn: service.name.en,
        titleEs: service.name.es,
        titleRu: service.name.ru
      }
    });

    for (const price of service.prices) {
      await prisma.servicePrice.upsert({
        where: {
          serviceId_currency: {
            serviceId: savedService.id,
            currency: Currency[price.currency]
          }
        },
        update: { amountMinor: price.amountMinor },
        create: {
          serviceId: savedService.id,
          currency: Currency[price.currency],
          amountMinor: price.amountMinor
        }
      });
    }

    await prisma.staffService.upsert({
      where: {
        staffId_serviceId: {
          staffId: staff.id,
          serviceId: savedService.id
        }
      },
      update: {},
      create: {
        staffId: staff.id,
        serviceId: savedService.id
      }
    });
  }

  console.info(
    `Seed completed: owner ${ownerEmail}, ${initialServices.length} services`
  );
}

try {
  await seed();
} finally {
  await prisma.$disconnect();
}
