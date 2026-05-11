"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, Flame, TrendingUp, Target, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { TeamLogo } from "@/components/ui/TeamLogo";
import type { Prediction } from "@/types";

// ── helpers ──────────────────────────────────────────────────────────────────

function resolvePickLabel(pred: Prediction): string {
  const bet = pred.recommended_bet;
  if (bet === "1") return `${pred.match.home_team.name} WIN`;
  if (bet === "2") return `${pred.match.away_team.name} WIN`;
  if (bet === "X") return "DRAW";
  if (bet === "O2.5") return "OVER 2.5 GOALS";
  if (bet === "U2.5") return "UNDER 2.5 GOALS";
  if (bet === "BTTS") return "BOTH TEAMS SCORE";
  return bet ?? "—";
}

function resolveMarketOdds(pred: Prediction): number | null {
  const bet = pred.recommended_bet;
  if (bet === "1") return pred.odds_home;
  if (bet === "2") return pred.odds_away;
  if (bet === "X") return pred.odds_draw;
  if (bet === "O2.5" || bet === "U2.5") return null;
  return pred.odds_home;
}

function resolveModelProb(pred: Prediction): number {
  const bet = pred.recommended_bet;
  if (bet === "1") return pred.home_win_prob;
  if (bet === "2") return pred.away_win_prob;
  if (bet === "X") return pred.draw_prob;
  if (bet === "O2.5") return pred.over_25_prob;
  if (bet === "U2.5") return pred.under_25_prob;
  if (bet === "BTTS") return pred.btts_yes_prob;
  return pred.home_win_prob;
}

function ConfidenceTier(confidence: number): { label: string; color: string } {
  if (confidence >= 80) return { label: "ELITE EDGE", color: "text-neon-green" };
  if (confidence >= 70) return { label: "HIGH CONFIDENCE", color: "text-emerald-400" };
  if (confidence >= 60) return { label: "SOLID PICK", color: "text-amber-400" };
  return { label: "SPECULATIVE", color: "text-orange-400" };
}

// ── component ─────────────────────────────────────────────────────────────────

interface Props {
  prediction: Prediction;
}

