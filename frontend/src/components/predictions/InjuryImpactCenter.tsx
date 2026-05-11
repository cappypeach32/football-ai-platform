"use client";

import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Shield, Users, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { predictionsService } from "@/services/predictionsService";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AbsentPlayer {
  web_name: string;
  position: string;
  status: string;
  xg: number;
  xa: number;
  ict_index: number;
  threat: number;
  influence: number;
  minutes: number;
  now_cost: number;
  chance_of_playing: number | null;
}

interface TeamInjuryImpact {
  team: string;
  absent_count: number;
  missing_xg: number;
  missing_xa: number;
  missing_xg_pct: number;
  most_impactful: string | null;
  most_impactful_pos: string | null;
  most_impactful_role: string | null;
  defenders_out: number;
  attack_impact: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  defensive_stability_pct: number;
  impact_level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  prob_shift: number;
  ai_summary: string;
  absent_players: AbsentPlayer[];
}

interface InjuryImpactResponse {
  prediction_id: number;
  league_slug: string;
  is_pl_only: boolean;
  home: TeamInjuryImpact | null;
  away: TeamInjuryImpact | null;
}

// ─── Design tokens ────────────────────────────────────────────────────────────

const LEVEL = {
  LOW: {
    label:       "LOW",
    text:        "text-emerald-400",
    subtext:     "text-emerald-400/60",
    border:      "border-emerald-500/20",
    gradient:    "from-emerald-500/8 to-transparent",
    badgeBg:     "bg-emerald-500/10",
    dot:         "bg-emerald-400",
    glow:        "shadow-emerald-500/5",
  },
  MEDIUM: {
    label:       "MEDIUM",
    text:        "text-amber-400",
    subtext:     "text-amber-400/60",
    border:      "border-amber-400/20",
    gradient:    "from-amber-400/8 to-transparent",
    badgeBg:     "bg-amber-400/10",
    dot:         "bg-amber-400",
    glow:        "shadow-amber-400/5",
  },
  HIGH: {
    label:       "HIGH",
    text:        "text-orange-400",
    subtext:     "text-orange-400/60",
    border:      "border-orange-400/20",
    gradient:    "from-orange-400/8 to-transparent",
    badgeBg:     "bg-orange-400/10",
    dot:         "bg-orange-400",
    glow:        "shadow-orange-400/5",
  },
  CRITICAL: {
    label:       "CRITICAL",
    text:        "text-red-400",
    subtext:     "text-red-400/60",
    border:      "border-red-500/20",
    gradient:    "from-red-500/10 to-transparent",
    badgeBg:     "bg-red-500/10",
    dot:         "bg-red-400",
    glow:        "shadow-red-500/8",
  },
} as const;

// ─── Metric block ─────────────────────────────────────────────────────────────

function MetricBlock({
  label,
  value,
  valueClass,
  note,
}: {
  label: string;
  value: string;
  valueClass?: string;
  note?: string;
}) {
  return (
    <motion.div
      whileHover={{ backgroundColor: "rgba(255,255,255,0.025)" }}
      className="flex flex-col gap-1.5 px-5 py-4 rounded-lg transition-colors"
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/50 leading-none">
        {label}
      </p>
      <p className={cn("text-2xl font-black tabular-nums leading-none", valueClass ?? "text-foreground")}>
        {value}
      </p>
      {note && (
        <p className="text-[10px] text-muted-foreground/40 leading-none">{note}</p>
      )}
    </motion.div>
  );
}

// ─── Absent player row ────────────────────────────────────────────────────────

