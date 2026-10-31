import { Locale } from "@danil-nails/db";
import { businessConfig } from "@danil-nails/shared";

export const notificationTemplateCodes = [
  "booking_confirmation",
  "booking_reminder",
  "booking_canceled"
] as const;

export type NotificationTemplateCode = (typeof notificationTemplateCodes)[number];

export function isNotificationTemplateCode(
  value: string | null
): value is NotificationTemplateCode {
  return (
    value !== null &&
    (notificationTemplateCodes as readonly string[]).includes(value)
  );
}

export type AppointmentNotificationPayload = {
  appointmentId: string;
  locale: Locale;
  serviceTitle: string;
  staffName: string;
  startsAt: string;
};

const intlLocaleTags: Record<Locale, string> = {
  ru: "ru-RU",
  en: "en-US",
  es: "es-ES",
  fr: "fr-FR"
};

function formatStartsAt(startsAtIso: string, locale: Locale) {
  return new Intl.DateTimeFormat(intlLocaleTags[locale], {
    timeZone: businessConfig.timezone,
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(startsAtIso));
}

type MessageBuilder = (service: string, staff: string, when: string) => string;

const appointmentMessages: Record<
  NotificationTemplateCode,
  Record<Locale, MessageBuilder>
> = {
  booking_confirmation: {
    ru: (service, staff, when) =>
      `Запись подтверждена ✅\n${service} у мастера ${staff}\n${when}\n${businessConfig.brandName}`,
    en: (service, staff, when) =>
      `Your appointment is confirmed ✅\n${service} with ${staff}\n${when}\n${businessConfig.brandName}`,
    es: (service, staff, when) =>
      `Tu cita está confirmada ✅\n${service} con ${staff}\n${when}\n${businessConfig.brandName}`,
    fr: (service, staff, when) =>
      `Votre rendez-vous est confirmé ✅\n${service} avec ${staff}\n${when}\n${businessConfig.brandName}`
  },
  booking_reminder: {
    ru: (service, staff, when) =>
      `Напоминаем о записи ⏰\n${service} у мастера ${staff}\n${when}\nЖдём вас!`,
    en: (service, staff, when) =>
      `Reminder about your appointment ⏰\n${service} with ${staff}\n${when}\nSee you soon!`,
    es: (service, staff, when) =>
      `Recordatorio de tu cita ⏰\n${service} con ${staff}\n${when}\n¡Te esperamos!`,
    fr: (service, staff, when) =>
      `Rappel de votre rendez-vous ⏰\n${service} avec ${staff}\n${when}\nÀ bientôt !`
  },
  booking_canceled: {
    ru: (service, staff, when) =>
      `Запись отменена\n${service} у мастера ${staff}\n${when}\nЕсли это ошибка — напишите нам.`,
    en: (service, staff, when) =>
      `Your appointment was canceled\n${service} with ${staff}\n${when}\nIf this is a mistake, please contact us.`,
    es: (service, staff, when) =>
      `Tu cita fue cancelada\n${service} con ${staff}\n${when}\nSi esto es un error, contáctanos.`,
    fr: (service, staff, when) =>
      `Votre rendez-vous a été annulé\n${service} avec ${staff}\n${when}\nSi c'est une erreur, contactez-nous.`
  }
};

export function renderNotification(
  code: NotificationTemplateCode,
  payload: AppointmentNotificationPayload
) {
  const when = formatStartsAt(payload.startsAt, payload.locale);
  return appointmentMessages[code][payload.locale](
    payload.serviceTitle,
    payload.staffName,
    when
  );
}

export const telegramBotMessages = {
  start: {
    ru: "Привет! Чтобы получать уведомления о записях, поделитесь номером телефона, указанным при записи.",
    en: "Hi! To receive appointment notifications, please share the phone number you booked with.",
    es: "¡Hola! Para recibir notificaciones de tus citas, comparte el número de teléfono con el que reservaste.",
    fr: "Bonjour ! Pour recevoir les notifications de rendez-vous, partagez le numéro de téléphone utilisé pour la réservation."
  } satisfies Record<Locale, string>,
  shareButton: {
    ru: "Поделиться номером",
    en: "Share phone number",
    es: "Compartir número",
    fr: "Partager le numéro"
  } satisfies Record<Locale, string>,
  linked: {
    ru: "Готово! Теперь уведомления о записях будут приходить сюда.",
    en: "All set! Appointment notifications will now be sent here.",
    es: "¡Listo! Las notificaciones de tus citas llegarán aquí.",
    fr: "C'est fait ! Les notifications de rendez-vous arriveront ici."
  } satisfies Record<Locale, string>,
  notFound: {
    ru: "Не нашли клиента с этим номером телефона. Проверьте номер или запишитесь на сайте.",
    en: "We couldn't find a client with that phone number. Please check it or book online first.",
    es: "No encontramos un cliente con ese número. Revísalo o reserva primero en línea.",
    fr: "Nous n'avons trouvé aucun client avec ce numéro. Vérifiez-le ou réservez d'abord en ligne."
  } satisfies Record<Locale, string>,
  mismatch: {
    ru: "Пожалуйста, поделитесь своим собственным номером телефона.",
    en: "Please share your own phone number.",
    es: "Por favor, comparte tu propio número de teléfono.",
    fr: "Merci de partager votre propre numéro de téléphone."
  } satisfies Record<Locale, string>
};

export function resolveTelegramLocale(languageCode: string | undefined): Locale {
  const base = languageCode?.slice(0, 2).toLowerCase();
  if (base === "en" || base === "es" || base === "fr" || base === "ru") {
    return base;
  }
  return Locale.ru;
}
