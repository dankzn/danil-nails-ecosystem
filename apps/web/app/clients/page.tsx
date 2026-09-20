import { Search, UserPlus } from "lucide-react";
import { mockClients } from "../lib/mock-data";

function formatVisitCount(count: number) {
  if (count === 1) return "1 визит";
  if (count >= 2 && count <= 4) return `${count} визита`;
  return `${count} визитов`;
}

export default function ClientsPage() {
  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">CRM клиентов</p>
          <h1>Клиенты</h1>
          <p className="page-description">
            Контакты, история визитов и внутренние отметки.
          </p>
        </div>
        <button className="primary-button" type="button">
          <UserPlus aria-hidden="true" size={18} />
          Добавить клиента
        </button>
      </header>

      <section className="panel table-panel">
        <div className="table-toolbar">
          <label className="search-field">
            <Search aria-hidden="true" size={17} />
            <span className="sr-only">Найти клиента</span>
            <input placeholder="Имя, телефон или Telegram" type="search" />
          </label>
          <span className="muted-label">{mockClients.length} клиента</span>
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Клиент</th>
                <th>Контакты</th>
                <th>Последний визит</th>
                <th>Лояльность</th>
                <th>Внутренняя метка</th>
                <th>Предоплата</th>
              </tr>
            </thead>
            <tbody>
              {mockClients.map((client) => (
                <tr key={client.id}>
                  <td>
                    <strong>{client.name}</strong>
                    <small>{formatVisitCount(client.visits)}</small>
                  </td>
                  <td>
                    <span>{client.phone}</span>
                    <small>{client.telegram}</small>
                  </td>
                  <td>{client.lastVisit}</td>
                  <td>
                    <span className="loyalty-badge">{client.loyaltyStatus}</span>
                  </td>
                  <td>
                    <span className="private-badge">{client.privateTag}</span>
                  </td>
                  <td>
                    <span
                      className={`status ${
                        client.requiresPrepayment
                          ? "status-danger"
                          : "status-neutral"
                      }`}
                    >
                      {client.requiresPrepayment ? "Обязательна" : "Не требуется"}
                    </span>
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
