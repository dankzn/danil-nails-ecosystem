"use client";

import { useState } from "react";

export function VideoBlock({
  label,
  note,
  playLabel,
  playNote,
  src,
  autoPlay = true
}: {
  label: string;
  note: string;
  playLabel?: string;
  playNote?: string;
  src?: string;
  autoPlay?: boolean;
}) {
  const [isPlaying, setIsPlaying] = useState(autoPlay && Boolean(src));

  if (!src) {
    return (
      <div className="video-block">
        <div className="video-block-placeholder">
          <span className="video-block-play" aria-hidden="true" />
          <span className="video-block-label">{label}</span>
          <span className="video-block-note">{note}</span>
        </div>
      </div>
    );
  }

  if (!isPlaying) {
    return (
      <button
        type="button"
        className="video-block video-block-trigger"
        onClick={() => setIsPlaying(true)}
      >
        <div className="video-block-placeholder">
          <span className="video-block-play" aria-hidden="true" />
          <span className="video-block-label">{playLabel ?? label}</span>
          <span className="video-block-note">{playNote ?? note}</span>
        </div>
      </button>
    );
  }

  return (
    <div className="video-block">
      <video
        className="video-block-media"
        src={src}
        autoPlay
        muted
        loop
        playsInline
        preload={autoPlay ? "auto" : "metadata"}
      />
    </div>
  );
}
