"use client";

import type { Locale } from "../i18n/locales";
import { initialsOf, localizedPosition, staffPhotoSrc, type StaffMember } from "../lib/use-staff";
import { Reveal } from "./Reveal";

type TeamGridProps = {
  lang: Locale;
  heading: string;
  staff: StaffMember[];
};

export function TeamGrid({ lang, heading, staff }: TeamGridProps) {
  if (staff.length === 0) return null;

  return (
    <div className="team-section">
      <Reveal>
        <h2 className="team-heading">{heading}</h2>
      </Reveal>
      <div className="team-grid">
        {staff.map((member, index) => {
          const role = localizedPosition(member.position, lang);
          const photoSrc = staffPhotoSrc(member.photoUrl);
          return (
            <Reveal delay={index * 60} key={member.id}>
              <article className="team-card">
                <div className="team-card-portrait">
                  {photoSrc ? (
                    <img alt={member.displayName} src={photoSrc} />
                  ) : (
                    <span>{initialsOf(member.displayName)}</span>
                  )}
                </div>
                <h3 className="team-card-name">{member.displayName}</h3>
                {role ? <p className="team-card-role">{role}</p> : null}
                {member.bio ? <p className="team-card-bio">{member.bio}</p> : null}
              </article>
            </Reveal>
          );
        })}
      </div>
    </div>
  );
}
