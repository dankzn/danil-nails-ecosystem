"use client";

import { ArrowRight, LockKeyhole } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { apiUrl } from "../lib/api-url";

export default function LoginPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch(`${apiUrl}/v1/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: form.get("email"),
          password: form.get("password")
        })
      });

      if (response.status === 503) {
        setErrorMessage("База данных ещё не подключена.");
        return;
      }

      if (!response.ok) {
        setErrorMessage("Проверь email и пароль.");
        return;
      }

      router.replace("/");
      router.refresh();
    } catch {
      setErrorMessage("API недоступен. Проверь, запущен ли сервер разработки.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-brand">
        <div className="login-brand-lockup">
          <span className="brand-mark">DN</span>
          <span>
            <strong>Danil Nails Studio</strong>
            <small>Закрытая CRM</small>
          </span>
        </div>
        <div>
          <p className="eyebrow">Рабочее пространство</p>
          <h1>Управление студией в одном месте</h1>
          <p>
            Записи, клиенты, расписание и внутренние данные доступны только
            сотрудникам с разрешённой ролью.
          </p>
        </div>
      </section>

      <section className="login-form-section">
        <form className="login-form" onSubmit={submitLogin}>
          <div className="login-form-heading">
            <span className="login-icon">
              <LockKeyhole aria-hidden="true" size={20} />
            </span>
            <div>
              <h2>Вход владельца</h2>
              <p>Используй данные, указанные при настройке базы.</p>
            </div>
          </div>

          <label className="form-field">
            <span>Email</span>
            <input
              autoComplete="email"
              name="email"
              placeholder="owner@example.com"
              required
              type="email"
            />
          </label>

          <label className="form-field">
            <span>Пароль</span>
            <input
              autoComplete="current-password"
              minLength={12}
              name="password"
              placeholder="Не менее 12 символов"
              required
              type="password"
            />
          </label>

          {errorMessage ? (
            <p className="form-error" role="alert">
              {errorMessage}
            </p>
          ) : null}

          <button className="primary-button login-button" disabled={isSubmitting}>
            {isSubmitting ? "Проверяем…" : "Войти в CRM"}
            <ArrowRight aria-hidden="true" size={18} />
          </button>
        </form>
      </section>
    </main>
  );
}
