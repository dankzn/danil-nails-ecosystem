"use client";

import { useEffect, useState } from "react";
import type { Dictionary } from "../i18n/dictionary";
import { apiUrl } from "../lib/api-url";

type Allergen = { id: string; title: string; description: string | null };
type Status = "loading" | "ready" | "saving" | "saved" | "error";

export function AllergiesEditor({ dict }: { dict: Dictionary["account"] }) {
  const [status, setStatus] = useState<Status>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [options, setOptions] = useState<Allergen[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [noKnownAllergies, setNoKnownAllergies] = useState(false);
  const [customNote, setCustomNote] = useState("");

  useEffect(() => {
    Promise.all([
      fetch(`${apiUrl}/v1/allergens`).then((response) => response.json()),
      fetch(`${apiUrl}/v1/me/allergies`, { credentials: "include" }).then((response) =>
        response.ok ? response.json() : null
      )
    ])
      .then(([allergensData, mine]) => {
        setOptions(allergensData?.allergens ?? []);
        if (mine) {
          setSelectedIds(mine.allergens.map((allergen: Allergen) => allergen.id));
          setNoKnownAllergies(mine.noKnownAllergies);
          setCustomNote(mine.customAllergyNote ?? "");
        }
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, []);

  function toggleAllergen(id: string) {
    setNoKnownAllergies(false);
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  }

  function toggleNoKnownAllergies() {
    setNoKnownAllergies((current) => {
      const next = !current;
      if (next) {
        setSelectedIds([]);
        setCustomNote("");
      }
      return next;
    });
  }

  async function handleSave() {
    setStatus("saving");
    setErrorMessage(null);

    try {
      const response = await fetch(`${apiUrl}/v1/me/allergies`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          noKnownAllergies,
          allergenIds: selectedIds,
          customAllergyNote: customNote.trim() || null
        })
      });

      if (response.ok) {
        setStatus("saved");
        return;
      }

      if (response.status === 400) {
        const body = await response.json().catch(() => null);
        setStatus("error");
        setErrorMessage(
          body?.error === "allergy_state_conflict"
            ? dict.allergiesErrorConflict
            : dict.allergiesErrorInvalid
        );
        return;
      }

      setStatus("error");
      setErrorMessage(dict.allergiesErrorInvalid);
    } catch {
      setStatus("error");
      setErrorMessage(dict.allergiesErrorNetwork);
    }
  }

  if (status === "loading") {
    return <p className="section-lede">{dict.loadingLabel}</p>;
  }

  return (
    <section className="account-allergies">
      <h2>{dict.allergiesHeading}</h2>
      <p>{dict.allergiesLede}</p>

      <label className="allergy-toggle">
        <input
          type="checkbox"
          checked={noKnownAllergies}
          onChange={toggleNoKnownAllergies}
        />
        {dict.noKnownAllergiesLabel}
      </label>

      <div className="tag-cloud" aria-disabled={noKnownAllergies}>
        {options.map((allergen) => {
          const isSelected = selectedIds.includes(allergen.id);
          return (
            <button
              key={allergen.id}
              type="button"
              className={`allergy-option${isSelected ? " allergy-option-selected" : ""}`}
              aria-pressed={isSelected}
              disabled={noKnownAllergies}
              title={allergen.description ?? undefined}
              onClick={() => toggleAllergen(allergen.id)}
            >
              {allergen.title}
            </button>
          );
        })}
      </div>

      <div className="register-field">
        <label htmlFor="customAllergyNote">{dict.customAllergyLabel}</label>
        <input
          id="customAllergyNote"
          type="text"
          maxLength={1000}
          placeholder={dict.customAllergyPlaceholder}
          disabled={noKnownAllergies}
          value={customNote}
          onChange={(event) => {
            setNoKnownAllergies(false);
            setCustomNote(event.target.value);
          }}
        />
      </div>

      {status === "error" && errorMessage ? (
        <p className="register-error" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <button
        type="button"
        className="btn account-save"
        disabled={status === "saving"}
        onClick={handleSave}
      >
        <span>
          {status === "saving"
            ? dict.savingLabel
            : status === "saved"
              ? dict.savedLabel
              : dict.saveLabel}
        </span>
      </button>
    </section>
  );
}
