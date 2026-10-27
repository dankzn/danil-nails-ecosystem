"use client";

import { useState, type FormEvent } from "react";
import type { Dictionary } from "../i18n/dictionary";
import type { Locale } from "../i18n/locales";
import { apiUrl } from "../lib/api-url";

type Status = "idle" | "submitting" | "error";

export function LoginForm({ dict, lang }: { dict: Dictionary["login"]; lang: Locale }) {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setStatus("submitting");

    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch(`${apiUrl}/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: form.get("email"),
          password: form.get("password")
        })
      });

      if (response.ok) {
        window.location.href = `/${lang}/account/`;
        return;
      }

      if (response.status === 401) {
        setStatus("error");
        setErrorMessage(dict.errorInvalid);
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

  return (
    <form className="register-form" onSubmit={handleSubmit}>
      <div className="register-field">
        <label htmlFor="email">{dict.emailLabel}</label>
        <input id="email" name="email" type="email" required maxLength={200} />
      </div>

      <div className="register-field">
        <label htmlFor="password">{dict.passwordLabel}</label>
        <input id="password" name="password" type="password" required maxLength={256} />
      </div>

      {status === "error" && errorMessage ? (
        <p className="register-error" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <button type="submit" className="btn btn-solid register-submit" disabled={status === "submitting"}>
        <span>{status === "submitting" ? dict.submittingLabel : dict.submitLabel}</span>
      </button>

      <p className="register-hint">
        {dict.registerPrompt} <a href={`/${lang}/register/`}>{dict.registerLink}</a>
      </p>
    </form>
  );
}
