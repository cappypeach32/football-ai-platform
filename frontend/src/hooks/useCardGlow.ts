"use client";

import { useRef, useCallback } from "react";
import type { MouseEvent } from "react";

/**
 * Returns event handlers that create a radial gradient glow
 * tracking the cursor position within the card element.
 *
 * Usage:
 *   const glow = useCardGlow();
 *   <div {...glow.handlers} style={glow.style} className="card-glow" />
 */
export function useCardGlow(color = "0,255,135", intensity = 0.12) {
  const ref = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    el.style.setProperty(
      "--glow-bg",
      `radial-gradient(260px circle at ${x}px ${y}px, rgba(${color},${intensity}) 0%, transparent 70%)`
    );
  }, [color, intensity]);

  const handleMouseLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--glow-bg", "none");
  }, []);

  return {
    ref,
    handlers: {
      onMouseMove: handleMouseMove,
      onMouseLeave: handleMouseLeave,
    },
  };
}
