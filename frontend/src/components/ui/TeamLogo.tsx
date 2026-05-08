"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface Props {
  src: string | null | undefined;
  name?: string;
  className?: string;
  size?: number;
}

/** Renders a team/league logo. Falls back to a 2-letter initials badge on broken URLs. */
export function TeamLogo({ src, name = "", className, size }: Props) {
  const [failed, setFailed] = useState(false);

  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");

  if (!src || failed) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded bg-surface-elevated text-muted-foreground font-bold text-[10px] select-none flex-shrink-0",
          className
        )}
        style={size ? { width: size, height: size, fontSize: size * 0.3 } : undefined}
        title={name}
      >
        {initials || "?"}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name}
      className={cn("object-contain flex-shrink-0", className)}
      style={size ? { width: size, height: size } : undefined}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
