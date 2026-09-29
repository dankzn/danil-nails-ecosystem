"use client";

import { useMemo, useState } from "react";
import type { Locale } from "../i18n/locales";
import { masterPositions, useStaff, type LocationRef } from "../lib/use-staff";
import { Reveal } from "./Reveal";
import { TeamGrid } from "./TeamGrid";

type MasterDict = {
  kicker: string;
  headingPre: string;
  headingEm: string;
  lede: string;
  countryLabel: string;
  cityLabel: string;
  allCountriesLabel: string;
  allCitiesLabel: string;
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

function uniqueLocations(refs: (LocationRef | null)[]) {
  const byId = new Map<string, LocationRef>();
  for (const ref of refs) {
    if (ref) byId.set(ref.id, ref);
  }
  return [...byId.values()].sort((a, b) => a.title.localeCompare(b.title));
}

export function MasterSection({ lang, master, team }: MasterSectionProps) {
  const staff = useStaff();
  const [countryId, setCountryId] = useState("");
  const [cityId, setCityId] = useState("");

  // Only people holding an actual craft ("master") role appear here — a
  // public-but-organizational title (co-founder, SMM manager) is not
  // enough, and nobody gets a bigger card than anyone else.
  const masters = useMemo(
    () => (staff ?? []).filter((member) => masterPositions(member.positions).length > 0),
    [staff]
  );

  // The studio is single-city today, so this stays dormant (no options to
  // choose between) until a second country/city shows up in staff data —
  // at which point it activates on its own, no further code changes.
  const countries = useMemo(() => uniqueLocations(masters.map((member) => member.country)), [
    masters
  ]);
  const cities = useMemo(
    () =>
      uniqueLocations(
        masters
          .filter((member) => !countryId || member.country?.id === countryId)
          .map((member) => member.city)
      ),
    [masters, countryId]
  );
  const showLocationFilters = countries.length > 1 || cities.length > 1;

  const filteredMasters = useMemo(
    () =>
      masters.filter((member) => {
        if (countryId && member.country?.id !== countryId) return false;
        if (cityId && member.city?.id !== cityId) return false;
        return true;
      }),
    [masters, countryId, cityId]
  );

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

        {showLocationFilters ? (
          <Reveal delay={60}>
            <div className="master-location-filters">
              <label className="master-location-filter">
                <span>{master.countryLabel}</span>
                <select
                  onChange={(event) => {
                    setCountryId(event.target.value);
                    setCityId("");
                  }}
                  value={countryId}
                >
                  <option value="">{master.allCountriesLabel}</option>
                  {countries.map((country) => (
                    <option key={country.id} value={country.id}>
                      {country.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="master-location-filter">
                <span>{master.cityLabel}</span>
                <select onChange={(event) => setCityId(event.target.value)} value={cityId}>
                  <option value="">{master.allCitiesLabel}</option>
                  {cities.map((city) => (
                    <option key={city.id} value={city.id}>
                      {city.title}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </Reveal>
        ) : null}

        <Reveal delay={100}>
          {staff === null ? (
            <p className="team-status">{team.loading}</p>
          ) : filteredMasters.length === 0 ? (
            <p className="team-status">{team.empty}</p>
          ) : (
            <TeamGrid bookCta={team.bookCta} lang={lang} staff={filteredMasters} />
          )}
        </Reveal>
      </div>
    </section>
  );
}
