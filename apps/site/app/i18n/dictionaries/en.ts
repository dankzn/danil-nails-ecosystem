import type { Dictionary } from "../dictionary";

export const en: Dictionary = {
  meta: {
    title: "Danil Nails Studio — premium manicure in Moscow",
    description:
      "Danil Nails Studio: a private manicure studio in Moscow. Precise work, a sterile protocol, booking — coming as the next step."
  },
  nav: {
    home: "Home",
    services: "Services",
    gallery: "Work",
    master: "Master",
    contact: "Contact",
    cta: "Book a visit"
  },
  hero: {
    eyebrow: "Moscow · private studio",
    titleLines: ["Precision", "you can see", "on your fingertips"],
    lede: "Danil Nails Studio is an intimate manicure studio in Moscow. One master, close attention to detail, and a schedule with no rush — every client gets exactly as much time as it takes to get it right.",
    ctaPrimary: "Book a visit",
    ctaSecondary: "See services",
    meta: [
      { value: "1", label: "Master per session" },
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
        title: "One master",
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
  video: {
    label: "Video",
    note: "Studio footage will appear here after the first shoot"
  },
  master: {
    kicker: "Master",
    headingPre: "One person, ",
    headingEm: "full accountability",
    name: "Danil Afliatov",
    role: "Founder and nail master",
    bio: "Has run the studio since day one: takes clients personally, keeps the schedule himself, and answers for the quality of every single manicure. As the studio grows, other masters will join here — for now, all of it rests on one name.",
    facts: [
      { value: "Moscow", label: "city of work" },
      { value: "3", label: "service formats" }
    ]
  },
  contact: {
    kicker: "Booking",
    headingPre: "Let's start with ",
    headingEm: "a message",
    lede: "Online booking and a Telegram bot are coming as the next step — studio contacts will appear here right after launch.",
    soon: "Booking form — coming soon"
  },
  footer: {
    tagline: "A private manicure studio. One master, close attention to detail.",
    navLabel: "Navigation",
    studioLabel: "Studio",
    studioCity: "Moscow, Russia",
    studioNote: "Contact details and address are coming after launch",
    languageLabel: "Language",
    rights: "Danil Nails Studio, Moscow",
    toTop: "Back to top ↑"
  }
};
