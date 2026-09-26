"use client";

import { useState } from "react";

export function HeroCarousel({ sources }: { sources: string[] }) {
  const [index, setIndex] = useState(0);
  const total = sources.length;

  function goPrev() {
    setIndex((current) => (current - 1 + total) % total);
  }

  function goNext() {
    setIndex((current) => (current + 1) % total);
  }

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
