"use client";

import { useEffect, useState } from "react";
import type { Locale } from "../i18n/locales";
import { apiUrl } from "./api-url";

export type PositionTitle = {
  titleRu: string;
  titleEn: string | null;
  titleEs: string | null;
  titleFr: string | null;
  isMasterRole: boolean;
};

export type LocationRef = { id: string; title: string };

export type StaffMember = {
  id: string;
  displayName: string;
  philosophy: string | null;
  worksVideoUrl: string | null;
  experienceYears: number | null;
  photoUrl: string | null;
  city: LocationRef | null;
  country: LocationRef | null;
  positions: PositionTitle[];
};

export function localizedPosition(position: PositionTitle, lang: Locale) {
  if (lang === "en") return position.titleEn ?? position.titleRu;
  if (lang === "es") return position.titleEs ?? position.titleRu;
  if (lang === "fr") return position.titleFr ?? position.titleRu;
  return position.titleRu;
}

export function localizedPositions(positions: PositionTitle[], lang: Locale) {
  return positions.map((position) => localizedPosition(position, lang));
}

// Only actual craft roles (e.g. "Мастер маникюра") — as opposed to public
// organizational titles like "Сооснователь" or "SMM-менеджер" — belong on
// the public masters page.
export function masterPositions(positions: PositionTitle[]) {
  return positions.filter((position) => position.isMasterRole);
}

export function staffPhotoSrc(photoUrl: string | null) {
  return photoUrl ? `${apiUrl}${photoUrl}` : null;
}

// Turns a YouTube/Vimeo watch link into its embeddable iframe src; returns
// null for anything else (the caller falls back to a plain link).
export function embeddableVideoSrc(url: string | null) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");

    if (host === "youtube.com" || host === "m.youtube.com") {
      const id = parsed.searchParams.get("v");
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (host === "youtu.be") {
      const id = parsed.pathname.slice(1);
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (host === "vimeo.com") {
      const id = parsed.pathname.slice(1);
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }
    return null;
  } catch {
    return null;
  }
}

function ruYearsWord(years: number) {
  const lastTwo = years % 100;
  const lastOne = years % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return "лет";
  if (lastOne === 1) return "год";
  if (lastOne >= 2 && lastOne <= 4) return "года";
  return "лет";
}

export function experienceLabel(years: number | null, lang: Locale) {
  if (years === null) return null;
  if (lang === "en") return `${years} ${years === 1 ? "year" : "years"} of experience`;
  if (lang === "es") return `${years} ${years === 1 ? "año" : "años"} de experiencia`;
  if (lang === "fr") return `${years} ${years === 1 ? "an" : "ans"} d'expérience`;
  return `${years} ${ruYearsWord(years)} опыта`;
}

export function initialsOf(displayName: string) {
  return displayName
    .split(" ")
    .map((part) => part.charAt(0))
    .filter((letter) => letter.length > 0)
    .slice(0, 2)
    .join("");
}

// null = still loading, [] = loaded but nobody is bookable right now.
export function useStaff() {
  const [staff, setStaff] = useState<StaffMember[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${apiUrl}/v1/staff`)
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled) setStaff(data.staff ?? []);
      })
      .catch(() => {
        if (!cancelled) setStaff([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return staff;
}
