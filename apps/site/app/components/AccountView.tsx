"use client";

import type { Dictionary } from "../i18n/dictionary";
import type { Locale } from "../i18n/locales";
import { apiUrl } from "../lib/api-url";
import { useAuthStatus } from "../lib/use-auth";
import { AllergiesEditor } from "./AllergiesEditor";

export function AccountView({ dict, lang }: { dict: Dictionary["account"]; lang: Locale }) {
  const auth = useAuthStatus();

  async function handleLogout() {
    await fetch(`${apiUrl}/v1/auth/logout`, {
      method: "POST",
      credentials: "include"
    });
    window.location.href = `/${lang}/`;
  }

  if (auth.status === "loading") {
    return <p className="section-lede">{dict.loadingLabel}</p>;
  }

  if (auth.status === "signed-out") {
    return (
      <p className="section-lede">
        {dict.signedOutMessage} <a href={`/${lang}/login/`}>{dict.loginLink}</a>
      </p>
    );
  }

  const { user } = auth;

  return (
    <div className="account-panel">
      {user.displayName ? <p className="account-welcome">{user.displayName}</p> : null}

      <dl className="account-facts">
        {user.email ? (
          <div className="account-fact">
            <dt>{dict.emailLabel}</dt>
            <dd>{user.email}</dd>
          </div>
        ) : null}
        {user.phone ? (
          <div className="account-fact">
            <dt>{dict.phoneLabel}</dt>
            <dd>{user.phone}</dd>
          </div>
        ) : null}
      </dl>

      <section className="account-bookings">
        <h2>{dict.bookingsHeading}</h2>
        <p>{dict.bookingsPlaceholder}</p>
      </section>

      <AllergiesEditor dict={dict} />

      <button type="button" className="btn account-logout" onClick={handleLogout}>
        <span>{dict.logoutLabel}</span>
      </button>
    </div>
  );
}
