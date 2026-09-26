"use client";

import Link from "next/link";
import { useRef, type ReactNode } from "react";

type MagneticButtonProps = {
  href: string;
  children: ReactNode;
  className?: string;
  external?: boolean;
};

export function MagneticButton({
  href,
  children,
  className,
  external
}: MagneticButtonProps) {
  const ref = useRef<HTMLAnchorElement>(null);

  function handleMove(event: React.MouseEvent<HTMLAnchorElement>) {
    const node = ref.current;
    if (!node || window.matchMedia("(pointer: coarse)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const bounds = node.getBoundingClientRect();
    const relativeX = event.clientX - bounds.left - bounds.width / 2;
    const relativeY = event.clientY - bounds.top - bounds.height / 2;
    node.style.transform = `translate(${relativeX * 0.25}px, ${relativeY * 0.35}px)`;
  }

  function handleLeave() {
    const node = ref.current;
    if (!node) return;
    node.style.transform = "translate(0, 0)";
  }

  const linkProps = external
    ? { target: "_blank", rel: "noreferrer noopener" }
    : {};

  return (
    <Link
      className={`magnetic-button${className ? ` ${className}` : ""}`}
      href={href}
      onMouseLeave={handleLeave}
      onMouseMove={handleMove}
      ref={ref}
      {...linkProps}
    >
      <span>{children}</span>
    </Link>
  );
}
