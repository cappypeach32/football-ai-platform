"use client";

import { useQuery } from "@tanstack/react-query";
import { predictionsApi, matchesApi } from "@/lib/api";
import type { MatchAnalysis, TeamFormEntry, InjuredPlayerInfo, H2HResult, EspnLiveMatch, EspnLiveResponse } from "@/types";
import { motion } from "framer-motion";
import { format } from "date-fns";
import {
  Brain, Zap, AlertTriangle, Activity, TrendingUp,
  MapPin, ArrowLeft, Shield, Target, BarChart2
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";

// Charts are below-the-fold — lazy loaded to reduce initial bundle
const TeamRadarChart = dynamic(
  () => import("@/components/analytics/TeamRadarChart").then((m) => ({ default: m.TeamRadarChart })),
  { ssr: false, loading: () => <div className="h-72 rounded-xl bg-surface-elevated animate-pulse" /> }
);
const WinProbabilityGauge = dynamic(
  () => import("@/components/charts/WinProbabilityGauge").then((m) => ({ default: m.WinProbabilityGauge })),
  { ssr: false, loading: () => <div className="h-40 rounded-xl bg-surface-elevated animate-pulse" /> }
);
const FormTrendChart = dynamic(
  () => import("@/components/charts/FormTrendChart").then((m) => ({ default: m.FormTrendChart })),
  { ssr: false, loading: () => <div className="h-32 rounded-xl bg-surface-elevated animate-pulse" /> }
);
const H2HComparisonChart = dynamic(
  () => import("@/components/charts/H2HComparisonChart").then((m) => ({ default: m.H2HComparisonChart })),
  { ssr: false, loading: () => <div className="h-40 rounded-xl bg-surface-elevated animate-pulse" /> }
);
const XGTrendChart = dynamic(
  () => import("@/components/charts/xGTrendChart").then((m) => ({ default: m.XGTrendChart })),
  { ssr: false, loading: () => <div className="h-32 rounded-xl bg-surface-elevated animate-pulse" /> }
);

// ─── Sub-components ───────────────────────────────────────────────────────────

function ProbBar({ label, prob, color }: { label: string; prob: number; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-foreground w-10 shrink-0 text-right">{label}</span>
      <div className="flex-1 h-2 bg-surface-elevated rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${prob * 100}%` }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className={cn("h-full rounded-full", color)}
        />
      </div>
      <span className="text-sm font-mono font-semibold text-foreground w-12 shrink-0">
        {(prob * 100).toFixed(1)}%
      </span>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="glass-card p-4 text-center">
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
      {sub && <p className="text-xs text-neon-green mt-0.5">{sub}</p>}
    </div>
  );
}

function FormBadge({ result }: { result: string }) {
  const isW = result === "W";
  const isD = result === "D";
  const isL = result === "L";
  return (
    <span className={cn(
      "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold",
      isW ? "bg-neon-green/20 text-neon-green border border-neon-green/30" :
      isD ? "bg-amber-400/20 text-amber-400 border border-amber-400/30" :
      isL ? "bg-red-500/20 text-red-400 border border-red-500/30" :
            "bg-surface-elevated text-muted-foreground border border-surface-border"
    )}>
      {result}
    </span>
  );
}

function FormRow({ entry }: { entry: TeamFormEntry }) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-surface-border/50 last:border-0">
      <FormBadge result={entry.result} />
      <span className="text-xs text-muted-foreground w-20 shrink-0">{entry.date}</span>
      <span className="text-xs text-muted-foreground">{entry.home_or_away}</span>
      <span className="text-sm text-foreground flex-1">{entry.opponent}</span>
      <span className="text-sm font-mono font-semibold text-foreground">
        {entry.goals_for}–{entry.goals_against}
      </span>
    </div>
  );
}

