"use client";

import Link from "next/link";
import type { Locale } from "../i18n/locales";
import {
  initialsOf,
  localizedPositions,
  masterPositions,
  staffPhotoSrc,
  type StaffMember
} from "../lib/use-staff";
import { Button } from "./Button";
import { Reveal } from "./Reveal";

type TeamGridProps = {
  lang: Locale;
  heading?: string;
  bookCta: string;
  staff: StaffMember[];
};

export function TeamGrid({ lang, heading, bookCta, staff }: TeamGridProps) {
  if (staff.length === 0) return null;

  return (
    <div className="team-section">
      {heading ? (
        <Reveal>
          <h2 className="team-heading">{heading}</h2>
        </Reveal>
      ) : null}
      <div className="team-grid">
        {staff.map((member, index) => {
          const role = localizedPositions(masterPositions(member.positions), lang).join(" · ");
          const photoSrc = staffPhotoSrc(member.photoUrl);
          return (
            <Reveal delay={index * 60} key={member.id}>
              <article className="team-card">
                <Link className="team-card-link" href={`/${lang}/master/profile/?id=${member.id}`}>
                  <div className="team-card-portrait">
                    {photoSrc ? (
                      <img alt={member.displayName} src={photoSrc} />
                    ) : (
                      <span>{initialsOf(member.displayName)}</span>
                    )}
                  </div>
                  <h3 className="team-card-name">{member.displayName}</h3>
                  {role.length > 0 ? <p className="team-card-role">{role}</p> : null}
                </Link>
                <Button
                  className="team-card-cta"
                  href={`/${lang}/contact/?staff=${member.id}`}
                  variant="solid"
                >
                  {bookCta}
                </Button>
              </article>
            </Reveal>
          );
        })}
      </div>
    </div>
  );
}
