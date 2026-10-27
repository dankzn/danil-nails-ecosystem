"use client";

import { useState, type FormEvent } from "react";
import type { Dictionary } from "../i18n/dictionary";
import { apiUrl } from "../lib/api-url";

type Status = "idle" | "submitting" | "success" | "error";

export function RegisterForm({ dict }: { dict: Dictionary["register"] }) {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");

    if (password !== confirmPassword) {
      setStatus("error");
      setErrorMessage(dict.errorPasswordMismatch);
      return;
    }

    setStatus("submitting");

    try {
      const response = await fetch(`${apiUrl}/v1/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          fullName: form.get("fullName"),
          phone: form.get("phone"),
          email: form.get("email"),
          password
        })
      });

      if (response.ok) {
        setStatus("success");
        return;
      }

      if (response.status === 409) {
        setStatus("error");
        setErrorMessage(dict.errorExists);
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
    <form className="register-form" onSubmit={handleSubmit}>
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
        <input id="email" name="email" type="email" required maxLength={200} />
      </div>

      <div className="register-field">
        <label htmlFor="password">{dict.passwordLabel}</label>
        <input id="password" name="password" type="password" required minLength={12} maxLength={256} />
        <span className="register-hint">{dict.passwordHint}</span>
      </div>

      <div className="register-field">
        <label htmlFor="confirmPassword">{dict.confirmPasswordLabel}</label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          minLength={12}
          maxLength={256}
        />
      </div>

      {status === "error" && errorMessage ? (
        <p className="register-error" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <button type="submit" className="btn btn-solid register-submit" disabled={status === "submitting"}>
        <span>{status === "submitting" ? dict.submittingLabel : dict.submitLabel}</span>
      </button>
    </form>
  );
}