function InjuryRow({ player }: { player: InjuredPlayerInfo }) {
  const statusColor =
    player.status === "suspended" ? "text-red-400 bg-red-500/10 border-red-500/20" :
    player.status === "doubtful"  ? "text-amber-400 bg-amber-400/10 border-amber-400/20" :
                                    "text-orange-400 bg-orange-400/10 border-orange-400/20";
  return (
    <div className="flex items-center gap-3 py-2 border-b border-surface-border/50 last:border-0">
      {player.photo_url ? (
        <img src={player.photo_url} alt="" className="w-8 h-8 rounded-full object-cover" />
      ) : (
        <div className="w-8 h-8 rounded-full bg-surface-elevated flex items-center justify-center">
          <Shield className="w-4 h-4 text-muted-foreground" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{player.name}</p>
        {player.position && <p className="text-xs text-muted-foreground">{player.position}</p>}
      </div>
      <div className="text-right">
        <span className={cn("text-[10px] font-bold uppercase px-2 py-0.5 rounded border", statusColor)}>
          {player.status}
        </span>
        {player.detail && (
          <p className="text-xs text-muted-foreground mt-0.5 max-w-[120px] truncate">{player.detail}</p>
        )}
      </div>
    </div>
  );
}

function H2HRow({ match }: { match: H2HResult }) {
  const homeWon = match.home_score > match.away_score;
  const awayWon = match.away_score > match.home_score;
  return (
    <div className="flex items-center gap-2 py-2 border-b border-surface-border/50 last:border-0 text-sm">
      <span className="text-xs text-muted-foreground w-20 shrink-0">{match.date}</span>
      <span className={cn("flex-1 text-right truncate", homeWon ? "text-neon-green font-semibold" : "text-foreground/70")}>
        {match.home_team}
      </span>
      <span className="font-mono font-bold text-foreground shrink-0 px-2">
        {match.home_score} – {match.away_score}
      </span>
      <span className={cn("flex-1 truncate", awayWon ? "text-neon-green font-semibold" : "text-foreground/70")}>
        {match.away_team}
      </span>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PredictionDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const predId = parseInt(id);

  const { data: analysis, isLoading, error } = useQuery<MatchAnalysis>({
    queryKey: ["prediction", "analysis", predId],
    queryFn: () => predictionsApi.getAnalysis(predId).then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });

  // Overlay live ESPN data if this match is currently in progress
  const { data: espnData } = useQuery<EspnLiveResponse>({
    queryKey: ["espn-live"],
    queryFn: () => matchesApi.getEspnLive().then((r) => r.data as EspnLiveResponse),
    refetchInterval: 30_000,
    enabled: !!analysis,
  });

  const liveMatch: EspnLiveMatch | null = espnData?.live_matches.find((lm) => {
    if (!analysis) return false;
    const hSlug = analysis.prediction.match.home_team.name.toLowerCase().slice(0, 6);
    const aSlug = analysis.prediction.match.away_team.name.toLowerCase().slice(0, 6);
    return (
      (lm.home_team.toLowerCase().includes(hSlug) || lm.away_team.toLowerCase().includes(hSlug)) &&
      (lm.home_team.toLowerCase().includes(aSlug) || lm.away_team.toLowerCase().includes(aSlug))
    );
  }) ?? null;

  if (isLoading) return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-56 rounded-xl" />
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  );

  if (error || !analysis) return (
    <div className="glass-card p-20 text-center space-y-3">
      <AlertTriangle className="w-10 h-10 text-red-400 mx-auto" />
      <p className="text-foreground font-medium">Analysis not found</p>
      <Link href="/predictions" className="text-neon-blue text-sm hover:underline">← Back to Predictions</Link>
    </div>
  );

  const { prediction: p, home_form, away_form, home_injuries, away_injuries, head_to_head } = analysis;
  const m = p.match;
  const matchDate = new Date(m.match_date);

  const bestOutcome =
    p.home_win_prob >= p.away_win_prob && p.home_win_prob >= p.draw_prob ? { label: m.home_team.name + " Win", prob: p.home_win_prob } :
    p.away_win_prob >= p.draw_prob ? { label: m.away_team.name + " Win", prob: p.away_win_prob } :
    { label: "Draw", prob: p.draw_prob };

  const confColor =
    p.confidence_score >= 75 ? "text-neon-green" :
    p.confidence_score >= 55 ? "text-amber-400" : "text-red-400";

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Back + Deep Analysis link */}
      <div className="flex items-center justify-between">
        <Link href="/predictions" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Predictions
        </Link>
        <Link
          href={`/predictions/${predId}/pre-match`}
          className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 bg-neon-purple/10 hover:bg-neon-purple/20 border border-neon-purple/30 text-neon-purple rounded-lg transition-colors"
        >
          <BarChart2 className="w-4 h-4" /> Deep Analysis
        </Link>
      </div>

      {/* Match header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm text-muted-foreground">{m.league.name} · {m.league.country}</span>
          <span className="text-sm text-muted-foreground">{format(matchDate, "EEEE, d MMMM yyyy · HH:mm")}</span>
        </div>
        {analysis.venue && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-4">
            <MapPin className="w-3 h-3" /> {analysis.venue}
          </div>
        )}

        {/* Teams */}
        <div className="flex items-center justify-between gap-6 my-6">
          <div className="flex-1 text-center space-y-2">
            {m.home_team.logo_url && (
              <Image src={m.home_team.logo_url} alt={m.home_team.name} width={64} height={64} className="mx-auto object-contain" />
            )}
            <p className="text-xl font-bold text-foreground">{m.home_team.name}</p>
            <p className="text-xs text-muted-foreground">ELO {m.home_team.elo_rating.toFixed(0)}</p>
            <div className="flex justify-center gap-1">
              {analysis.home_form_string.split(" ").map((r, i) => <FormBadge key={i} result={r} />)}
            </div>
          </div>

          <div className="text-center flex-shrink-0 space-y-1">
            {liveMatch ? (
              <>
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <motion.div
                    animate={{ opacity: [1, 0.2, 1] }}
                    transition={{ duration: 1.2, repeat: Infinity }}
                    className="w-2 h-2 rounded-full bg-red-500"
                  />
                  <span className="text-xs font-bold text-red-400 font-mono">{liveMatch.clock}</span>
                </div>
                <div className="text-4xl font-black text-neon-green font-mono">
                  {liveMatch.home_score} <span className="text-muted-foreground text-3xl">-</span> {liveMatch.away_score}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {liveMatch.status_name.replace(/^STATUS_/, "").replace(/_/g, " ")}
                </p>
              </>
            ) : (
              <>
                <div className="text-4xl font-black text-muted-foreground">VS</div>
                <p className="text-xs text-muted-foreground">{format(matchDate, "HH:mm")}</p>
              </>
            )}
          </div>

          <div className="flex-1 text-center space-y-2">
            {m.away_team.logo_url && (
              <Image src={m.away_team.logo_url} alt={m.away_team.name} width={64} height={64} className="mx-auto object-contain" />
            )}
            <p className="text-xl font-bold text-foreground">{m.away_team.name}</p>
            <p className="text-xs text-muted-foreground">ELO {m.away_team.elo_rating.toFixed(0)}</p>
            <div className="flex justify-center gap-1">
              {analysis.away_form_string.split(" ").map((r, i) => <FormBadge key={i} result={r} />)}
            </div>
          </div>
        </div>

        {/* Confidence + Value badge */}
        <div className="flex items-center justify-center gap-3">
          <span className={cn("text-2xl font-black", confColor)}>
            <Brain className="w-5 h-5 inline mr-1" />{p.confidence_score.toFixed(0)}% Confidence
          </span>
          {p.value_bet && (
            <span className="value-bet-badge text-sm px-3 py-1">
              <Zap className="w-4 h-4" /> Value Bet
            </span>
          )}
        </div>
      </motion.div>

      {/* Prediction probabilities */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Gauge */}
          <WinProbabilityGauge
            homeName={m.home_team.short_name ?? m.home_team.name}
            awayName={m.away_team.short_name ?? m.away_team.name}
            homeProb={p.home_win_prob}
            drawProb={p.draw_prob}
            awayProb={p.away_win_prob}
          />

          {/* Markets grid */}
          <div className="glass-card p-5 space-y-4 md:col-span-2">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-neon-green" /> AI Probability Breakdown
            </h2>
            <div className="space-y-3">
              <ProbBar label={m.home_team.short_name ?? "Home"} prob={p.home_win_prob} color="bg-neon-green" />
              <ProbBar label="Draw" prob={p.draw_prob} color="bg-amber-400" />
              <ProbBar label={m.away_team.short_name ?? "Away"} prob={p.away_win_prob} color="bg-neon-blue" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Over 2.5" value={`${(p.over_25_prob * 100).toFixed(0)}%`} />
              <StatCard label="Under 2.5" value={`${(p.under_25_prob * 100).toFixed(0)}%`} />
              <StatCard label="BTTS Yes" value={`${(p.btts_yes_prob * 100).toFixed(0)}%`} />
              <StatCard label="xG" value={`${p.home_xg.toFixed(1)} – ${p.away_xg.toFixed(1)}`} sub="Expected Goals" />
            </div>
            {p.recommended_bet && (
              <div className="p-3 rounded-lg bg-neon-green/10 border border-neon-green/20 flex items-center gap-2">
                <Target className="w-4 h-4 text-neon-green shrink-0" />
                <p className="text-sm text-foreground">
                  <span className="font-semibold text-neon-green">Recommended bet:</span>{" "}
                  {p.recommended_bet === "1" ? `${m.home_team.name} Win` :
                   p.recommended_bet === "X" ? "Draw" :
                   p.recommended_bet === "2" ? `${m.away_team.name} Win` :
                   p.recommended_bet}
                </p>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* AI Summary */}
      {(p.ai_summary || p.key_factors?.length) && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="glass-card p-6">
          <h2 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
            <Brain className="w-4 h-4 text-neon-purple" /> AI Analysis
          </h2>
          {p.ai_summary && <p className="text-sm text-foreground/80 leading-relaxed mb-4">{p.ai_summary}</p>}
          {p.key_factors && p.key_factors.length > 0 && (
            <ul className="space-y-2">
              {p.key_factors.map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                  <span className="text-neon-green mt-0.5 shrink-0">✓</span> {f}
                </li>
              ))}
            </ul>
          )}
        </motion.div>
      )}

      {/* Goal stats comparison */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="grid grid-cols-2 gap-4">
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4 text-neon-green" /> {m.home_team.name}
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Avg goals scored</span>
              <span className="font-semibold text-neon-green">{analysis.home_goals_scored_avg.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Avg goals conceded</span>
              <span className="font-semibold text-red-400">{analysis.home_goals_conceded_avg.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">xG (this match)</span>
              <span className="font-semibold text-foreground">{p.home_xg.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">ELO Rating</span>
              <span className="font-semibold text-foreground">{m.home_team.elo_rating.toFixed(0)}</span>
            </div>
          </div>
        </div>
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4 text-neon-blue" /> {m.away_team.name}
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Avg goals scored</span>
              <span className="font-semibold text-neon-green">{analysis.away_goals_scored_avg.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Avg goals conceded</span>
              <span className="font-semibold text-red-400">{analysis.away_goals_conceded_avg.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">xG (this match)</span>
              <span className="font-semibold text-foreground">{p.away_xg.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">ELO Rating</span>
              <span className="font-semibold text-foreground">{m.away_team.elo_rating.toFixed(0)}</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Dual-team Radar */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}>
        <TeamRadarChart
          home={{
            attack:        m.home_team.attack_strength,
            defense:       Math.max(0, 1 - m.home_team.defense_weakness),
            form:          Math.max(0, Math.min(1, m.home_team.form_score)),
            elo:           Math.max(0, Math.min(1, (m.home_team.elo_rating - 1000) / 1000)),
            home_advantage: 0.65,
          }}
          away={{
            attack:        m.away_team.attack_strength,
            defense:       Math.max(0, 1 - m.away_team.defense_weakness),
            form:          Math.max(0, Math.min(1, m.away_team.form_score)),
            elo:           Math.max(0, Math.min(1, (m.away_team.elo_rating - 1000) / 1000)),
            home_advantage: 0.35,
          }}
          homeName={m.home_team.short_name ?? m.home_team.name}
          awayName={m.away_team.short_name ?? m.away_team.name}
        />
      </motion.div>

      {/* Goals / xG Trend */}
      {(home_form.length > 0 || away_form.length > 0) && (() => {
        const maxLen = Math.max(home_form.length, away_form.length);
        const xgData = Array.from({ length: Math.min(maxLen, 8) }, (_, i) => {
          const hi = home_form.length - Math.min(maxLen, 8) + i;
          const ai = away_form.length - Math.min(maxLen, 8) + i;
          return {
            match: `M${i + 1}`,
            home_xg: hi >= 0 ? home_form[hi].goals_for : 0,
            away_xg: ai >= 0 ? away_form[ai].goals_for : 0,
          };
        });
        return (
          <XGTrendChart
            data={xgData}
            homeName={`${m.home_team.short_name ?? m.home_team.name} Goals`}
            awayName={`${m.away_team.short_name ?? m.away_team.name} Goals`}
          />
        );
      })()}

      {/* Recent Form Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {home_form.length > 0 ? (
          <FormTrendChart entries={home_form} teamName={m.home_team.name} color="#00FF87" />
        ) : (
          <div className="glass-card p-5 flex items-center justify-center">
            <p className="text-xs text-muted-foreground">No form data for {m.home_team.name}</p>
          </div>
        )}
        {away_form.length > 0 ? (
          <FormTrendChart entries={away_form} teamName={m.away_team.name} color="#60CDFF" />
        ) : (
          <div className="glass-card p-5 flex items-center justify-center">
            <p className="text-xs text-muted-foreground">No form data for {m.away_team.name}</p>
          </div>
        )}
      </div>

      {/* Injuries / Suspensions */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-400" /> {m.home_team.name} — Injuries & Suspensions
          </h3>
          {home_injuries.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">No known injuries or suspensions</p>
          ) : (
            home_injuries.map((p, i) => <InjuryRow key={i} player={p} />)
          )}
        </div>
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-400" /> {m.away_team.name} — Injuries & Suspensions
          </h3>
          {away_injuries.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">No known injuries or suspensions</p>
          ) : (
            away_injuries.map((p, i) => <InjuryRow key={i} player={p} />)
          )}
        </div>
      </motion.div>

      {/* Head to Head */}
      {head_to_head.length > 0 ? (
        <H2HComparisonChart
          results={head_to_head}
          homeName={m.home_team.name}
          awayName={m.away_team.name}
        />
      ) : (
        <div className="glass-card p-8 text-center space-y-2">
          <Shield className="w-8 h-8 text-muted-foreground/40 mx-auto" />
          <p className="text-sm text-muted-foreground">No head-to-head history available</p>
          <p className="text-xs text-muted-foreground/60">AI model uses ELO ratings and statistical parameters</p>
        </div>
      )}

      {/* Odds */}
      {(p.odds_home || p.odds_draw || p.odds_away) && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="glass-card p-6">
          <h2 className="text-base font-semibold text-foreground mb-4">Market Odds (at prediction time)</h2>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-3 rounded-lg bg-surface-elevated">
              <p className="text-xs text-muted-foreground mb-1">{m.home_team.name}</p>
              <p className="text-2xl font-bold text-foreground">{p.odds_home?.toFixed(2) ?? "—"}</p>
              <p className="text-xs text-muted-foreground mt-1">Implied: {p.odds_home ? (100 / p.odds_home).toFixed(0) : "—"}%</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-surface-elevated">
              <p className="text-xs text-muted-foreground mb-1">Draw</p>
              <p className="text-2xl font-bold text-foreground">{p.odds_draw?.toFixed(2) ?? "—"}</p>
              <p className="text-xs text-muted-foreground mt-1">Implied: {p.odds_draw ? (100 / p.odds_draw).toFixed(0) : "—"}%</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-surface-elevated">
              <p className="text-xs text-muted-foreground mb-1">{m.away_team.name}</p>
              <p className="text-2xl font-bold text-foreground">{p.odds_away?.toFixed(2) ?? "—"}</p>
              <p className="text-xs text-muted-foreground mt-1">Implied: {p.odds_away ? (100 / p.odds_away).toFixed(0) : "—"}%</p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
