"use client";

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";

type RevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: "div" | "span" | "li";
};

export function Reveal({ children, className, delay = 0, as = "div" }: RevealProps) {
  const ref = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // Anything already on screen at mount (above the fold, or just below it)
    // should appear right away. The rootMargin below trims the bottom of the
    // viewport so deeper content reveals a moment before it's fully in view
    // while scrolling — but that same trim means content sitting at the fold
    // on first load never crosses the threshold until an actual scroll event
    // re-evaluates it, so it stays invisible until the user scrolls or
    // reloads at a different scroll position. Bypass the observer for that
    // case with a direct geometry check.
    const rect = node.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.disconnect();
          }
        }
      },
      { threshold: 0.2, rootMargin: "0px 0px -10% 0px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const Tag = as;

  return (
    <Tag
      className={`reveal${isVisible ? " reveal-visible" : ""}${className ? ` ${className}` : ""}`}
      ref={ref as RefObject<HTMLDivElement & HTMLSpanElement & HTMLLIElement>}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </Tag>
  );
}
