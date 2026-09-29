import type { Dictionary } from "../dictionary";

export const fr: Dictionary = {
  meta: {
    title: "Danil Nails Studio — manucure haut de gamme",
    description:
      "Danil Nails Studio : travail précis, protocole stérile, réservation — à la prochaine étape"
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
    titleLines: ["Une précision", "qui se voit", "dans chaque détail"],
    lede: "Danil Nails Studio, c'est un travail précis, une attention minutieuse aux détails et un soin personnel pour chaque cliente",
    ctaPrimary: "Réserver",
    ctaSecondary: "Voir les prestations"
  },
  philosophy: {
    kicker: "Philosophie",
    headingLines: ["Une beauté où", "rien n'est laissé au hasard"],
    formula: "Nothing accidental.",
    manifesto:
      "Pour nous, la manucure n'est pas un détail isolé du look. Elle fait partie du langage visuel d'une personne : forme, proportion, teinte, texture, et la façon dont tout cela se ressent, précisément sur vous. C'est pourquoi nous ne répétons pas les mêmes choix. Nous cherchons celui qui semble un prolongement naturel de vous",
    principles: [
      {
        index: "01",
        title: "Ne pas décorer. Souligner",
        body: "Il ne nous intéresse pas de vous faire ressembler à quelqu'un d'autre. La forme, la longueur, la couleur et le design doivent composer avec vos traits, votre style et votre caractère — jamais s'y opposer"
      },
      {
        index: "02",
        title: "La précision est une esthétique",
        body: "La beauté commence avant la couleur. Dans les proportions. Dans l'architecture de la forme. Dans la netteté de la ligne. Dans des millimètres presque impossibles à remarquer isolément, mais qui décident de l'impression d'ensemble"
      },
      {
        index: "03",
        title: "Le luxe n'a pas besoin d'être bruyant",
        body: "Pour nous, le premium n'est ni une démonstration de statut ni un excès. C'est du temps, de l'espace, des matières, de l'attention — et le sentiment que rien n'a jamais à être demandé deux fois"
      }
    ]
  },
  home: {
    servicesKicker: "Prestations",
    servicesHeadingPre: "Trois formats, ",
    servicesHeadingEm: "sans superflu",
    servicesLede: "Le tarif est confirmé au moment de la réservation — nous le mettrons à jour ici dès qu'il sera fixé",
    servicesCta: "Voir toutes les prestations",
    contactKicker: "Réservation",
    contactHeadingPre: "Réservez ",
    contactHeadingEm: "en ligne",
    contactLede: "Choisissez une prestation, un maître et un horaire — la demande part tout de suite, et nous la confirmons en personne",
    contactCta: "Aller à la réservation"
  },
  services: {
    kicker: "Prestations",
    headingPre: "Trois formats, ",
    headingEm: "sans superflu",
    lede: "Le tarif est confirmé au moment de la réservation — nous le mettrons à jour ici dès qu'il sera fixé",
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
    lede: "Les photos des réalisations apparaîtront ici au fil des prises de vue. Pour l'instant, les teintes que le studio utilise le plus souvent",
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
    bio: "Un travail soigné sur la forme, le vernis et chaque détail — confort et résultat régulier à chaque rendez-vous",
    facts: [{ value: "3", label: "formats de prestation" }]
  },
  team: {
    heading: "Équipe",
    loading: "Chargement de l'équipe…",
    empty: "L'équipe sera bientôt présentée ici.",
    bookCta: "Réserver"
  },
  contact: {
    kicker: "Réservation",
    headingPre: "Réservez ",
    headingEm: "en ligne",
    lede: "Choisissez une prestation, un maître et un horaire. Chaque réservation est confirmée en personne, jamais automatiquement — nous vous contacterons pour confirmer l'heure. Le bot Telegram de réservation arrive à la prochaine étape"
  },
  booking: {
    serviceLabel: "Prestation",
    servicePlaceholder: "Choisissez une prestation",
    masterLabel: "Maître",
    dateLabel: "Date",
    timeLabel: "Heure",
    timePlaceholder: "Choisissez d'abord une prestation et une date",
    loadingSlotsLabel: "Chargement des créneaux disponibles…",
    noSlotsLabel: "Aucun créneau libre ce jour-là — essayez une autre date",
    fullNameLabel: "Nom complet",
    phoneLabel: "Téléphone",
    emailLabel: "Email (facultatif)",
    commentLabel: "Commentaire (facultatif)",
    signedInAs: "Cette réservation sera faite avec votre compte",
    submitLabel: "Envoyer la demande",
    submittingLabel: "Envoi…",
    successTitle: "Demande envoyée",
    successBody: "Nous vous contacterons pour confirmer votre réservation — l'heure définitive est fixée après confirmation manuelle",
    errorInvalid: "Merci de vérifier les champs remplis",
    errorSlotTaken: "Ce créneau vient d'être pris — choisissez-en un autre",
    errorUnavailable: "Le service est temporairement indisponible — réessayez bientôt",
    errorNetwork: "Impossible de contacter le serveur — vérifiez votre connexion"
  },
  register: {
    kicker: "Compte",
    headingPre: "Créer votre ",
    headingEm: "compte",
    lede: "Un compte permet de voir vos réservations et votre historique de visites. Vous pouvez aussi réserver une manucure sans vous inscrire — sur la page de réservation",
    fullNameLabel: "Nom complet",
    phoneLabel: "Téléphone",
    emailLabel: "Email",
    passwordLabel: "Mot de passe",
    passwordHint: "12 caractères minimum",
    confirmPasswordLabel: "Confirmez le mot de passe",
    submitLabel: "Créer le compte",
    submittingLabel: "Création du compte…",
    successTitle: "Compte créé",
    successBody: "Bienvenue ! Un espace personnel avec vos réservations arrivera ici à la prochaine étape",
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
    lede: "Saisissez l'email et le mot de passe utilisés lors de l'inscription",
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
    signedOutMessage: "Connectez-vous pour voir votre espace personnel",
    loginLink: "Se connecter",
    emailLabel: "Email",
    phoneLabel: "Téléphone",
    bookingsHeading: "Vos réservations",
    bookingsPlaceholder: "Vos réservations apparaîtront ici — cette partie de l'espace arrive à la prochaine étape",
    logoutLabel: "Se déconnecter",
    allergiesHeading: "Allergies et sensibilités",
    allergiesLede: "L'administrateur et votre maître voient ceci avant votre visite — signalez tout ce qui compte pour une manucure sans risque",
    noKnownAllergiesLabel: "Je n'ai aucune allergie connue",
    customAllergyLabel: "Autre allergène",
    customAllergyPlaceholder: "Décrivez-le avec vos propres mots",
    saveLabel: "Enregistrer",
    savingLabel: "Enregistrement…",
    savedLabel: "Enregistré",
    allergiesErrorConflict: "Impossible de cocher « aucune allergie » avec un allergène précis",
    allergiesErrorInvalid: "Impossible d'enregistrer — vérifiez les informations",
    allergiesErrorNetwork: "Impossible de contacter le serveur — vérifiez votre connexion"
  },
  footer: {
    tagline: "Un travail précis et une attention minutieuse à chaque rendez-vous",
    navLabel: "Navigation",
    studioLabel: "Studio",
    studioCity: "",
    studioNote: "Les coordonnées et l'adresse arriveront après le lancement",
    languageLabel: "Langue",
    rights: "Danil Nails Studio",
    toTop: "Haut de page ↑"
  }
};
