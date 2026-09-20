import { initialServices, type SupportedCurrency } from "@danil-nails/shared";
import { Plus } from "lucide-react";

const currencySymbols: Record<SupportedCurrency, string> = {
  RUB: "₽",
  EUR: "€",
  USD: "$"
};

function formatPrice(amountMinor: number, currency: SupportedCurrency) {
  return `${amountMinor / 100} ${currencySymbols[currency]}`;
}

export default function ServicesPage() {
  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Каталог</p>
          <h1>Услуги и цены</h1>
          <p className="page-description">
            Тестовый прайс для макета. Все значения можно будет изменить.
          </p>
        </div>
        <button className="primary-button" type="button">
          <Plus aria-hidden="true" size={18} />
          Добавить услугу
        </button>
      </header>

      <section className="panel table-panel">
        <div className="table-toolbar">
          <div>
            <p className="section-kicker">Активные услуги</p>
            <h2>Маникюр</h2>
          </div>
          <span className="muted-label">3 валюты</span>
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Услуга</th>
                <th>Длительность</th>
                <th>RUB</th>
                <th>EUR</th>
                <th>USD</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {initialServices.map((service) => (
                <tr key={service.slug}>
                  <td>
                    <strong>{service.name.ru}</strong>
                    <small>
                      {service.name.en} · {service.name.es}
                    </small>
                  </td>
                  <td>{service.defaultDurationMinutes} мин</td>
                  {service.prices.map((price) => (
                    <td className="price-cell" key={price.currency}>
                      {formatPrice(price.amountMinor, price.currency)}
                    </td>
                  ))}
                  <td>
                    <span className="status status-success">Активна</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