function AbsentRow({ player, index }: { player: AbsentPlayer; index: number }) {
  const posAbbr =
    player.position.includes("Goalkeeper") ? "GK"  :
    player.position.includes("Defender")   ? "DEF" :
    player.position.includes("Midfielder") ? "MID" :
    player.position.includes("Forward")    ? "FWD" : "—";

  const posStyle =
    player.position.includes("Goalkeeper") ? "text-amber-400/80 bg-amber-400/8"    :
    player.position.includes("Defender")   ? "text-sky-400/80 bg-sky-400/8"         :
    player.position.includes("Midfielder") ? "text-violet-400/80 bg-violet-400/8"   :
    player.position.includes("Forward")    ? "text-rose-400/80 bg-rose-400/8"       :
                                             "text-muted-foreground bg-surface-elevated";

  const statusLabel =
    player.status === "Injured"   ? "OUT"   :
    player.status === "doubtful"  ? "DOUBT" :
    player.status === "suspended" ? "SUSP"  : "OUT";

  const statusStyle =
    player.status === "Injured"   ? "text-red-400/80"    :
    player.status === "doubtful"  ? "text-amber-400/80"  :
                                    "text-orange-400/80";

  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04, duration: 0.2 }}
      whileHover={{ backgroundColor: "rgba(255,255,255,0.02)" }}
      className="flex items-center gap-3 py-2.5 rounded-md px-2 -mx-2 transition-colors"
    >
      <span className={cn("text-[9px] font-black px-1.5 py-0.5 rounded shrink-0 tracking-wide", posStyle)}>
        {posAbbr}
      </span>
      <p className="text-sm font-medium text-foreground/85 flex-1 truncate">{player.web_name}</p>
      {player.chance_of_playing !== null &&
        player.chance_of_playing !== undefined &&
        player.chance_of_playing > 0 && (
          <span className="text-[10px] text-amber-400/60 shrink-0 tabular-nums">
            {player.chance_of_playing}%
          </span>
      )}
      <span className={cn("text-[10px] font-bold shrink-0 tabular-nums", statusStyle)}>
        {statusLabel}
      </span>
    </motion.div>
  );
}

// ─── Team panel ───────────────────────────────────────────────────────────────

