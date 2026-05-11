"use client";

import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Zap, Shield, TrendingDown, Users, Star } from "lucide-react";
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
  most_impactful_xg: number;
  defenders_out: number;
  impact_level: "LOW" | "MEDIUM" | "HIGH";
  prob_shift: number;
  absent_players: AbsentPlayer[];
}

interface InjuryImpactResponse {
  prediction_id: number;
  league_slug: string;
  is_pl_only: boolean;
  home: TeamInjuryImpact | null;
  away: TeamInjuryImpact | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const IMPACT_CONFIG = {
  HIGH:   { label: "HIGH IMPACT",   color: "text-red-400",   bg: "bg-red-500/10 border-red-500/30",   bar: "bg-red-500" },
  MEDIUM: { label: "MEDIUM IMPACT", color: "text-amber-400", bg: "bg-amber-400/10 border-amber-400/30", bar: "bg-amber-400" },
  LOW:    { label: "LOW IMPACT",    color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/30", bar: "bg-emerald-500" },
};

function costToMil(cost: number) {
  return `£${(cost / 10).toFixed(1)}m`;
}

function posColor(pos: string) {
  if (pos.includes("Goalkeeper")) return "text-amber-400";
  if (pos.includes("Defender"))   return "text-sky-400";
  if (pos.includes("Midfielder")) return "text-violet-400";
  if (pos.includes("Forward"))    return "text-rose-400";
  return "text-muted-foreground";
}

function chanceColor(chance: number | null) {
  if (chance === null || chance === undefined) return "text-muted-foreground";
  if (chance === 0)   return "text-red-400";
  if (chance <= 25)   return "text-orange-400";
  if (chance <= 50)   return "text-amber-400";
  return "text-emerald-400";
}

// ─── Team panel ───────────────────────────────────────────────────────────────

function TeamImpactPanel({ team, side }: { team: TeamInjuryImpact; side: "home" | "away" }) {
  if (!team) return null;
  const cfg = IMPACT_CONFIG[team.impact_level];

  if (team.absent_count === 0) {
    return (
      <div className="glass-card p-5 flex flex-col items-center justify-center gap-2 min-h-[220px]">
        <Shield className="w-8 h-8 text-emerald-400/50" />
        <p className="text-sm font-semibold text-emerald-400">{team.team}</p>
        <p className="text-xs text-muted-foreground text-center">Full squad available — no injury impact</p>
      </div>
    );
  }

  return (
    <div className="glass-card p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">{side === "home" ? "Home" : "Away"}</p>
          <h4 className="text-sm font-bold text-foreground">{team.team}</h4>
        </div>
        <span className={cn("text-[10px] font-black uppercase px-2.5 py-1 rounded-full border", cfg.bg, cfg.color)}>
          {cfg.label}
        </span>
      </div>

      {/* Key metrics row */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-surface-elevated rounded-lg p-2.5">
          <p className="text-xs text-muted-foreground mb-0.5">Missing xG</p>
          <p className="text-lg font-bold text-foreground">{team.missing_xg.toFixed(2)}</p>
          <p className="text-[10px] text-muted-foreground">{team.missing_xg_pct}% of squad</p>
        </div>
        <div className="bg-surface-elevated rounded-lg p-2.5">
          <p className="text-xs text-muted-foreground mb-0.5">Absent</p>
          <p className="text-lg font-bold text-foreground">{team.absent_count}</p>
          <p className="text-[10px] text-muted-foreground">{team.defenders_out} def/GK</p>
        </div>
        <div className="bg-surface-elevated rounded-lg p-2.5">
          <p className="text-xs text-muted-foreground mb-0.5">Win Δ</p>
          <p className={cn("text-lg font-bold", team.prob_shift < 0 ? "text-red-400" : "text-emerald-400")}>
            {team.prob_shift > 0 ? "+" : ""}{team.prob_shift}pp
          </p>
          <p className="text-[10px] text-muted-foreground">est. shift</p>
        </div>
      </div>

      {/* xG impact bar */}
      <div>
        <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
          <span>Squad xG loss</span>
          <span>{team.missing_xg_pct}%</span>
        </div>
        <div className="h-1.5 bg-surface-elevated rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(team.missing_xg_pct, 100)}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className={cn("h-full rounded-full", cfg.bar)}
          />
        </div>
      </div>

      {/* Most impactful absence */}
      {team.most_impactful && (
        <div className="flex items-center gap-2.5 py-2.5 px-3 bg-surface-elevated rounded-lg border border-amber-400/20">
          <Star className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-amber-400">Biggest loss: {team.most_impactful}</p>
            <p className="text-[10px] text-muted-foreground">
              {team.most_impactful_pos} · xG this season: {team.most_impactful_xg.toFixed(2)}
            </p>
          </div>
        </div>
      )}

      {/* Player list */}
      <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1 scrollbar-thin">
        {team.absent_players.map((player, i) => (
          <div key={i} className="flex items-center gap-2 py-1.5 border-b border-surface-border/40 last:border-0">
            {/* Position dot */}
            <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", {
              "bg-amber-400":  player.position.includes("Goalkeeper"),
              "bg-sky-400":    player.position.includes("Defender"),
              "bg-violet-400": player.position.includes("Midfielder"),
              "bg-rose-400":   player.position.includes("Forward"),
            })} />
            <p className={cn("text-xs font-medium shrink-0 w-24 truncate", posColor(player.position))}>
              {player.web_name}
            </p>
            <p className="text-[10px] text-muted-foreground flex-1 truncate">{player.position.split(" ")[0]}</p>
            {/* xG */}
            <span className="text-[10px] text-muted-foreground w-10 text-right">
              xG {player.xg.toFixed(1)}
            </span>
            {/* Value */}
            <span className="text-[10px] text-muted-foreground w-12 text-right">
              {costToMil(player.now_cost)}
            </span>
            {/* Chance */}
            <span className={cn("text-[10px] font-bold w-8 text-right", chanceColor(player.chance_of_playing))}>
              {player.chance_of_playing !== null && player.chance_of_playing !== undefined
                ? `${player.chance_of_playing}%`
                : "?"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

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
  const hasImpact   = totalAbsent > 0;
  const isNonPL     = data && !data.is_pl_only;

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35 }}
    >
      {/* Section header */}
      <div className="flex items-center gap-2.5 mb-4">
        <div className="flex items-center gap-1.5">
          <div className="w-1 h-6 rounded-full bg-neon-green" />
          <h2 className="text-base font-bold text-foreground">Injury Impact Center</h2>
        </div>
        {!isLoading && hasImpact && (
          <span className="flex items-center gap-1 text-[10px] font-bold text-red-400 bg-red-500/10 border border-red-500/30 rounded-full px-2 py-0.5">
            <Users className="w-3 h-3" /> {totalAbsent} absent
          </span>
        )}
        {!isLoading && !isNonPL && (
          <span className="text-[10px] text-muted-foreground bg-surface-elevated border border-surface-border rounded-full px-2 py-0.5">
            powered by FPL xG stats
          </span>
        )}
      </div>

      <AnimatePresence mode="wait">
        {isLoading && (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="glass-card p-5 min-h-[220px] animate-pulse bg-surface-elevated/50" />
              <div className="glass-card p-5 min-h-[220px] animate-pulse bg-surface-elevated/50" />
            </div>
          </motion.div>
        )}

        {isError && (
          <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="glass-card p-5 flex items-center gap-3">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <p className="text-sm text-muted-foreground">Injury data temporarily unavailable</p>
            </div>
          </motion.div>
        )}

        {data && !isLoading && !isError && (
          <motion.div key="data" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {isNonPL ? (
              <div className="glass-card p-5 flex items-center gap-3">
                <Shield className="w-4 h-4 text-muted-foreground/50 shrink-0" />
                <div>
                  <p className="text-sm text-foreground">Detailed injury metrics available for Premier League only</p>
                  <p className="text-xs text-muted-foreground mt-0.5">xG contribution data powered by FPL API</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {data.home && (
                  <TeamImpactPanel team={{ ...data.home, team: homeTeam }} side="home" />
                )}
                {data.away && (
                  <TeamImpactPanel team={{ ...data.away, team: awayTeam }} side="away" />
                )}
              </div>
            )}

            {/* Combined AI verdict */}
            {!isNonPL && hasImpact && data.home && data.away && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="mt-3 p-3.5 rounded-xl border border-neon-green/20 bg-neon-green/5 flex items-start gap-2.5"
              >
                <Zap className="w-4 h-4 text-neon-green shrink-0 mt-0.5" />
                <p className="text-xs text-foreground/80 leading-relaxed">
                  <span className="font-semibold text-neon-green">AI Assessment — </span>
                  {data.home.impact_level === "HIGH" && data.away.impact_level === "HIGH"
                    ? `Both squads severely weakened — ${data.home.missing_xg.toFixed(1)} + ${data.away.missing_xg.toFixed(1)} xG missing. Match outcome highly unpredictable; favour lower goal totals.`
                    : data.home.impact_level === "HIGH"
                    ? `${homeTeam} missing ${data.home.missing_xg.toFixed(1)} xG — significant home disadvantage. Estimated ${Math.abs(data.home.prob_shift)}pp win probability drop.`
                    : data.away.impact_level === "HIGH"
                    ? `${awayTeam} missing ${data.away.missing_xg.toFixed(1)} xG — travel disadvantage amplified by injuries. Estimated ${Math.abs(data.away.prob_shift)}pp win probability drop.`
                    : data.home.absent_count > 0 || data.away.absent_count > 0
                    ? `Squad depth tested on both sides. Combined ${(data.home.missing_xg + data.away.missing_xg).toFixed(1)} xG absent — moderate impact on pre-match probabilities.`
                    : "No significant injury disruption detected. Base model probabilities apply."}
                </p>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}
