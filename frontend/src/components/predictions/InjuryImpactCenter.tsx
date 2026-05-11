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

// ─── Config ───────────────────────────────────────────────────────────────────

const LEVEL = {
  LOW:      { label: "LOW",      text: "text-emerald-400", border: "border-emerald-500/30" },
  MEDIUM:   { label: "MEDIUM",   text: "text-amber-400",   border: "border-amber-400/30"   },
  HIGH:     { label: "HIGH",     text: "text-orange-400",  border: "border-orange-400/30"  },
  CRITICAL: { label: "CRITICAL", text: "text-red-400",     border: "border-red-500/30"     },
} as const;

// ─── Stat cell ────────────────────────────────────────────────────────────────

function StatCell({
  label,
  value,
  valueClass,
  sub,
}: {
  label: string;
  value: string;
  valueClass?: string;
  sub?: string;
}) {
  return (
    <div className="flex flex-col gap-1 py-3 px-4 border-r border-surface-border/40 last:border-r-0">
      <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/60">{label}</p>
      <p className={cn("text-xl font-black tabular-nums leading-none", valueClass ?? "text-foreground")}>{value}</p>
      {sub && <p className="text-[9px] text-muted-foreground/50 uppercase tracking-wide mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Absent player row ────────────────────────────────────────────────────────

function AbsentRow({ player }: { player: AbsentPlayer }) {
  const posAbbr =
    player.position.includes("Goalkeeper") ? "GK"  :
    player.position.includes("Defender")   ? "DEF" :
    player.position.includes("Midfielder") ? "MID" :
    player.position.includes("Forward")    ? "FWD" : "—";

  const posColor =
    player.position.includes("Goalkeeper") ? "text-amber-400 bg-amber-400/10" :
    player.position.includes("Defender")   ? "text-sky-400 bg-sky-400/10"     :
    player.position.includes("Midfielder") ? "text-violet-400 bg-violet-400/10" :
    player.position.includes("Forward")    ? "text-rose-400 bg-rose-400/10"   :
                                             "text-muted-foreground bg-surface-elevated";

  const statusLabel =
    player.status === "Injured"    ? "OUT"   :
    player.status === "doubtful"   ? "DOUBT" :
    player.status === "suspended"  ? "SUSP"  : "OUT";

  const statusColor =
    player.status === "Injured"   ? "text-red-400 border-red-500/30"     :
    player.status === "doubtful"  ? "text-amber-400 border-amber-400/30" :
                                    "text-orange-400 border-orange-400/30";

  return (
    <div className="flex items-center gap-2.5 py-2 border-b border-surface-border/30 last:border-0">
      <span className={cn("text-[9px] font-black px-1.5 py-0.5 rounded shrink-0", posColor)}>
        {posAbbr}
      </span>
      <p className="text-sm font-medium text-foreground flex-1 truncate">{player.web_name}</p>
      {player.chance_of_playing !== null && player.chance_of_playing !== undefined && player.chance_of_playing > 0 && (
        <span className="text-[10px] text-amber-400/70 shrink-0">{player.chance_of_playing}% chance</span>
      )}
      <span className={cn("text-[9px] font-black border rounded px-1.5 py-0.5 shrink-0", statusColor)}>
        {statusLabel}
      </span>
    </div>
  );
}

// ─── Team panel ───────────────────────────────────────────────────────────────

function TeamPanel({ team, side }: { team: TeamInjuryImpact; side: "home" | "away" }) {
  const [expanded, setExpanded] = useState(false);
  const cfg  = LEVEL[team.impact_level];
  const atkCfg = LEVEL[team.attack_impact];
  const noImpact = team.absent_count === 0;

  return (
    <div className={cn(
      "rounded-xl border bg-[#0c0c0f] overflow-hidden",
      noImpact ? "border-surface-border/40" : cfg.border,
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border/40 bg-surface-elevated/20">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-black text-muted-foreground/50 uppercase tracking-widest">
            {side === "home" ? "HOME" : "AWAY"}
          </span>
          <span className="text-muted-foreground/30">·</span>
          <p className="text-sm font-bold text-foreground">{team.team}</p>
        </div>
        <span className={cn(
          "text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded border",
          noImpact ? "text-emerald-400 border-emerald-500/30" : `${cfg.text} ${cfg.border}`,
        )}>
          {noImpact ? "NO CONCERN" : cfg.label}
        </span>
      </div>

      {noImpact ? (
        <div className="px-4 py-6 flex items-center gap-3">
          <Shield className="w-4 h-4 text-emerald-400/40 shrink-0" />
          <p className="text-xs text-muted-foreground">Full squad available — no injury disruption detected.</p>
        </div>
      ) : (
        <>
          {/* 4-metric strip */}
          <div className="grid grid-cols-4 divide-x divide-surface-border/40 border-b border-surface-border/40">
            <StatCell
              label="Attack Impact"
              value={atkCfg.label}
              valueClass={cn("text-base font-black", atkCfg.text)}
            />
            <StatCell
              label="Def. Stability"
              value={team.defensive_stability_pct === 0 ? "—" : `${team.defensive_stability_pct}%`}
              valueClass={team.defensive_stability_pct < 0 ? "text-orange-400" : "text-foreground"}
            />
            <StatCell
              label="Win Prob."
              value={team.prob_shift === 0 ? "—" : `${team.prob_shift > 0 ? "+" : ""}${team.prob_shift}pp`}
              valueClass={team.prob_shift < 0 ? "text-red-400" : team.prob_shift > 0 ? "text-emerald-400" : "text-muted-foreground"}
            />
            <StatCell
              label="Unavailable"
              value={String(team.absent_count)}
              sub={team.absent_count === 1 ? "player" : "players"}
            />
          </div>

          {/* Key absence */}
          {team.most_impactful && (
            <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-border/40">
              <div className="w-0.5 h-8 rounded-full bg-amber-400/50 shrink-0" />
              <div>
                <p className="text-[9px] uppercase tracking-widest text-muted-foreground/50 mb-0.5">
                  Key absence
                </p>
                <p className="text-sm font-bold text-foreground leading-none">
                  {team.most_impactful}
                  {team.most_impactful_role && (
                    <span className="ml-2 text-xs font-normal text-amber-400">
                      {team.most_impactful_role}
                    </span>
                  )}
                </p>
              </div>
            </div>
          )}

          {/* AI Assessment */}
          <div className="px-4 py-3 border-b border-surface-border/40">
            <p className="text-[9px] uppercase tracking-widest text-muted-foreground/40 mb-1.5">
              Intelligence Assessment
            </p>
            <p className="text-xs text-foreground/65 leading-relaxed">{team.ai_summary}</p>
          </div>

          {/* Expandable roster */}
          {team.absent_players.length > 0 && (
            <>
              <button
                onClick={() => setExpanded((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-2.5 text-[10px] font-semibold text-muted-foreground/60 hover:text-muted-foreground transition-colors"
              >
                <span className="uppercase tracking-wider">
                  {expanded ? "Hide" : "View"} squad absentees ({team.absent_players.length})
                </span>
                {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              <AnimatePresence>
                {expanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4">
                      {team.absent_players.map((p, i) => (
                        <AbsentRow key={i} player={p} />
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
    queryFn: () => predictionsService.getInjuryImpact(predictionId).then((r) => r.data as InjuryImpactResponse),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const totalAbsent = (data?.home?.absent_count ?? 0) + (data?.away?.absent_count ?? 0);

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35 }}
    >
      {/* Heading */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-1 h-6 rounded-full bg-neon-green shrink-0" />
          <h2 className="text-base font-bold text-foreground tracking-tight">Injury Impact Center</h2>
          <span className="text-[9px] text-muted-foreground/40 uppercase tracking-widest hidden sm:inline">
            Squad Intelligence
          </span>
        </div>
        {!isLoading && !isError && totalAbsent > 0 && (
          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-red-400">
            <Users className="w-3 h-3" />
            <span>{totalAbsent} absent</span>
          </div>
        )}
      </div>

      <AnimatePresence mode="wait">
        {isLoading && (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="h-[220px] rounded-xl bg-surface-elevated/20 animate-pulse border border-surface-border/30" />
              <div className="h-[220px] rounded-xl bg-surface-elevated/20 animate-pulse border border-surface-border/30" />
            </div>
          </motion.div>
        )}

        {isError && (
          <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="rounded-xl border border-surface-border/40 bg-[#0c0c0f] p-4 flex items-center gap-3">
              <AlertTriangle className="w-4 h-4 text-amber-400/50 shrink-0" />
              <p className="text-xs text-muted-foreground">Squad intelligence temporarily unavailable</p>
            </div>
          </motion.div>
        )}

        {data && !isLoading && !isError && (
          <motion.div key="data" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {data.league_slug !== "ENG.1" ? (
              <div className="rounded-xl border border-surface-border/40 bg-[#0c0c0f] p-5 flex items-center gap-3">
                <Shield className="w-4 h-4 text-muted-foreground/30 shrink-0" />
                <div>
                  <p className="text-sm text-foreground/70">Squad intelligence available for Premier League only</p>
                  <p className="text-[9px] text-muted-foreground/40 mt-0.5 uppercase tracking-wider">Powered by FPL API</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {data.home && <TeamPanel team={{ ...data.home, team: homeTeam }} side="home" />}
                {data.away && <TeamPanel team={{ ...data.away, team: awayTeam }} side="away" />}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}

