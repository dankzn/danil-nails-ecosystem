import type { Dictionary } from "../dictionary";

export const es: Dictionary = {
  meta: {
    title: "Danil Nails Studio — manicura premium en Moscú",
    description:
      "Danil Nails Studio: un estudio privado de manicura en Moscú. Trabajo preciso, protocolo estéril, reservas — en el próximo paso."
  },
  nav: {
    home: "Inicio",
    services: "Servicios",
    gallery: "Trabajos",
    master: "Maestro",
    contact: "Contacto",
    cta: "Reservar"
  },
  hero: {
    eyebrow: "Moscú · estudio privado",
    titleLines: ["Precisión", "que se nota", "en la punta de los dedos"],
    lede: "Danil Nails Studio es un estudio íntimo de manicura en Moscú. Un solo maestro, atención al detalle y una agenda sin prisas: cada clienta recibe exactamente el tiempo que hace falta para un trabajo impecable.",
    ctaPrimary: "Reservar",
    ctaSecondary: "Ver servicios",
    meta: [
      { value: "1", label: "Maestro por turno" },
      { value: "60–120", label: "Minutos por servicio" },
      { value: "100%", label: "Reservas confirmadas a mano" }
    ],
    scrollCue: "Desliza"
  },
  marquee: ["Manicura", "Esmalte semipermanente", "Manicura japonesa", "Esterilidad", "Reservas confirmadas"],
  philosophy: {
    kicker: "Enfoque",
    headingPre: "Tres cosas ",
    headingEm: "que lo sostienen todo",
    items: [
      {
        index: "01",
        title: "Un solo maestro",
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
    contactHeadingPre: "Empecemos con ",
    contactHeadingEm: "un mensaje",
    contactLede: "La reserva online y el bot de Telegram llegan en el próximo paso — los datos de contacto del estudio aparecerán aquí justo después del lanzamiento.",
    contactCta: "Ir a contacto"
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
  video: {
    label: "Video",
    note: "El vídeo del estudio aparecerá aquí después de la primera grabación",
    playLabel: "Ver",
    playNote: "Haz clic para reproducir el vídeo"
  },
  master: {
    kicker: "Maestro",
    headingPre: "Una sola persona, ",
    headingEm: "responsabilidad total",
    name: "Danil Afliatov",
    role: "Fundador y maestro de manicura",
    bio: "Dirige el estudio desde el primer día: atiende a las clientas en persona, lleva la agenda él mismo y responde por la calidad de cada manicura. A medida que el estudio crezca, se sumarán más maestros — por ahora, toda la responsabilidad recae en un solo nombre.",
    facts: [
      { value: "Moscú", label: "ciudad de trabajo" },
      { value: "3", label: "formatos de servicio" }
    ]
  },
  contact: {
    kicker: "Reserva",
    headingPre: "Empecemos con ",
    headingEm: "un mensaje",
    lede: "La reserva online y el bot de Telegram llegan en el próximo paso — los datos de contacto del estudio aparecerán aquí justo después del lanzamiento.",
    soon: "Formulario de reserva — próximamente"
  },
  footer: {
    tagline: "Un estudio privado de manicura. Un maestro, atención al detalle.",
    navLabel: "Navegación",
    studioLabel: "Estudio",
    studioCity: "Moscú, Rusia",
    studioNote: "Los datos de contacto y la dirección llegarán tras el lanzamiento",
    languageLabel: "Idioma",
    rights: "Danil Nails Studio, Moscú",
    toTop: "Volver arriba ↑"
  }
};
