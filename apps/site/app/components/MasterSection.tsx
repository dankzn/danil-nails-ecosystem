"use client";

import type { Locale } from "../i18n/locales";
import { masterPositions, useStaff } from "../lib/use-staff";
import { Reveal } from "./Reveal";
import { TeamGrid } from "./TeamGrid";

type MasterDict = {
  kicker: string;
  headingPre: string;
  headingEm: string;
  lede: string;
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
  // Only people holding an actual craft ("master") role appear here — a
  // public-but-organizational title (co-founder, SMM manager) is not
  // enough, and nobody gets a bigger card than anyone else.
  const masters = (staff ?? []).filter((member) => masterPositions(member.positions).length > 0);

  return (
    <section className="section section-first">
      <div className="wrap">
        <Reveal>
          <p className="section-kicker">{master.kicker}</p>
          <h1 className="section-heading">
            {master.headingPre}
            <em>{master.headingEm}</em>
          </h1>
          <p className="section-lede">{master.lede}</p>
        </Reveal>

        <Reveal delay={100}>
          {staff === null ? (
            <p className="team-status">{team.loading}</p>
          ) : masters.length === 0 ? (
            <p className="team-status">{team.empty}</p>
          ) : (
            <TeamGrid bookCta={team.bookCta} lang={lang} staff={masters} />
          )}
        </Reveal>
      </div>
    </section>
  );
}
