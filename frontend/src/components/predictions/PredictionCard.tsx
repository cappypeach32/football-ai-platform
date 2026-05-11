"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import type { Prediction } from "@/types";
import { Brain, Zap, Activity, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useCardGlow } from "@/hooks/useCardGlow";

interface Props {
  prediction: Prediction;
  compact?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function resolvePickLabel(p: Prediction): string {
  const home = p.match.home_team.name;
  const away = p.match.away_team.name;
  switch (p.recommended_bet) {
    case "1": return `${home} to Win`;
    case "X": return "Draw";
    case "2": return `${away} to Win`;
    case "over_2.5": return "Over 2.5 Goals";
    case "under_2.5": return "Under 2.5 Goals";
    case "btts_yes": return "Both Teams to Score";
    case "btts_no": return "Clean Sheet";
    default: return p.recommended_bet ?? "—";
  }
}

function resolvePickOdds(p: Prediction): number | null {
  switch (p.recommended_bet) {
    case "1": return p.odds_home;
    case "X": return p.odds_draw;
    case "2": return p.odds_away;
    default: return null;
  }
}

function resolvePickProb(p: Prediction): number {
  switch (p.recommended_bet) {
    case "1": return p.home_win_prob;
    case "X": return p.draw_prob;
    case "2": return p.away_win_prob;
    case "over_2.5": return p.over_25_prob;
    case "under_2.5": return p.under_25_prob;
    case "btts_yes": return p.btts_yes_prob;
    case "btts_no": return p.btts_no_prob;
    default: return Math.max(p.home_win_prob, p.draw_prob, p.away_win_prob);
  }
}

function computeEV(prob: number, odds: number | null): number | null {
  if (!odds || odds <= 1) return null;
  return Math.round((prob * odds - 1) * 1000) / 10;
}

function formatAH(line: number | null): string {
  if (line === null || line === undefined) return "—";
  if (line === 0) return "0";
  return line > 0 ? `+${line}` : `${line}`;
}

function ModelAgreementDots({ agreement }: { agreement: number | null }) {
  const filled = agreement ?? 0;
  const dotColor = filled >= 3 ? "bg-neon-green" : filled === 2 ? "bg-neon-yellow" : "bg-orange-400";
  return (
    <div className="flex items-center gap-1.5">
      {[0, 1, 2].map((i) => (
        <span key={i} className={cn("w-2 h-2 rounded-full", i < filled ? dotColor : "bg-surface-border")} />
      ))}
      <span className="text-[10px] font-mono text-muted-foreground ml-0.5">{filled}/3</span>
    </div>
  );
}

// ── Main Card ─────────────────────────────────────────────────────────────────

export function PredictionCard({ prediction: p, compact }: Props) {
  const pickLabel = resolvePickLabel(p);
  const pickOdds  = resolvePickOdds(p);
  const pickProb  = resolvePickProb(p);
  const ev        = computeEV(pickProb, pickOdds);
  const isValue   = p.value_bet;
  const isHighConf = p.confidence_score >= 65;

  const glow = useCardGlow(
    isValue ? "0,255,135" : "0,212,255",
    isValue ? 0.14 : 0.08
  );

  if (compact) {
    return (
      <Link href={`/predictions/${p.id}`}>
        <div className="match-card flex items-center justify-between gap-3 py-3 px-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{p.match.home_team.name} vs {p.match.away_team.name}</p>
            <p className="text-[11px] text-muted-foreground truncate">{pickLabel}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-mono font-bold text-neon-green">{p.confidence_score.toFixed(0)}%</span>
            {isValue && <Zap className="w-3.5 h-3.5 text-neon-green" />}
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link href={`/predictions/${p.id}`}>
      <motion.div
        ref={glow.ref}
        {...glow.handlers}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -2 }}
        transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
        className={cn("match-card card-glow group relative overflow-hidden", isValue && "value-bet-card")}
      >
        {isHighConf && (
          <div className="absolute top-0 left-0 right-0 h-px"
               style={{ background: "linear-gradient(90deg, transparent, rgba(0,255,135,0.5), transparent)" }} />
        )}

        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            {p.match.league.name} · {p.match.league.country}
          </span>
          <span className="text-[11px] text-muted-foreground tabular-nums font-mono">
            {format(new Date(p.match.match_date), "dd MMM, HH:mm")}
          </span>
        </div>

        {/* Teams */}
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex-1 text-left">
            <p className="font-bold text-foreground text-sm md:text-base truncate">{p.match.home_team.name}</p>
            <p className="text-[10px] text-muted-foreground font-mono mt-0.5">ELO {p.match.home_team.elo_rating?.toFixed(0) ?? "—"}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-surface-navy border border-surface-border flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-muted-foreground tracking-wider">VS</span>
          </div>
          <div className="flex-1 text-right">
            <p className="font-bold text-foreground text-sm md:text-base truncate">{p.match.away_team.name}</p>
            <p className="text-[10px] text-muted-foreground font-mono mt-0.5">ELO {p.match.away_team.elo_rating?.toFixed(0) ?? "—"}</p>
          </div>
        </div>

        {/* AI Pick banner */}
        <div className={cn(
          "rounded-xl px-4 py-3 mb-3 flex items-center justify-between gap-3",
          isValue ? "bg-neon-green/10 border border-neon-green/20" : "bg-surface-elevated border border-surface-border"
        )}>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-0.5">AI Pick</p>
            <p className={cn("font-bold text-sm", isValue ? "text-neon-green" : "text-foreground")}>{pickLabel}</p>
          </div>
          {pickOdds && (
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Odds</p>
              <p className="text-xl font-bold font-mono text-foreground">{pickOdds.toFixed(2)}</p>
            </div>
          )}
          {isValue && (
            <motion.div
              animate={{ boxShadow: ["0 0 0 rgba(0,255,135,0)", "0 0 12px rgba(0,255,135,0.4)", "0 0 0 rgba(0,255,135,0)"] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="flex-shrink-0 flex items-center gap-1 bg-neon-green/20 text-neon-green text-[10px] font-bold px-2 py-1 rounded-lg"
            >
              <Zap className="w-3 h-3" /> VALUE
            </motion.div>
          )}
        </div>

        {/* Risk Category badge */}
        {p.risk_category && (
          <div className="flex items-center gap-2 mb-4">
            <span className={cn(
              "inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border",
              p.risk_category === "Safe"          ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" :
              p.risk_category === "Balanced"      ? "text-sky-400 bg-sky-500/10 border-sky-500/20" :
              p.risk_category === "Aggressive"    ? "text-amber-400 bg-amber-400/10 border-amber-400/20" :
                                                    "text-red-400 bg-red-500/10 border-red-500/20"
            )}>
              <span className={cn("w-1.5 h-1.5 rounded-full",
                p.risk_category === "Safe"       ? "bg-emerald-400" :
                p.risk_category === "Balanced"   ? "bg-sky-400" :
                p.risk_category === "Aggressive" ? "bg-amber-400" :
                                                   "bg-red-400"
              )} />
              {p.risk_category}
            </span>
            <span className="text-[9px] text-muted-foreground/50 uppercase tracking-wide">
              {p.risk_category === "Safe"          ? "High confidence, low risk" :
               p.risk_category === "Balanced"      ? "Moderate confidence, moderate risk" :
               p.risk_category === "Aggressive"    ? "Low confidence, value play" :
                                                     "High volatility — proceed with caution"}
            </span>
          </div>
        )}

        {/* 4-stat grid */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          <div className="bg-surface-navy rounded-lg p-2.5 text-center">
            <p className={cn(
              "text-xl font-bold font-mono tabular-nums leading-none",
              p.confidence_score >= 70 ? "text-neon-green" :
              p.confidence_score >= 55 ? "text-neon-yellow" : "text-orange-400"
            )}>
              {p.confidence_score.toFixed(0)}%
            </p>
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider mt-1">Confidence</p>
          </div>
          <div className="bg-surface-navy rounded-lg p-2.5 text-center">
            <p className={cn(
              "text-xl font-bold font-mono tabular-nums leading-none",
              ev === null ? "text-muted-foreground" : ev > 0 ? "text-neon-green" : "text-red-400"
            )}>
              {ev === null ? "—" : `${ev > 0 ? "+" : ""}${ev}%`}
            </p>
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider mt-1">Edge</p>
          </div>
          <div className="bg-surface-navy rounded-lg p-2.5 text-center">
            <p className="text-base font-bold font-mono tabular-nums leading-none text-sky-400">
              {p.home_xg.toFixed(1)}<span className="text-muted-foreground text-xs">-</span>{p.away_xg.toFixed(1)}
            </p>
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider mt-1">xScore</p>
          </div>
          <div className="bg-surface-navy rounded-lg p-2.5 text-center">
            <p className="text-xl font-bold font-mono tabular-nums leading-none text-neon-purple">
              {formatAH(p.ah_line)}
            </p>
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider mt-1">AH</p>
          </div>
        </div>

        {/* 1X2 probability bars */}
        <div className="space-y-2 mb-4">
          <ProbRow label={p.match.home_team.short_name ?? "Home"} prob={p.home_win_prob} color="bg-neon-green" glow="rgba(0,255,135,0.5)" />
          <ProbRow label="Draw" prob={p.draw_prob} color="bg-neon-yellow" glow="rgba(245,230,66,0.5)" />
          <ProbRow label={p.match.away_team.short_name ?? "Away"} prob={p.away_win_prob} color="bg-neon-blue" glow="rgba(0,212,255,0.5)" />
        </div>

        {/* Model agreement + why this pick */}
        <div className="flex items-start gap-4 pt-3 border-t border-surface-border/50 mb-3">
          <div className="flex-shrink-0">
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1.5">Model Agreement</p>
            <ModelAgreementDots agreement={p.model_agreement} />
          </div>
          {p.key_factors && p.key_factors.length > 0 && (
            <div className="flex-1 min-w-0">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1.5">Why this pick</p>
              <ul className="space-y-0.5">
                {p.key_factors.slice(0, 2).map((f, i) => (
                  <li key={i} className="text-[10px] text-muted-foreground flex items-start gap-1 leading-tight">
                    <span className="text-neon-green mt-0.5 flex-shrink-0">▸</span>
                    <span className="line-clamp-1">{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* CTA footer */}
        <div className="flex items-center justify-between pt-2 border-t border-surface-border/30">
          <span className="text-[10px] font-mono text-muted-foreground">
            <Activity className="w-3 h-3 inline mr-0.5" />xG {p.home_xg.toFixed(1)}–{p.away_xg.toFixed(1)}
          </span>
          <span className="flex items-center gap-1 text-[11px] text-neon-green group-hover:text-neon-green/80 font-semibold transition-colors">
            Full Analysis <ChevronRight className="w-3.5 h-3.5" />
          </span>
        </div>
      </motion.div>
    </Link>
  );
}

function ProbRow({ label, prob, color, glow }: { label: string; prob: number; color: string; glow: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-[10px] text-muted-foreground w-14 truncate">{label}</span>
      <div className="flex-1 bg-surface-navy rounded-full h-1.5 overflow-hidden">
        <motion.div
          className={cn("h-1.5 rounded-full", color)}
          style={{ boxShadow: `0 0 6px ${glow}` }}
          initial={{ width: 0 }}
          animate={{ width: `${prob * 100}%` }}
          transition={{ duration: 0.9, ease: [0.25, 0.46, 0.45, 0.94] }}
        />
      </div>
      <span className="text-[11px] font-mono text-foreground w-9 text-right tabular-nums">
        {(prob * 100).toFixed(0)}%
      </span>
    </div>
  );
}