export function HeroPickCard({ prediction: pred }: Props) {
  const pickLabel = resolvePickLabel(pred);
  const marketOdds = resolveMarketOdds(pred);
  const modelProb = resolveModelProb(pred);
  const fairOdds = modelProb > 0 ? 1 / modelProb : null;
  const edge =
    marketOdds && fairOdds ? ((marketOdds / fairOdds - 1) * 100) : null;
  const confidence = pred.confidence_score;
  const tier = ConfidenceTier(confidence);
  const matchDate = new Date(pred.match.match_date);
  const kickoff = matchDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <motion.div
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="relative rounded-2xl overflow-hidden border border-neon-green/20"
      style={{
        background: "linear-gradient(135deg, #0d1117 0%, #111827 50%, #0d1117 100%)",
      }}
    >
      {/* Background glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 20% 50%, rgba(0,255,135,0.07) 0%, transparent 60%), radial-gradient(ellipse 50% 80% at 80% 30%, rgba(0,212,255,0.04) 0%, transparent 60%)",
        }}
      />
      {/* Top edge accent */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-green/60 to-transparent" />

      {/* Header bar */}
      <div className="relative flex items-center justify-between px-5 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <motion.div
            animate={{ opacity: [1, 0.4, 1] }}
            transition={{ duration: 1.6, repeat: Infinity }}
          >
            <Flame className="w-4 h-4 text-neon-green" />
          </motion.div>
          <span className="text-[11px] font-black uppercase tracking-[0.2em] text-neon-green">
            Best AI Edge Today
          </span>
        </div>
        <div className="flex items-center gap-3">
          {pred.value_bet && (
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-neon-green/10 border border-neon-green/30 text-neon-green">
              Value Bet
            </span>
          )}
          <span className="text-[10px] text-muted-foreground">
            {pred.match.league?.name ?? ""} · {kickoff}
          </span>
        </div>
      </div>

      {/* Main body */}
      <div className="relative px-5 pb-5">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-5 lg:gap-8 items-start">

          {/* LEFT — Match + Pick */}
          <div className="space-y-4">
            {/* Teams */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <TeamLogo
                  src={pred.match.home_team.logo_url ?? null}
                  name={pred.match.home_team.name}
                  className="w-9 h-9 flex-shrink-0"
                />
                <span className="text-base font-bold text-foreground truncate">
                  {pred.match.home_team.name}
                </span>
              </div>
              <span className="text-sm font-bold text-muted-foreground flex-shrink-0">vs</span>
              <div className="flex items-center gap-2 min-w-0">
                <TeamLogo
                  src={pred.match.away_team.logo_url ?? null}
                  name={pred.match.away_team.name}
                  className="w-9 h-9 flex-shrink-0"
                />
                <span className="text-base font-bold text-foreground truncate">
                  {pred.match.away_team.name}
                </span>
              </div>
            </div>

            {/* AI Pick block */}
            <div className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                AI Pick
              </p>
              <p className="text-2xl font-black text-neon-green leading-tight tracking-tight">
                {pickLabel}
              </p>
              <p className={cn("text-[11px] font-bold uppercase tracking-wider", tier.color)}>
                {tier.label}
              </p>
            </div>

            {/* Key factors */}
            {pred.key_factors && pred.key_factors.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Key Factors
                </p>
                <ul className="space-y-1">
                  {pred.key_factors.slice(0, 4).map((f, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="w-1 h-1 rounded-full bg-neon-green mt-1.5 flex-shrink-0" />
                      <span className="text-xs text-foreground/80 leading-snug">{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* CENTER DIVIDER (desktop only) */}
          <div className="hidden lg:block w-px self-stretch bg-surface-border/60" />

          {/* RIGHT — Stats grid */}
          <div className="grid grid-cols-2 gap-3">
            {/* Confidence */}
            <StatBox
              label="Confidence"
              icon={<Target className="w-3.5 h-3.5" />}
              value={`${confidence.toFixed(0)}%`}
              valueClass="text-neon-green"
              sub={
                <div className="mt-1.5 h-1 rounded-full bg-surface-elevated overflow-hidden w-full">
                  <div
                    className="h-full rounded-full bg-neon-green"
                    style={{ width: `${confidence}%` }}
                  />
                </div>
              }
            />

            {/* Edge */}
            {edge !== null ? (
              <StatBox
                label="AI Edge"
                icon={<TrendingUp className="w-3.5 h-3.5" />}
                value={`+${edge.toFixed(1)}%`}
                valueClass={edge >= 10 ? "text-neon-green" : edge >= 5 ? "text-emerald-400" : "text-amber-400"}
              />
            ) : (
              <StatBox
                label="Win Probability"
                icon={<TrendingUp className="w-3.5 h-3.5" />}
                value={`${(modelProb * 100).toFixed(0)}%`}
                valueClass="text-emerald-400"
              />
            )}

            {/* Market odds */}
            {marketOdds !== null ? (
              <StatBox
                label="Market Odds"
                icon={<Zap className="w-3.5 h-3.5" />}
                value={marketOdds.toFixed(2)}
                valueClass="text-foreground"
              />
            ) : (
              <StatBox
                label="Home xG"
                icon={<Zap className="w-3.5 h-3.5" />}
                value={pred.home_xg.toFixed(2)}
                valueClass="text-foreground"
              />
            )}

            {/* AI fair odds / Away xG */}
            {fairOdds !== null && marketOdds !== null ? (
              <StatBox
                label="AI Fair Odds"
                icon={<Brain />}
                value={fairOdds.toFixed(2)}
                valueClass="text-neon-green/80"
                sub={
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    vs market {marketOdds.toFixed(2)}
                  </p>
                }
              />
            ) : (
              <StatBox
                label="Away xG"
                icon={<Brain />}
                value={pred.away_xg.toFixed(2)}
                valueClass="text-foreground"
              />
            )}

            {/* xG row spanning full width */}
            <div className="col-span-2 flex items-center justify-between rounded-xl bg-surface-elevated/60 border border-surface-border/40 px-3 py-2">
              <div className="text-center flex-1">
                <p className="text-[10px] text-muted-foreground">Home xG</p>
                <p className="text-lg font-bold text-neon-green font-mono">{pred.home_xg.toFixed(2)}</p>
              </div>
              <div className="w-px h-6 bg-surface-border mx-3" />
              <div className="text-center flex-1">
                <p className="text-[10px] text-muted-foreground">Away xG</p>
                <p className="text-lg font-bold text-red-400 font-mono">{pred.away_xg.toFixed(2)}</p>
              </div>
              <div className="w-px h-6 bg-surface-border mx-3" />
              <div className="text-center flex-1">
                <p className="text-[10px] text-muted-foreground">BTTS</p>
                <p className="text-lg font-bold text-amber-400 font-mono">
                  {(pred.btts_yes_prob * 100).toFixed(0)}%
                </p>
              </div>
              <div className="w-px h-6 bg-surface-border mx-3" />
              <div className="text-center flex-1">
                <p className="text-[10px] text-muted-foreground">Over 2.5</p>
                <p className="text-lg font-bold text-foreground font-mono">
                  {(pred.over_25_prob * 100).toFixed(0)}%
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-5 flex justify-end">
          <Link
            href={`/predictions/${pred.id}`}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-neon-green text-black text-sm font-black uppercase tracking-wide hover:bg-neon-green/90 transition-colors shadow-[0_0_20px_rgba(0,255,135,0.25)]"
          >
            View Full Analysis
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </motion.div>
  );
}

// ── sub-components ────────────────────────────────────────────────────────────

function Brain() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.44-4.14Z" />
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.44-4.14Z" />
    </svg>
  );
}

interface StatBoxProps {
  label: string;
  icon: React.ReactNode;
  value: string;
  valueClass?: string;
  sub?: React.ReactNode;
}

function StatBox({ label, icon, value, valueClass, sub }: StatBoxProps) {
  return (
    <div className="rounded-xl bg-surface-elevated/60 border border-surface-border/40 px-3 py-2.5 space-y-0.5">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-[10px] font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <p className={cn("text-xl font-black font-mono leading-tight", valueClass)}>{value}</p>
      {sub}
    </div>
  );
}

export function HeroPickCardSkeleton() {
  return (
    <div className="rounded-2xl border border-surface-border bg-surface-card p-5 animate-pulse">
      <div className="h-4 w-40 bg-surface-elevated rounded mb-4" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="space-y-3">
          <div className="h-8 w-full bg-surface-elevated rounded" />
          <div className="h-10 w-48 bg-surface-elevated rounded" />
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <div key={i} className="h-3 w-full bg-surface-elevated rounded" />)}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-16 bg-surface-elevated rounded-xl" />)}
        </div>
      </div>
    </div>
  );
}