function TeamPanel({ team, side }: { team: TeamInjuryImpact; side: "home" | "away" }) {
  const [expanded, setExpanded] = useState(false);
  const cfg    = LEVEL[team.impact_level];
  const atkCfg = LEVEL[team.attack_impact];
  const noImpact = team.absent_count === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "relative rounded-2xl border overflow-hidden",
        "bg-gradient-to-b from-[#0f0f12] to-[#0a0a0d]",
        noImpact ? "border-white/6 shadow-none" : `${cfg.border} shadow-lg ${cfg.glow}`,
      )}
    >
      {/* Severity gradient wash */}
      {!noImpact && (
        <div className={cn("absolute inset-x-0 top-0 h-32 bg-gradient-to-b pointer-events-none", cfg.gradient)} />
      )}

      {/* Content */}
      <div className="relative">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground/40 mb-1">
              {side === "home" ? "Home" : "Away"}
            </p>
            <p className="text-base font-bold text-foreground leading-none">{team.team}</p>
          </div>

          {noImpact ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/8 border border-emerald-500/15">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                Fit
              </span>
            </div>
          ) : (
            <div className={cn(
              "flex items-center gap-2 px-3.5 py-1.5 rounded-full border",
              cfg.badgeBg, cfg.border
            )}>
              <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", cfg.dot)} />
              <span className={cn("text-[10px] font-bold uppercase tracking-wider", cfg.text)}>
                {cfg.label}
              </span>
            </div>
          )}
        </div>

        {noImpact ? (
          <div className="flex items-center gap-3 px-6 pb-6 pt-1">
            <Shield className="w-4 h-4 text-emerald-400/30 shrink-0" />
            <p className="text-sm text-muted-foreground/50">
              Full squad available. No disruption detected.
            </p>
          </div>
        ) : (
          <>
            {/* ── 4-metric row ── */}
            <div className="grid grid-cols-4 px-2 pb-1">
              <MetricBlock
                label="Attack Impact"
                value={atkCfg.label}
                valueClass={cn("text-lg font-black", atkCfg.text)}
              />
              <MetricBlock
                label="Def. Stability"
                value={team.defensive_stability_pct === 0 ? "—" : `${team.defensive_stability_pct}%`}
                valueClass={team.defensive_stability_pct < 0 ? "text-orange-400" : "text-foreground"}
              />
              <MetricBlock
                label="Win Prob."
                value={team.prob_shift === 0 ? "—" : `${team.prob_shift > 0 ? "+" : ""}${team.prob_shift}pp`}
                valueClass={
                  team.prob_shift < 0 ? "text-red-400" :
                  team.prob_shift > 0 ? "text-emerald-400" :
                  "text-muted-foreground"
                }
              />
              <MetricBlock
                label="Unavailable"
                value={String(team.absent_count)}
                note={team.absent_count === 1 ? "player" : "players"}
              />
            </div>

            {/* ── Divider ── */}
            <div className="mx-6 h-px bg-white/5" />

            {/* ── Key absence ── */}
            {team.most_impactful && (
              <div className="px-6 py-4">
                <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/40 mb-2">
                  Key Absence
                </p>
                <div className="flex items-baseline gap-2">
                  <p className="text-base font-bold text-foreground">{team.most_impactful}</p>
                  {team.most_impactful_role && (
                    <p className="text-xs text-amber-400/70 font-medium">{team.most_impactful_role}</p>
                  )}
                </div>
              </div>
            )}

            {/* ── Divider ── */}
            <div className="mx-6 h-px bg-white/5" />

            {/* ── AI Assessment — prominent block ── */}
            <div className="px-6 py-5">
              <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/40 mb-3">
                Intelligence Assessment
              </p>
              <p className="text-sm text-foreground/75 leading-relaxed font-normal">
                {team.ai_summary}
              </p>
            </div>

            {/* ── Expandable roster ── */}
            {team.absent_players.length > 0 && (
              <>
                <div className="mx-6 h-px bg-white/5" />
                <button
                  onClick={() => setExpanded((v) => !v)}
                  className={cn(
                    "w-full flex items-center justify-between px-6 py-3.5",
                    "text-[10px] font-semibold uppercase tracking-wider",
                    "text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors",
                  )}
                >
                  <span>
                    {expanded ? "Hide" : "View"} squad absentees&nbsp;
                    <span className="tabular-nums">({team.absent_players.length})</span>
                  </span>
                  <motion.span
                    animate={{ rotate: expanded ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </motion.span>
                </button>

                <AnimatePresence>
                  {expanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="px-6 pb-5 pt-1 space-y-0.5">
                        {team.absent_players.map((p, i) => (
                          <AbsentRow key={i} player={p} index={i} />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

interface Props {
  predictionId: number;
  homeTeam: string;
  awayTeam: string;
}

export function InjuryImpactCenter({ predictionId, homeTeam, awayTeam }: Props) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["injury-impact", predictionId],
    queryFn: () =>
      predictionsService.getInjuryImpact(predictionId).then((r) => r.data as InjuryImpactResponse),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const totalAbsent = (data?.home?.absent_count ?? 0) + (data?.away?.absent_count ?? 0);

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35, duration: 0.4 }}
    >
      {/* Section heading */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-[3px] h-7 rounded-full bg-neon-green shrink-0" />
          <div>
            <h2 className="text-base font-bold text-foreground tracking-tight leading-none mb-0.5">
              Injury Impact Center
            </h2>
            <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/40 leading-none">
              Squad Intelligence · Premier League
            </p>
          </div>
        </div>
        {!isLoading && !isError && totalAbsent > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500/8 border border-red-500/15"
          >
            <Users className="w-3 h-3 text-red-400" />
            <span className="text-[10px] font-bold text-red-400">{totalAbsent} absent</span>
          </motion.div>
        )}
      </div>

      <AnimatePresence mode="wait">
        {isLoading && (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[0, 1].map((i) => (
                <div
                  key={i}
                  className="h-[280px] rounded-2xl bg-gradient-to-b from-white/[0.03] to-transparent border border-white/6 animate-pulse"
                />
              ))}
            </div>
          </motion.div>
        )}

        {isError && (
          <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="rounded-2xl border border-white/6 bg-[#0f0f12] px-6 py-5 flex items-center gap-4">
              <AlertTriangle className="w-4 h-4 text-amber-400/40 shrink-0" />
              <p className="text-sm text-muted-foreground/50">Squad intelligence temporarily unavailable</p>
            </div>
          </motion.div>
        )}

        {data && !isLoading && !isError && (
          <motion.div key="data" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {data.league_slug !== "ENG.1" ? (
              <div className="rounded-2xl border border-white/6 bg-[#0f0f12] px-6 py-6 flex items-center gap-4">
                <Shield className="w-5 h-5 text-muted-foreground/20 shrink-0" />
                <div>
                  <p className="text-sm text-foreground/60">
                    Squad intelligence available for Premier League only
                  </p>
                  <p className="text-[10px] text-muted-foreground/30 mt-1 uppercase tracking-wider">
                    Powered by FPL API
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {data.home && (
                  <TeamPanel team={{ ...data.home, team: homeTeam }} side="home" />
                )}
                {data.away && (
                  <TeamPanel team={{ ...data.away, team: awayTeam }} side="away" />
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}

