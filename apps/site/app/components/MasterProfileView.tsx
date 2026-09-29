"use client";

import { useEffect, useState } from "react";
import type { Dictionary } from "../i18n/dictionary";
import type { Locale } from "../i18n/locales";
import {
  embeddableVideoSrc,
  experienceLabel,
  initialsOf,
  localizedPositions,
  masterPositions,
  staffPhotoSrc,
  useStaff
} from "../lib/use-staff";
import { Button } from "./Button";
import { Reveal } from "./Reveal";

export function MasterProfileView({ dict, lang }: { dict: Dictionary; lang: Locale }) {
  const staff = useStaff();
  const [staffId, setStaffId] = useState<string | null>(null);

  useEffect(() => {
    setStaffId(new URLSearchParams(window.location.search).get("id"));
  }, []);

  const member =
    staffId && staff ? staff.find((candidate) => candidate.id === staffId) ?? null : null;
  const role = member ? localizedPositions(masterPositions(member.positions), lang).join(" · ") : "";
  const photoSrc = member ? staffPhotoSrc(member.photoUrl) : null;
  const experience = member ? experienceLabel(member.experienceYears, lang) : null;
  const videoEmbedSrc = member ? embeddableVideoSrc(member.worksVideoUrl) : null;

  return (
    <section className="section section-first">
      <div className="wrap">
        <Reveal>
          <a className="master-profile-back" href={`/${lang}/master/`}>
            ← {dict.masterProfile.backLink}
          </a>
        </Reveal>

        {staff === null || staffId === null ? (
          <p className="team-status">{dict.masterProfile.loading}</p>
        ) : !member ? (
          <p className="team-status">{dict.masterProfile.notFound}</p>
        ) : (
          <Reveal delay={100}>
            <div className="master-profile">
              <div className="master-profile-portrait">
                {photoSrc ? (
                  <img alt={member.displayName} src={photoSrc} />
                ) : (
                  <span>{initialsOf(member.displayName)}</span>
                )}
              </div>
              <div className="master-profile-body">
                <h1 className="master-profile-name">{member.displayName}</h1>
                {role.length > 0 ? <p className="master-profile-role">{role}</p> : null}
                {experience ? <p className="master-profile-experience">{experience}</p> : null}

                {member.philosophy ? (
                  <div className="master-profile-section">
                    <h2>{dict.masterProfile.philosophyHeading}</h2>
                    <p>{member.philosophy}</p>
                  </div>
                ) : null}

                {member.worksVideoUrl ? (
                  <div className="master-profile-section">
                    <h2>{dict.masterProfile.videoHeading}</h2>
                    {videoEmbedSrc ? (
                      <div className="master-profile-video">
                        <iframe
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          loading="lazy"
                          src={videoEmbedSrc}
                          title={dict.masterProfile.videoHeading}
                        />
                      </div>
                    ) : (
                      <a href={member.worksVideoUrl} rel="noreferrer" target="_blank">
                        {dict.masterProfile.videoFallback}
                      </a>
                    )}
                  </div>
                ) : null}

                <Button
                  className="master-profile-cta"
                  href={`/${lang}/contact/?staff=${member.id}`}
                  variant="solid"
                >
                  {dict.team.bookCta}
                </Button>
              </div>
            </div>
          </Reveal>
        )}
      </div>
    </section>
  );
}
