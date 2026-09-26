import type { Dictionary } from "../dictionary";

export const en: Dictionary = {
  meta: {
    title: "Danil Nails Studio — premium manicure",
    description:
      "Danil Nails Studio: precise work, a sterile protocol, booking — coming as the next step."
  },
  nav: {
    home: "Home",
    services: "Services",
    gallery: "Work",
    master: "Master",
    contact: "Contact",
    cta: "Book a visit",
    register: "Sign up"
  },
  hero: {
    eyebrow: "Premium manicure",
    titleLines: ["Precision", "you can see", "on your fingertips"],
    lede: "Danil Nails Studio is precise work, close attention to detail, and a schedule with no rush — every client gets exactly as much time as it takes to get it right.",
    ctaPrimary: "Book a visit",
    ctaSecondary: "See services",
    meta: [
      { value: "3", label: "Service formats" },
      { value: "60–120", label: "Minutes per service" },
      { value: "100%", label: "Bookings confirmed by hand" }
    ],
    scrollCue: "Scroll"
  },
  marquee: ["Manicure", "Gel polish", "Japanese manicure", "Sterility", "Confirmed bookings"],
  philosophy: {
    kicker: "Approach",
    headingPre: "Three things ",
    headingEm: "everything rests on",
    items: [
      {
        index: "01",
        title: "Personal attention",
        body: "No conveyor belt, no front-desk queue between you and the master — you work directly with the person doing your nails."
      },
      {
        index: "02",
        title: "Hand-moderated bookings",
        body: "Every booking is confirmed in person, not automatically — that's how we keep the schedule free of overlaps and rush."
      },
      {
        index: "03",
        title: "Sterile protocol",
        body: "Tools are processed between every client under the studio's standard protocol — that's a baseline, not an option."
      }
    ]
  },
  home: {
    servicesKicker: "Services",
    servicesHeadingPre: "Three formats, ",
    servicesHeadingEm: "nothing extra",
    servicesLede: "Pricing is confirmed at the time of booking — we'll update it here as soon as it's finalized.",
    servicesCta: "See all services",
    contactKicker: "Booking",
    contactHeadingPre: "Let's start with ",
    contactHeadingEm: "a message",
    contactLede: "Online booking and a Telegram bot are coming as the next step — studio contacts will appear here right after launch.",
    contactCta: "Go to contact"
  },
  services: {
    kicker: "Services",
    headingPre: "Three formats, ",
    headingEm: "nothing extra",
    lede: "Pricing is confirmed at the time of booking — we'll update it here as soon as it's finalized.",
    priceLabel: "By booking",
    items: [
      { title: "Manicure without polish", duration: "60 min", note: "Shape, cuticle, care" },
      { title: "Manicure with gel polish", duration: "120 min", note: "Gel polish, precise color" },
      { title: "Japanese manicure", duration: "75 min", note: "Buffing and strengthening" }
    ]
  },
  gallery: {
    kicker: "Work",
    headingPre: "A palette ",
    headingEm: "we love",
    lede: "Photos of the work will appear here as we shoot them. For now — the shades the studio works with most often.",
    items: [
      { label: "Warm garnet" },
      { label: "Milk porcelain" },
      { label: "Deep graphite" },
      { label: "Champagne" },
      { label: "Wine velvet" },
      { label: "Warm sand" }
    ]
  },
  master: {
    kicker: "Master",
    headingPre: "Craft, ",
    headingEm: "visible in the details",
    name: "Danil Afliatov",
    role: "Founder and nail master",
    bio: "Takes clients personally, keeps the schedule himself, and answers for the quality of every single manicure — from the first consultation to the final polish.",
    facts: [{ value: "3", label: "service formats" }]
  },
  contact: {
    kicker: "Booking",
    headingPre: "Let's start with ",
    headingEm: "a message",
    lede: "Online booking and a Telegram bot are coming as the next step — studio contacts will appear here right after launch.",
    soon: "Booking form — coming soon"
  },
  register: {
    kicker: "Account",
    headingPre: "Create your ",
    headingEm: "account",
    lede: "An account lets you see your bookings and visit history. You can still book a manicure without registering — a booking form is coming separately.",
    fullNameLabel: "Full name",
    phoneLabel: "Phone",
    emailLabel: "Email",
    passwordLabel: "Password",
    passwordHint: "At least 12 characters",
    confirmPasswordLabel: "Confirm password",
    submitLabel: "Create account",
    submittingLabel: "Creating account…",
    successTitle: "Account created",
    successBody: "Welcome! A personal cabinet with your bookings will appear here as the next step.",
    errorPasswordMismatch: "Passwords don't match",
    errorInvalid: "Please check the fields you filled in",
    errorExists: "An account with that email or phone already exists",
    errorUnavailable: "The service is temporarily unavailable — please try again shortly",
    errorNetwork: "Couldn't reach the server — check your connection"
  },
  footer: {
    tagline: "Precise work and close attention to detail in every appointment.",
    navLabel: "Navigation",
    studioLabel: "Studio",
    studioCity: "",
    studioNote: "Contact details and address are coming after launch",
    languageLabel: "Language",
    rights: "Danil Nails Studio",
    toTop: "Back to top ↑"
  }
};
