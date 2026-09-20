export const mockAppointments = [
  {
    id: "appointment-1",
    time: "10:00",
    duration: "2 ч",
    client: "Анна Петрова",
    phone: "+7 900 000-00-01",
    service: "Маникюр с покрытием",
    status: "Ожидает модерации",
    statusTone: "warning"
  },
  {
    id: "appointment-2",
    time: "13:00",
    duration: "1 ч 15 мин",
    client: "Мария Соколова",
    phone: "+7 900 000-00-02",
    service: "Японский маникюр",
    status: "Подтверждена",
    statusTone: "success"
  },
  {
    id: "appointment-3",
    time: "15:00",
    duration: "1 ч",
    client: "Елена Волкова",
    phone: "+7 900 000-00-03",
    service: "Маникюр без покрытия",
    status: "Ждём ответа клиента",
    statusTone: "info"
  }
] as const;

export const mockClients = [
  {
    id: "client-1",
    name: "Анна Петрова",
    phone: "+7 900 000-00-01",
    telegram: "@anna_test",
    lastVisit: "12 сентября 2026",
    visits: 4,
    loyaltyStatus: "Постоянный клиент",
    privateTag: "Предпочитает утро",
    requiresPrepayment: false
  },
  {
    id: "client-2",
    name: "Мария Соколова",
    phone: "+7 900 000-00-02",
    telegram: "@maria_test",
    lastVisit: "28 августа 2026",
    visits: 2,
    loyaltyStatus: "Гость",
    privateTag: "Чувствительная кожа",
    requiresPrepayment: false
  },
  {
    id: "client-3",
    name: "Елена Волкова",
    phone: "+7 900 000-00-03",
    telegram: "@elena_test",
    lastVisit: "5 июля 2026",
    visits: 1,
    loyaltyStatus: "Гость",
    privateTag: "Поздняя отмена",
    requiresPrepayment: true
  }
] as const;
