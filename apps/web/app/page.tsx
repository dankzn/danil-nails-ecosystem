import { businessConfig, initialServices } from "@danil-nails/shared";

const todayAppointments = [
  {
    time: "10:00",
    client: "Тестовый клиент",
    service: "Маникюр с покрытием",
    status: "Ожидает подтверждения"
  },
  {
    time: "13:00",
    client: "Новый клиент",
    service: "Японский маникюр",
    status: "Черновик"
  }
];

const launchTasks = [
  ["Требования MVP", "готово"],
  ["Каркас проекта", "в работе"],
  ["База данных", "следующая"],
  ["Telegram bot", "позже"]
];

export default function Home() {
  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-title">{businessConfig.brandName}</span>
          <span className="brand-subtitle">CRM ecosystem</span>
        </div>

        <nav className="nav-list" aria-label="Основная навигация">
          <span className="nav-item nav-item-active">Обзор</span>
          <span className="nav-item">Записи</span>
          <span className="nav-item">Клиенты</span>
          <span className="nav-item">Услуги</span>
          <span className="nav-item">Расписание</span>
        </nav>

        <p className="sidebar-note">
          Закрытый запуск для владельца. Следующий рубеж - полный цикл записи с
          ручным подтверждением.
        </p>
      </aside>

      <section className="main">
        <div className="topbar">
          <div>
            <p className="eyebrow">Москва · {businessConfig.timezone}</p>
            <h1>Рабочая панель первого запуска</h1>
            <p>
              Здесь будет собираться ежедневная картина: записи, подтверждения,
              клиенты, напоминания и статусы, которые видны только внутри CRM.
            </p>
          </div>
          <span className="status-pill">MVP в разработке</span>
        </div>

        <section className="metric-grid" aria-label="Ключевые показатели">
          <div className="metric">
            <span className="metric-label">Записи сегодня</span>
            <strong className="metric-value">2</strong>
          </div>
          <div className="metric">
            <span className="metric-label">Ожидают подтверждения</span>
            <strong className="metric-value">1</strong>
          </div>
          <div className="metric">
            <span className="metric-label">Услуги в прайсе</span>
            <strong className="metric-value">{initialServices.length}</strong>
          </div>
          <div className="metric">
            <span className="metric-label">Языки интерфейса</span>
            <strong className="metric-value">3</strong>
          </div>
        </section>

        <section className="section-grid">
          <div className="panel">
            <h2>Ближайшие записи</h2>
            <div className="timeline">
              {todayAppointments.map((appointment) => (
                <div className="timeline-row" key={appointment.time}>
                  <span className="time">{appointment.time}</span>
                  <span className="client">
                    <strong>{appointment.client}</strong>
                    <span>{appointment.service}</span>
                  </span>
                  <span className="tag">{appointment.status}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <h2>Стартовые задачи</h2>
            <ul className="checklist">
              {launchTasks.map(([task, status]) => (
                <li key={task}>
                  <strong>{task}</strong>
                  <span>{status}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </section>
    </main>
  );
}

