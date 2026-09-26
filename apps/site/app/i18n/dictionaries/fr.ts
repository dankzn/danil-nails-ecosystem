import type { Dictionary } from "../dictionary";

export const fr: Dictionary = {
  meta: {
    title: "Danil Nails Studio — manucure haut de gamme",
    description:
      "Danil Nails Studio : travail précis, protocole stérile, réservation — à la prochaine étape."
  },
  nav: {
    home: "Accueil",
    services: "Prestations",
    gallery: "Réalisations",
    master: "Maître",
    contact: "Contact",
    cta: "Réserver",
    register: "S'inscrire",
    account: "Compte",
    login: "Se connecter",
    logout: "Se déconnecter"
  },
  hero: {
    titleLines: ["Une précision", "qui se voit", "au bout des doigts"],
    lede: "Danil Nails Studio, c'est un travail précis, une attention minutieuse aux détails et un planning sans précipitation : chaque cliente dispose exactement du temps nécessaire pour un résultat impeccable.",
    ctaPrimary: "Réserver",
    ctaSecondary: "Voir les prestations",
    meta: [
      { value: "3", label: "Formats de prestation" },
      { value: "60–120", label: "Minutes par prestation" },
      { value: "100%", label: "Réservations confirmées à la main" }
    ]
  },
  marquee: ["Manucure", "Vernis semi-permanent", "Manucure japonaise", "Stérilité", "Réservations confirmées"],
  philosophy: {
    kicker: "Approche",
    headingPre: "Trois piliers ",
    headingEm: "qui font tout tenir",
    items: [
      {
        index: "01",
        title: "Attention personnelle",
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
    headingPre: "Un savoir-faire ",
    headingEm: "visible dans les détails",
    name: "Danil Afliatov",
    role: "Fondateur et maître manucure",
    bio: "Reçoit les clientes en personne, gère lui-même le planning et répond de la qualité de chaque manucure — de la première consultation jusqu'à la finition.",
    facts: [{ value: "3", label: "formats de prestation" }]
  },
  contact: {
    kicker: "Réservation",
    headingPre: "Commençons par ",
    headingEm: "un message",
    lede: "La réservation en ligne et le bot Telegram arrivent à la prochaine étape — les coordonnées du studio apparaîtront ici juste après le lancement.",
    soon: "Formulaire de réservation — bientôt disponible"
  },
  register: {
    kicker: "Compte",
    headingPre: "Créer votre ",
    headingEm: "compte",
    lede: "Un compte permet de voir vos réservations et votre historique de visites. Vous pouvez aussi réserver une manucure sans vous inscrire — un formulaire de réservation arrive séparément.",
    fullNameLabel: "Nom complet",
    phoneLabel: "Téléphone",
    emailLabel: "Email",
    passwordLabel: "Mot de passe",
    passwordHint: "12 caractères minimum",
    confirmPasswordLabel: "Confirmez le mot de passe",
    submitLabel: "Créer le compte",
    submittingLabel: "Création du compte…",
    successTitle: "Compte créé",
    successBody: "Bienvenue ! Un espace personnel avec vos réservations arrivera ici à la prochaine étape.",
    errorPasswordMismatch: "Les mots de passe ne correspondent pas",
    errorInvalid: "Merci de vérifier les champs remplis",
    errorExists: "Un compte avec cet email ou ce téléphone existe déjà",
    errorUnavailable: "Le service est temporairement indisponible — réessayez bientôt",
    errorNetwork: "Impossible de contacter le serveur — vérifiez votre connexion"
  },
  login: {
    kicker: "Compte",
    headingPre: "Connectez-vous à votre ",
    headingEm: "compte",
    lede: "Saisissez l'email et le mot de passe utilisés lors de l'inscription.",
    emailLabel: "Email",
    passwordLabel: "Mot de passe",
    submitLabel: "Se connecter",
    submittingLabel: "Connexion…",
    errorInvalid: "Email ou mot de passe incorrect",
    errorUnavailable: "Le service est temporairement indisponible — réessayez bientôt",
    errorNetwork: "Impossible de contacter le serveur — vérifiez votre connexion",
    registerPrompt: "Pas encore de compte ?",
    registerLink: "Créer un compte"
  },
  account: {
    kicker: "Compte",
    heading: "Votre compte",
    loadingLabel: "Chargement…",
    signedOutMessage: "Connectez-vous pour voir votre espace personnel.",
    loginLink: "Se connecter",
    emailLabel: "Email",
    phoneLabel: "Téléphone",
    bookingsHeading: "Vos réservations",
    bookingsPlaceholder: "Vos réservations apparaîtront ici — cette partie de l'espace arrive à la prochaine étape.",
    logoutLabel: "Se déconnecter"
  },
  footer: {
    tagline: "Un travail précis et une attention minutieuse à chaque rendez-vous.",
    navLabel: "Navigation",
    studioLabel: "Studio",
    studioCity: "",
    studioNote: "Les coordonnées et l'adresse arriveront après le lancement",
    languageLabel: "Langue",
    rights: "Danil Nails Studio",
    toTop: "Haut de page ↑"
  }
};
