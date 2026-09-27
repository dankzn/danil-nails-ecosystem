"use client";

import { useEffect, useState } from "react";

const SESSION_KEY = "dns-preloaded";
const EXIT_DURATION_MS = 750;
const MIN_VISIBLE_MS = 900;

export function Preloader() {
  const [visible, setVisible] = useState(true);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY)) {
      setVisible(false);
      return;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      sessionStorage.setItem(SESSION_KEY, "1");
      setVisible(false);
      return;
    }

    document.body.classList.add("no-scroll");

    const minDelay = new Promise((resolve) => setTimeout(resolve, MIN_VISIBLE_MS));
    const ready = new Promise((resolve) => {
      if (document.readyState === "complete") {
        resolve(undefined);
      } else {
        window.addEventListener("load", () => resolve(undefined), { once: true });
      }
    });

    let hideTimeout: ReturnType<typeof setTimeout>;
    Promise.all([minDelay, ready]).then(() => {
      sessionStorage.setItem(SESSION_KEY, "1");
      setLeaving(true);
      hideTimeout = setTimeout(() => {
        setVisible(false);
        document.body.classList.remove("no-scroll");
      }, EXIT_DURATION_MS);
    });

    return () => clearTimeout(hideTimeout);
  }, []);

  if (!visible) return null;

  return (
    <div className={`preloader${leaving ? " preloader-leaving" : ""}`} aria-hidden="true">
      <div className="preloader-mark">
        <span className="preloader-mark-name">Danil Nails</span>
        <span className="preloader-mark-copy">Studio</span>
      </div>
    </div>
  );
}
