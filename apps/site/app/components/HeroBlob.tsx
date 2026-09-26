"use client";

import { useEffect, useRef } from "react";

export function HeroBlob() {
  const blobRef = useRef<HTMLDivElement>(null);
  const target = useRef({ x: 0, y: 0 });
  const current = useRef({ x: 0, y: 0 });
  const frameId = useRef<number>(0);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
    if (reduceMotion || coarsePointer) return;

    function onMouseMove(event: MouseEvent) {
      const relX = event.clientX / window.innerWidth - 0.5;
      const relY = event.clientY / window.innerHeight - 0.5;
      target.current = { x: relX * 52, y: relY * 36 };
    }

    function tick() {
      current.current.x += (target.current.x - current.current.x) * 0.06;
      current.current.y += (target.current.y - current.current.y) * 0.06;
      const node = blobRef.current;
      if (node) {
        node.style.transform = `translate3d(${current.current.x}px, ${current.current.y}px, 0)`;
      }
      frameId.current = requestAnimationFrame(tick);
    }

    window.addEventListener("mousemove", onMouseMove);
    frameId.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      cancelAnimationFrame(frameId.current);
    };
  }, []);

  return (
    <div className="hero-blob-wrap" aria-hidden="true">
      <div className="hero-blob-ring" />
      <div className="hero-blob" ref={blobRef} />
    </div>
  );
}
