import type { Dictionary } from "../dictionary";

export const fr: Dictionary = {
  meta: {
    title: "Danil Nails Studio — manucure haut de gamme à Moscou",
    description:
      "Danil Nails Studio : un studio de manucure privé à Moscou. Travail précis, protocole stérile, réservation — à la prochaine étape."
  },
  nav: {
    home: "Accueil",
    services: "Prestations",
    gallery: "Réalisations",
    master: "Maître",
    contact: "Contact",
    cta: "Réserver"
  },
  hero: {
    eyebrow: "Moscou · studio privé",
    titleLines: ["Une précision", "qui se voit", "au bout des doigts"],
    lede: "Danil Nails Studio est un studio de manucure intimiste à Moscou. Un seul maître, une attention minutieuse aux détails et un planning sans précipitation : chaque cliente dispose exactement du temps nécessaire pour un résultat impeccable.",
    ctaPrimary: "Réserver",
    ctaSecondary: "Voir les prestations",
    meta: [
      { value: "1", label: "Maître par séance" },
      { value: "60–120", label: "Minutes par prestation" },
      { value: "100%", label: "Réservations confirmées à la main" }
    ],
    scrollCue: "Défiler"
  },
  marquee: ["Manucure", "Vernis semi-permanent", "Manucure japonaise", "Stérilité", "Réservations confirmées"],
  philosophy: {
    kicker: "Approche",
    headingPre: "Trois piliers ",
    headingEm: "qui font tout tenir",
    items: [
      {
        index: "01",
        title: "Un seul maître",
        body: "Ni chaîne de production, ni réceptionniste entre vous et le maître — vous travaillez directement avec la personne qui réalise votre manucure."
      },
      {
        index: "02",
        title: "Réservations validées à la main",
        body: "Chaque réservation est confirmée en personne, jamais automatiquement — c'est ainsi que le planning reste sans chevauchement ni précipitation."
      },
      {
        index: "03",
        title: "Protocole stérile",
        body: "Les instruments sont traités entre chaque cliente selon le protocole standard du studio — c'est la base, pas une option."
      }
    ]
  },
  home: {
    servicesKicker: "Prestations",
    servicesHeadingPre: "Trois formats, ",
    servicesHeadingEm: "sans superflu",
    servicesLede: "Le tarif est confirmé au moment de la réservation — nous le mettrons à jour ici dès qu'il sera fixé.",
    servicesCta: "Voir toutes les prestations",
    contactKicker: "Réservation",
    contactHeadingPre: "Commençons par ",
    contactHeadingEm: "un message",
    contactLede: "La réservation en ligne et le bot Telegram arrivent à la prochaine étape — les coordonnées du studio apparaîtront ici juste après le lancement.",
    contactCta: "Aller au contact"
  },
  services: {
    kicker: "Prestations",
    headingPre: "Trois formats, ",
    headingEm: "sans superflu",
    lede: "Le tarif est confirmé au moment de la réservation — nous le mettrons à jour ici dès qu'il sera fixé.",
    priceLabel: "Sur réservation",
    items: [
      { title: "Manucure sans vernis", duration: "60 min", note: "Forme, cuticules, soin" },
      { title: "Manucure avec vernis semi-permanent", duration: "120 min", note: "Vernis gel, couleur précise" },
      { title: "Manucure japonaise", duration: "75 min", note: "Polissage et renforcement" }
    ]
  },
  gallery: {
    kicker: "Réalisations",
    headingPre: "Une palette ",
    headingEm: "que nous aimons",
    lede: "Les photos des réalisations apparaîtront ici au fil des prises de vue. Pour l'instant, les teintes que le studio utilise le plus souvent.",
    items: [
      { label: "Grenat chaud" },
      { label: "Porcelaine lait" },
      { label: "Graphite profond" },
      { label: "Champagne" },
      { label: "Velours bordeaux" },
      { label: "Sable chaud" }
    ]
  },
  master: {
    kicker: "Maître",
    headingPre: "Une seule personne, ",
    headingEm: "une entière responsabilité",
    name: "Danil Afliatov",
    role: "Fondateur et maître manucure",
    bio: "Dirige le studio depuis ses débuts : reçoit les clientes en personne, gère lui-même le planning et répond de la qualité de chaque manucure. À mesure que le studio grandira, d'autres maîtres le rejoindront — pour l'instant, toute la responsabilité repose sur un seul nom.",
    facts: [
      { value: "Moscou", label: "ville d'exercice" },
      { value: "3", label: "formats de prestation" }
    ]
  },
  contact: {
    kicker: "Réservation",
    headingPre: "Commençons par ",
    headingEm: "un message",
    lede: "La réservation en ligne et le bot Telegram arrivent à la prochaine étape — les coordonnées du studio apparaîtront ici juste après le lancement.",
    soon: "Formulaire de réservation — bientôt disponible"
  },
  footer: {
    tagline: "Un studio de manucure privé. Un maître, une attention minutieuse.",
    navLabel: "Navigation",
    studioLabel: "Studio",
    studioCity: "Moscou, Russie",
    studioNote: "Les coordonnées et l'adresse arriveront après le lancement",
    languageLabel: "Langue",
    rights: "Danil Nails Studio, Moscou",
    toTop: "Haut de page ↑"
  }
};
