export type Dictionary = {
  meta: {
    title: string;
    description: string;
  };
  nav: {
    home: string;
    services: string;
    gallery: string;
    master: string;
    contact: string;
    cta: string;
  };
  hero: {
    eyebrow: string;
    titleLines: string[];
    lede: string;
    ctaPrimary: string;
    ctaSecondary: string;
    meta: { value: string; label: string }[];
    scrollCue: string;
  };
  marquee: string[];
  philosophy: {
    kicker: string;
    headingPre: string;
    headingEm: string;
    items: { index: string; title: string; body: string }[];
  };
  home: {
    servicesKicker: string;
    servicesHeadingPre: string;
    servicesHeadingEm: string;
    servicesLede: string;
    servicesCta: string;
    contactKicker: string;
    contactHeadingPre: string;
    contactHeadingEm: string;
    contactLede: string;
    contactCta: string;
  };
  services: {
    kicker: string;
    headingPre: string;
    headingEm: string;
    lede: string;
    priceLabel: string;
    items: { title: string; duration: string; note: string }[];
  };
  gallery: {
    kicker: string;
    headingPre: string;
    headingEm: string;
    lede: string;
    items: { label: string }[];
  };
  video: {
    label: string;
    note: string;
  };
  master: {
    kicker: string;
    headingPre: string;
    headingEm: string;
    name: string;
    role: string;
    bio: string;
    facts: { value: string; label: string }[];
  };
  contact: {
    kicker: string;
    headingPre: string;
    headingEm: string;
    lede: string;
    soon: string;
  };
  footer: {
    tagline: string;
    navLabel: string;
    studioLabel: string;
    studioCity: string;
    studioNote: string;
    languageLabel: string;
    rights: string;
    toTop: string;
  };
};
