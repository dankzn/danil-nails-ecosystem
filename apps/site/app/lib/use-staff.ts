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

export type StaffMember = {
  id: string;
  displayName: string;
  bio: string | null;
  photoUrl: string | null;
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
