import type { Dictionary } from "../dictionary";

export const es: Dictionary = {
  meta: {
    title: "Danil Nails Studio — manicura premium",
    description:
      "Danil Nails Studio: trabajo preciso, protocolo estéril, reservas — en el próximo paso."
  },
  nav: {
    home: "Inicio",
    services: "Servicios",
    gallery: "Trabajos",
    master: "Maestro",
    contact: "Contacto",
    cta: "Reservar",
    register: "Registrarse",
    account: "Cuenta",
    login: "Iniciar sesión",
    logout: "Cerrar sesión"
  },
  hero: {
    titleLines: ["Precisión", "que se nota", "en la punta de los dedos"],
    lede: "Danil Nails Studio es trabajo preciso, atención al detalle y una agenda sin prisas: cada clienta recibe exactamente el tiempo que hace falta para un trabajo impecable.",
    ctaPrimary: "Reservar",
    ctaSecondary: "Ver servicios",
    meta: [
      { value: "3", label: "Formatos de servicio" },
      { value: "60–120", label: "Minutos por servicio" },
      { value: "100%", label: "Reservas confirmadas a mano" }
    ]
  },
  marquee: ["Manicura", "Esmalte semipermanente", "Manicura japonesa", "Esterilidad", "Reservas confirmadas"],
  philosophy: {
    kicker: "Enfoque",
    headingPre: "Tres cosas ",
    headingEm: "que lo sostienen todo",
    items: [
      {
        index: "01",
        title: "Atención personal",
        body: "Sin cadena de producción ni recepcionistas entre tú y el maestro: trabajas directamente con quien hace tu manicura."
      },
      {
        index: "02",
        title: "Reservas confirmadas a mano",
        body: "Cada reserva se confirma en persona, no de forma automática — así mantenemos la agenda sin solapes ni prisas."
      },
      {
        index: "03",
        title: "Protocolo estéril",
        body: "El instrumental se procesa entre cada clienta según el protocolo estándar del estudio — es la base, no una opción."
      }
    ]
  },
  home: {
    servicesKicker: "Servicios",
    servicesHeadingPre: "Tres formatos, ",
    servicesHeadingEm: "sin nada de más",
    servicesLede: "El precio se confirma al reservar — lo actualizaremos aquí en cuanto quede definitivo.",
    servicesCta: "Ver todos los servicios",
    contactKicker: "Reserva",
    contactHeadingPre: "Reserva ",
    contactHeadingEm: "online",
    contactLede: "Elige un servicio, un maestro y una hora que te convenga — la solicitud se envía al momento y la confirmamos a mano.",
    contactCta: "Ir a la reserva"
  },
  services: {
    kicker: "Servicios",
    headingPre: "Tres formatos, ",
    headingEm: "sin nada de más",
    lede: "El precio se confirma al reservar — lo actualizaremos aquí en cuanto quede definitivo.",
    priceLabel: "Según reserva",
    items: [
      { title: "Manicura sin esmalte", duration: "60 min", note: "Forma, cutícula, cuidado" },
      { title: "Manicura con esmalte semipermanente", duration: "120 min", note: "Esmalte gel, color preciso" },
      { title: "Manicura japonesa", duration: "75 min", note: "Pulido y fortalecimiento" }
    ]
  },
  gallery: {
    kicker: "Trabajos",
    headingPre: "Una paleta ",
    headingEm: "que nos encanta",
    lede: "Las fotos de los trabajos aparecerán aquí a medida que las tomemos. Por ahora, los tonos con los que más trabaja el estudio.",
    items: [
      { label: "Granate cálido" },
      { label: "Porcelana leche" },
      { label: "Grafito profundo" },
      { label: "Champán" },
      { label: "Terciopelo vino" },
      { label: "Arena cálida" }
    ]
  },
  master: {
    kicker: "Maestro",
    headingPre: "Oficio, ",
    headingEm: "visible en los detalles",
    name: "Danil Afliatov",
    role: "Fundador y maestro de manicura",
    bio: "Atiende a las clientas en persona, lleva la agenda él mismo y responde por la calidad de cada manicura — desde la primera consulta hasta el acabado final.",
    facts: [{ value: "3", label: "formatos de servicio" }]
  },
  contact: {
    kicker: "Reserva",
    headingPre: "Reserva ",
    headingEm: "online",
    lede: "Elige un servicio, un maestro y una hora que te convenga. Cada reserva se confirma a mano, no automáticamente — te contactaremos para confirmar tu hora. El bot de reservas por Telegram llega en el próximo paso."
  },
  booking: {
    serviceLabel: "Servicio",
    servicePlaceholder: "Elige un servicio",
    masterLabel: "Maestro",
    dateLabel: "Fecha",
    timeLabel: "Hora",
    timePlaceholder: "Elige primero un servicio y una fecha",
    loadingSlotsLabel: "Cargando horarios disponibles…",
    noSlotsLabel: "No hay horarios libres ese día — prueba con otra fecha",
    fullNameLabel: "Nombre completo",
    phoneLabel: "Teléfono",
    emailLabel: "Email (opcional)",
    commentLabel: "Comentario (opcional)",
    signedInAs: "Esta reserva se hará con tu cuenta",
    submitLabel: "Enviar solicitud",
    submittingLabel: "Enviando…",
    successTitle: "Solicitud enviada",
    successBody: "Te contactaremos para confirmar tu reserva — la hora final queda fijada tras la confirmación manual.",
    errorInvalid: "Revisa, por favor, los campos completados",
    errorSlotTaken: "Ese horario se acaba de ocupar — elige otro",
    errorUnavailable: "El servicio no está disponible por ahora — inténtalo de nuevo en un momento",
    errorNetwork: "No se pudo contactar con el servidor — revisa tu conexión"
  },
  register: {
    kicker: "Cuenta",
    headingPre: "Crea tu ",
    headingEm: "cuenta",
    lede: "Con una cuenta puedes ver tus reservas e historial de visitas. También puedes reservar una manicura sin registrarte — en la página de reserva.",
    fullNameLabel: "Nombre completo",
    phoneLabel: "Teléfono",
    emailLabel: "Email",
    passwordLabel: "Contraseña",
    passwordHint: "Al menos 12 caracteres",
    confirmPasswordLabel: "Confirma la contraseña",
    submitLabel: "Crear cuenta",
    submittingLabel: "Creando cuenta…",
    successTitle: "Cuenta creada",
    successBody: "¡Bienvenida! Un panel personal con tus reservas aparecerá aquí en el próximo paso.",
    errorPasswordMismatch: "Las contraseñas no coinciden",
    errorInvalid: "Revisa, por favor, los campos completados",
    errorExists: "Ya existe una cuenta con ese email o teléfono",
    errorUnavailable: "El servicio no está disponible por ahora — inténtalo de nuevo en un momento",
    errorNetwork: "No se pudo contactar con el servidor — revisa tu conexión"
  },
  login: {
    kicker: "Cuenta",
    headingPre: "Inicia sesión en tu ",
    headingEm: "cuenta",
    lede: "Introduce el email y la contraseña que usaste al registrarte.",
    emailLabel: "Email",
    passwordLabel: "Contraseña",
    submitLabel: "Iniciar sesión",
    submittingLabel: "Iniciando sesión…",
    errorInvalid: "Email o contraseña incorrectos",
    errorUnavailable: "El servicio no está disponible por ahora — inténtalo de nuevo en un momento",
    errorNetwork: "No se pudo contactar con el servidor — revisa tu conexión",
    registerPrompt: "¿Aún no tienes cuenta?",
    registerLink: "Crear cuenta"
  },
  account: {
    kicker: "Cuenta",
    heading: "Tu cuenta",
    loadingLabel: "Cargando…",
    signedOutMessage: "Inicia sesión para ver tu espacio personal.",
    loginLink: "Iniciar sesión",
    emailLabel: "Email",
    phoneLabel: "Teléfono",
    bookingsHeading: "Tus reservas",
    bookingsPlaceholder: "Tus reservas aparecerán aquí — esta parte de la cuenta llega en el próximo paso.",
    logoutLabel: "Cerrar sesión"
  },
  footer: {
    tagline: "Trabajo preciso y atención al detalle en cada cita.",
    navLabel: "Navegación",
    studioLabel: "Estudio",
    studioCity: "",
    studioNote: "Los datos de contacto y la dirección llegarán tras el lanzamiento",
    languageLabel: "Idioma",
    rights: "Danil Nails Studio",
    toTop: "Volver arriba ↑"
  }
};
