"use client";

import type { Locale } from "../i18n/locales";
import { initialsOf, localizedPositions, staffPhotoSrc, useStaff } from "../lib/use-staff";
import { Button } from "./Button";
import { Reveal } from "./Reveal";
import { TeamGrid } from "./TeamGrid";

type MasterDict = {
  kicker: string;
  headingPre: string;
  headingEm: string;
  name: string;
  role: string;
  bio: string;
  facts: { value: string; label: string }[];
};

type TeamDict = {
  heading: string;
  loading: string;
  empty: string;
  bookCta: string;
};

type MasterSectionProps = {
  lang: Locale;
  master: MasterDict;
  team: TeamDict;
};

export function MasterSection({ lang, master, team }: MasterSectionProps) {
  const staff = useStaff();
  // While loading, or if the CRM has nobody bookable yet, fall back to the
  // static copy below rather than showing an empty hero.
  const primary = staff && staff.length > 0 ? staff[0] : null;
  const rest = staff && staff.length > 1 ? staff.slice(1) : [];

  const name = primary?.displayName ?? master.name;
  const roles = primary ? localizedPositions(primary.positions, lang) : [];
  const role = roles.length > 0 ? roles.join(" · ") : master.role;
  const bio = primary?.bio ?? master.bio;
  const photoSrc = primary ? staffPhotoSrc(primary.photoUrl) : null;
  const bookHref = primary ? `/${lang}/contact/?staff=${primary.id}` : `/${lang}/contact/`;

  return (
    <>
      <section className="section section-first">
        <div className="wrap">
          <Reveal>
            <p className="section-kicker">{master.kicker}</p>
            <h1 className="section-heading">
              {master.headingPre}
              <em>{master.headingEm}</em>
            </h1>
          </Reveal>

          <div className="master-block">
            <Reveal>
              <div className="master-portrait">
                {photoSrc ? (
                  <img alt={name} src={photoSrc} />
                ) : (
                  <span>{initialsOf(name)}</span>
                )}
              </div>
            </Reveal>
            <Reveal delay={100}>
              <div>
                <h2 className="master-name">{name}</h2>
                <p className="master-role">{role}</p>
                <p className="master-bio">{bio}</p>
                <div className="master-facts">
                  {master.facts.map((fact) => (
                    <div key={fact.label}>
                      <strong>{fact.value}</strong>
                      <span>{fact.label}</span>
                    </div>
                  ))}
                </div>
                <Button className="master-book-cta" href={bookHref} variant="solid">
                  {team.bookCta}
                </Button>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {rest.length > 0 ? (
        <section className="section">
          <div className="wrap">
            <TeamGrid bookCta={team.bookCta} heading={team.heading} lang={lang} staff={rest} />
          </div>
        </section>
      ) : null}
    </>
  );
}
