"use client";

import { useEffect, useState } from "react";

const SLIDE_DURATION_MS = 8000;

export function HeroCarousel({ sources }: { sources: string[] }) {
  const [index, setIndex] = useState(0);
  const total = sources.length;

  function goPrev() {
    setIndex((current) => (current - 1 + total) % total);
  }

  function goNext() {
    setIndex((current) => (current + 1) % total);
  }

  useEffect(() => {
    if (total <= 1) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const timeoutId = setTimeout(() => {
      setIndex((current) => (current + 1) % total);
    }, SLIDE_DURATION_MS);

    return () => clearTimeout(timeoutId);
  }, [index, total]);

  return (
    <>
      <video
        key={sources[index]}
        className="hero-bg-video"
        src={sources[index]}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
      />
      {total > 1 && (
        <div className="hero-carousel-controls">
          <button
            type="button"
            className="hero-carousel-arrow"
            onClick={goPrev}
            aria-label="Previous video"
          >
            ‹
          </button>
          <button
            type="button"
            className="hero-carousel-arrow"
            onClick={goNext}
            aria-label="Next video"
          >
            ›
          </button>
        </div>
      )}
    </>
  );
}
