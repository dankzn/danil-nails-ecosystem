"use client";

import { useEffect, useState } from "react";
import { apiUrl } from "../lib/api-url";
import type { Locale } from "../i18n/locales";
import { Reveal } from "./Reveal";

type PositionTitle = {
  titleRu: string;
  titleEn: string | null;
  titleEs: string | null;
  titleFr: string | null;
};

type StaffMember = {
  id: string;
  displayName: string;
  bio: string | null;
  position: PositionTitle | null;
};

function localizedPosition(position: PositionTitle | null, lang: Locale) {
  if (!position) return null;
  if (lang === "en") return position.titleEn ?? position.titleRu;
  if (lang === "es") return position.titleEs ?? position.titleRu;
  if (lang === "fr") return position.titleFr ?? position.titleRu;
  return position.titleRu;
}

type TeamGridProps = {
  lang: Locale;
  heading: string;
  loadingLabel: string;
  emptyLabel: string;
};

export function TeamGrid({ lang, heading, loadingLabel, emptyLabel }: TeamGridProps) {
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

  return (
    <div className="team-section">
      <Reveal>
        <h2 className="team-heading">{heading}</h2>
      </Reveal>
      {staff === null ? (
        <p className="team-status">{loadingLabel}</p>
      ) : staff.length === 0 ? (
        <p className="team-status">{emptyLabel}</p>
      ) : (
        <div className="team-grid">
          {staff.map((member, index) => {
            const role = localizedPosition(member.position, lang);
            return (
              <Reveal delay={index * 60} key={member.id}>
                <article className="team-card">
                  <div className="team-card-portrait">
                    <span>
                      {member.displayName
                        .split(" ")
                        .map((part) => part.charAt(0))
                        .filter((letter) => letter.length > 0)
                        .slice(0, 2)
                        .join("")}
                    </span>
                  </div>
                  <h3 className="team-card-name">{member.displayName}</h3>
                  {role ? <p className="team-card-role">{role}</p> : null}
                  {member.bio ? <p className="team-card-bio">{member.bio}</p> : null}
                </article>
              </Reveal>
            );
          })}
        </div>
      )}
    </div>
  );
}
