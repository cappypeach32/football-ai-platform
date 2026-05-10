"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X, Shield, Activity, Calendar, User } from "lucide-react";
import { cn } from "@/lib/utils";
import type { InjuredPlayerInfo } from "@/types";

interface Props {
  player: InjuredPlayerInfo;
  onClose: () => void;
}

function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  const styles =
    s === "suspended"
      ? "bg-red-500/15 text-red-400 border-red-500/30"
      : s === "doubtful"
      ? "bg-amber-400/15 text-amber-400 border-amber-400/30"
      : "bg-orange-400/15 text-orange-400 border-orange-400/30";
  const icon =
    s === "suspended" ? <Shield className="w-3 h-3" /> : <Activity className="w-3 h-3" />;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-bold uppercase tracking-wide",
        styles
      )}
    >
      {icon}
      {status}
    </span>
  );
}

function ChanceBar({ value }: { value: number }) {
  const color =
    value === 0
      ? "bg-red-500"
      : value <= 25
      ? "bg-orange-500"
      : value <= 50
      ? "bg-amber-400"
      : "bg-emerald-400";
  const textColor =
    value === 0
      ? "text-red-400"
      : value <= 25
      ? "text-orange-400"
      : value <= 50
      ? "text-amber-400"
      : "text-emerald-400";
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">Chance of playing</span>
        <span className={cn("font-bold tabular-nums", textColor)}>{value}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-surface-elevated overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", color)}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

export function PlayerCardModal({ player, onClose }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Trap body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const content = (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" aria-hidden />

      {/* Card */}
      <div className="relative w-full max-w-sm rounded-2xl border border-surface-border bg-surface-card shadow-2xl overflow-hidden">
        {/* Top gradient stripe based on status */}
        <div
          className={cn(
            "h-1 w-full",
            player.status.toLowerCase() === "suspended"
              ? "bg-gradient-to-r from-red-500 to-red-400"
              : player.status.toLowerCase() === "doubtful"
              ? "bg-gradient-to-r from-amber-400 to-yellow-400"
              : "bg-gradient-to-r from-orange-500 to-orange-400"
          )}
        />

        {/* Header row */}
        <div className="flex items-start gap-4 p-5 pb-4">
          {/* Photo or fallback */}
          <div className="flex-shrink-0">
            {player.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={player.photo_url}
                alt={player.name}
                className="w-20 h-20 rounded-xl object-cover border border-surface-border"
                onError={(e) => {
                  const el = e.currentTarget as HTMLImageElement;
                  el.style.display = "none";
                  const fallback = el.nextElementSibling as HTMLElement | null;
                  if (fallback) fallback.style.display = "flex";
                }}
              />
            ) : null}
            <div
              className={cn(
                "w-20 h-20 rounded-xl bg-surface-elevated border border-surface-border items-center justify-center",
                player.photo_url ? "hidden" : "flex"
              )}
            >
              <User className="w-8 h-8 text-muted-foreground" />
            </div>
          </div>

          {/* Name + position + status */}
          <div className="flex-1 min-w-0 pt-0.5">
            <h3 className="text-lg font-bold text-foreground leading-tight truncate">
              {player.name}
            </h3>
            {player.position && (
              <p className="text-sm text-muted-foreground mt-0.5">{player.position}</p>
            )}
            <div className="mt-2">
              <StatusBadge status={player.status} />
            </div>
          </div>

          {/* Close */}
          <button
            onClick={onClose}
            className="flex-shrink-0 w-7 h-7 rounded-full bg-surface-elevated hover:bg-surface-border flex items-center justify-center transition-colors"
            aria-label="Close"
          >
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 pb-5 space-y-4">
          <hr className="border-surface-border" />

          {/* Chance of playing bar */}
          {player.chance_of_playing !== null && player.chance_of_playing !== undefined && (
            <ChanceBar value={player.chance_of_playing} />
          )}

          {/* Injury detail */}
          {player.detail && (
            <div className="flex items-start gap-2">
              <Activity className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
              <p className="text-sm text-foreground/80 leading-snug">{player.detail}</p>
            </div>
          )}

          {/* Return date */}
          {player.return_date && (
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              <p className="text-sm text-foreground/80">
                Expected back:{" "}
                <span className="font-semibold text-foreground">{player.return_date}</span>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Render outside DOM hierarchy to avoid clipping
  if (typeof window === "undefined") return null;
  return createPortal(content, document.body);
}
