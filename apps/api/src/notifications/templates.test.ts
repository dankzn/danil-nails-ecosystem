import assert from "node:assert/strict";
import { test } from "node:test";
import {
  notificationTemplateCodes,
  renderNotification,
  resolveTelegramLocale
} from "./templates.js";

const basePayload = {
  appointmentId: "appt_1",
  serviceTitle: "Маникюр с покрытием",
  staffName: "Аида",
  startsAt: "2026-11-10T09:00:00.000Z"
};

test("renderNotification produces non-empty, locale-specific text for every code and locale", () => {
  for (const code of notificationTemplateCodes) {
    for (const locale of ["ru", "en", "es", "fr"] as const) {
      const text = renderNotification(code, { ...basePayload, locale });
      assert.ok(text.includes(basePayload.serviceTitle));
      assert.ok(text.includes(basePayload.staffName));
      assert.ok(text.length > 0);
    }
  }
});

test("renderNotification varies by locale", () => {
  const ru = renderNotification("booking_confirmation", { ...basePayload, locale: "ru" });
  const en = renderNotification("booking_confirmation", { ...basePayload, locale: "en" });
  assert.notEqual(ru, en);
});

test("resolveTelegramLocale maps known language codes and falls back to ru", () => {
  assert.equal(resolveTelegramLocale("en"), "en");
  assert.equal(resolveTelegramLocale("en-US"), "en");
  assert.equal(resolveTelegramLocale("es-MX"), "es");
  assert.equal(resolveTelegramLocale("fr"), "fr");
  assert.equal(resolveTelegramLocale("ru"), "ru");
  assert.equal(resolveTelegramLocale("de"), "ru");
  assert.equal(resolveTelegramLocale(undefined), "ru");
});
