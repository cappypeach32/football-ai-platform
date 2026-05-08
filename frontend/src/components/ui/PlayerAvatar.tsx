"use client";

import { useState } from "react";
import { User } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  src: string | null | undefined;
  name?: string;
  className?: string;
}

/** Renders a player headshot. Falls back to a generic icon on broken/missing URLs. */
export function PlayerAvatar({ src, name = "", className }: Props) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={cn(
          "w-8 h-8 rounded-full bg-surface-elevated flex items-center justify-center flex-shrink-0",
          className
        )}
        title={name}
      >
        <User className="w-4 h-4 text-muted-foreground" />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name}
      className={cn("w-8 h-8 rounded-full object-cover flex-shrink-0", className)}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
