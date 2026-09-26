"use client";

import { useEffect, useRef } from "react";

export function CursorGlow() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(pointer: coarse)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const node = ref.current;
    if (!node) return;

    let frame = 0;
    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight / 2;
    let currentX = targetX;
    let currentY = targetY;

    function onMove(event: MouseEvent) {
      targetX = event.clientX;
      targetY = event.clientY;
    }

    function animate() {
      currentX += (targetX - currentX) * 0.12;
      currentY += (targetY - currentY) * 0.12;
      if (node) {
        node.style.transform = `translate(${currentX}px, ${currentY}px)`;
      }
      frame = requestAnimationFrame(animate);
    }

    window.addEventListener("mousemove", onMove);
    frame = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(frame);
    };
  }, []);

  return <div aria-hidden="true" className="cursor-glow" ref={ref} />;
}
