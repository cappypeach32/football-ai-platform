"use client";

import { useQuery } from "@tanstack/react-query";
import { predictionsApi } from "@/lib/api";
import type {
  PreMatchAnalysis,
  FormSummary,
  SquadAnalysis,
  TacticalMatchup,
  H2HSummary,
  GoalTrends,
  TacticalStyle,
  InjuredPlayerInfo,
  TeamFormEntry,
  H2HResult,
} from "@/types";
import { motion } from "framer-motion";
import {
  Brain, Shield, Target, Zap, TrendingUp, AlertTriangle,
  Users, ArrowLeft, Activity, BarChart2, Crosshair,
  ChevronRight, Clock, Star,
} from "lucide-react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";

// ── Helpers ───────────────────────────────────────────────────────────────────

function MomentumBar({ value }: { value: number }) {
  // value: -1 → +1
  const pct = ((value + 1) / 2) * 100;
  return (
    <div className="relative h-2 bg-surface-elevated rounded-full overflow-hidden">
      <div className="absolute left-1/2 top-0 h-full w-px bg-border z-10" />
      <motion.div
        initial={{ width: 0, x: "50%" }}
        animate={
          value >= 0
            ? { width: `${(value / 1) * 50}%`, x: "50%" }
            : { width: `${(Math.abs(value) / 1) * 50}%`, x: `${50 - Math.abs(value) * 50}%` }
        }
        transition={{ duration: 0.8, ease: "easeOut" }}
        className={cn(
          "absolute top-0 h-full rounded-full",
          value >= 0 ? "bg-neon-green" : "bg-red-500"
        )}
      />
    </div>
  );
}

function FormBadge({ result }: { result: string }) {
  if (result === "—") return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold",
        result === "W" && "bg-neon-green/20 text-neon-green border border-neon-green/30",
        result === "D" && "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30",
        result === "L" && "bg-red-500/20 text-red-400 border border-red-500/30"
      )}
    >
      {result}
    </span>
  );
}

function SectionHeader({ icon: Icon, title, accent = "green" }: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  accent?: "green" | "blue" | "purple";
}) {
  const accentCls = {
    green: "text-neon-green",
    blue: "text-neon-blue",
    purple: "text-neon-purple",
  }[accent];
  return (
    <div className="flex items-center gap-3 mb-5">
      <Icon className={cn("w-5 h-5", accentCls)} />
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
    </div>
  );
}

function GlassCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("glass-card p-5 rounded-2xl", className)}>
      {children}
    </div>
  );
}

// ── Team Overview ─────────────────────────────────────────────────────────────

function TeamOverviewCard({
  name, form, goals, style, isHome,
}: {
  name: string;
  form: FormSummary;
  goals: GoalTrends;
  style: TacticalStyle;
  isHome: boolean;
}) {
  const color = isHome ? "text-neon-green" : "text-neon-blue";
  const badgeCls = isHome
    ? "bg-neon-green/10 text-neon-green border border-neon-green/20"
    : "bg-neon-blue/10 text-neon-blue border border-neon-blue/20";

  return (
    <GlassCard>
      <div className="flex items-center justify-between mb-4">
        <h3 className={cn("font-bold text-base", color)}>{name}</h3>
        <span className={cn("text-xs px-2 py-0.5 rounded-full", badgeCls)}>
          {isHome ? "Home" : "Away"}
        </span>
      </div>

      {/* Form */}
      <div className="mb-4">
        <p className="text-xs text-muted-foreground mb-2">Recent Form (newest first)</p>
        <div className="flex gap-1.5 flex-wrap">
          {form.form_string.split(" ").map((r, i) => (
            <FormBadge key={i} result={r} />
          ))}
        </div>
      </div>

      {/* Momentum */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          <span>Losing</span>
          <span>Momentum: <strong className={cn(form.momentum >= 0 ? "text-neon-green" : "text-red-400")}>
            {form.momentum >= 0 ? "+" : ""}{(form.momentum * 100).toFixed(0)}
          </strong></span>
          <span>Winning</span>
        </div>
        <MomentumBar value={form.momentum} />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[
          { label: "Goals/G", value: goals.avg_scored.toFixed(1) },
          { label: "Conceded", value: goals.avg_conceded.toFixed(1) },
          { label: "Clean Sh.", value: form.clean_sheets.toString() },
        ].map(({ label, value }) => (
          <div key={label} className="bg-surface-elevated rounded-lg p-2 text-center">
            <p className="text-base font-bold text-foreground">{value}</p>
            <p className="text-[10px] text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {/* Goal trends */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        {[
          { label: "Over 2.5 rate", value: `${(goals.over_25_rate * 100).toFixed(0)}%` },
          { label: "BTTS rate", value: `${(goals.btts_rate * 100).toFixed(0)}%` },
        ].map(({ label, value }) => (
          <div key={label} className="bg-surface-elevated rounded-lg p-2 text-center">
            <p className="text-sm font-semibold text-foreground">{value}</p>
            <p className="text-[10px] text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {/* Tactical style */}
      <div className="border-t border-border/50 pt-3">
        <p className="text-[10px] text-muted-foreground mb-1">Tactical Profile</p>
        <p className="text-sm font-medium text-foreground mb-2">{style.label}</p>
        <div className="flex flex-wrap gap-1.5">
          {[
            `${style.pressing_intensity} press`,
            `${style.defensive_line} line`,
            `${style.build_up} build-up`,
          ].map((tag) => (
            <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-surface-elevated text-muted-foreground border border-border/50">
              {tag}
            </span>
          ))}
        </div>
      </div>
    </GlassCard>
  );
}

// ── Squad Analysis ─────────────────────────────────────────────────────────────

function SquadCard({ name, squad, isHome }: { name: string; squad: SquadAnalysis; isHome: boolean }) {
  const color = isHome ? "text-neon-green" : "text-neon-blue";
  const allMissing = [...squad.injured, ...squad.suspended, ...squad.doubtful];

  return (
    <GlassCard>
      <div className="flex items-center justify-between mb-4">
        <h3 className={cn("font-semibold text-sm", color)}>{name}</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Impact:</span>
          <span className={cn(
            "text-xs font-bold px-2 py-0.5 rounded-full",
            squad.impact_score > 5 ? "bg-red-500/20 text-red-400" :
            squad.impact_score > 2.5 ? "bg-yellow-500/20 text-yellow-400" :
            "bg-neon-green/20 text-neon-green"
          )}>
            {squad.impact_score.toFixed(1)}/10
          </span>
        </div>
      </div>

      {/* Counts */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[
          { label: "Injured", count: squad.injured.length, cls: "text-red-400" },
          { label: "Suspended", count: squad.suspended.length, cls: "text-yellow-400" },
          { label: "Doubtful", count: squad.doubtful.length, cls: "text-orange-400" },
        ].map(({ label, count, cls }) => (
          <div key={label} className="bg-surface-elevated rounded-lg p-2 text-center">
            <p className={cn("text-lg font-bold", cls)}>{count}</p>
            <p className="text-[10px] text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {/* Player list */}
      {allMissing.length > 0 ? (
        <div className="space-y-2">
          {allMissing.map((p) => (
            <div key={p.name} className="flex items-center justify-between bg-surface-elevated rounded-lg px-3 py-2">
              <div>
                <p className="text-xs font-medium text-foreground">{p.name}</p>
                {p.position && <p className="text-[10px] text-muted-foreground">{p.position}</p>}
              </div>
              <span className={cn(
                "text-[10px] px-2 py-0.5 rounded-full capitalize",
                p.status === "injured" && "bg-red-500/20 text-red-400",
                p.status === "suspended" && "bg-yellow-500/20 text-yellow-400",
                p.status === "doubtful" && "bg-orange-500/20 text-orange-400",
              )}>
                {p.status}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground text-center py-3">Full squad available</p>
      )}

      <div className="border-t border-border/50 mt-3 pt-3 flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">Expected shape</span>
        <span className="text-xs font-mono font-semibold text-foreground">{squad.lineup_shape}</span>
      </div>
    </GlassCard>
  );
}

// ── Tactical Matchup ──────────────────────────────────────────────────────────

function MatchupCard({ matchup, homeName, awayName }: {
  matchup: TacticalMatchup;
  homeName: string;
  awayName: string;
}) {
  const edgeColor = (edge: string) =>
    edge === "Home" ? "text-neon-green" : edge === "Away" ? "text-neon-blue" : "text-yellow-400";

  return (
    <GlassCard>
      {/* Danger rating */}
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm text-muted-foreground">Match Danger Rating</p>
        <div className="flex items-center gap-2">
          <div className="flex gap-0.5">
            {[1,2,3,4,5,6,7,8,9,10].map((n) => (
              <div key={n} className={cn(
                "w-2 h-5 rounded-sm",
                n <= matchup.danger_rating
                  ? matchup.danger_rating >= 7 ? "bg-red-500" : matchup.danger_rating >= 5 ? "bg-yellow-500" : "bg-neon-green"
                  : "bg-surface-elevated"
              )} />
            ))}
          </div>
          <span className="text-sm font-bold text-foreground">{matchup.danger_rating}/10</span>
        </div>
      </div>

      {/* Edge indicators */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: "Pressing", edge: matchup.pressing_verdict.includes(homeName) ? "Home" : matchup.pressing_verdict.includes(awayName) ? "Away" : "Even" },
          { label: "Transitions", edge: matchup.transition_edge },
          { label: "xG Edge", edge: matchup.xg_edge },
        ].map(({ label, edge }) => (
          <div key={label} className="bg-surface-elevated rounded-xl p-3 text-center">
            <p className="text-[10px] text-muted-foreground mb-1">{label}</p>
            <p className={cn("text-sm font-bold", edgeColor(edge))}>{edge}</p>
          </div>
        ))}
      </div>

      {/* Key battle */}
      <div className="bg-neon-purple/10 border border-neon-purple/20 rounded-xl p-3 mb-4">
        <p className="text-[10px] text-neon-purple mb-1 flex items-center gap-1">
          <Crosshair className="w-3 h-3" /> Key Battle
        </p>
        <p className="text-xs text-foreground">{matchup.key_battle}</p>
      </div>

      {/* Advantages */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] text-neon-green mb-2 font-semibold">{homeName} advantages</p>
          <div className="space-y-1.5">
            {matchup.home_advantage_areas.map((a) => (
              <div key={a} className="flex items-center gap-1.5">
                <ChevronRight className="w-3 h-3 text-neon-green shrink-0" />
                <span className="text-[11px] text-foreground">{a}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[10px] text-neon-blue mb-2 font-semibold">{awayName} advantages</p>
          <div className="space-y-1.5">
            {matchup.away_advantage_areas.map((a) => (
              <div key={a} className="flex items-center gap-1.5">
                <ChevronRight className="w-3 h-3 text-neon-blue shrink-0" />
                <span className="text-[11px] text-foreground">{a}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </GlassCard>
  );
}

// ── H2H ──────────────────────────────────────────────────────────────────────

function H2HCard({ h2h, homeName }: { h2h: H2HSummary; homeName: string }) {
  const total = h2h.home_wins + h2h.draws + h2h.away_wins;
  const pctH = total ? (h2h.home_wins / total) * 100 : 33;
  const pctD = total ? (h2h.draws / total) * 100 : 33;
  const pctA = total ? (h2h.away_wins / total) * 100 : 34;

  return (
    <GlassCard>
      {h2h.total_meetings === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">No H2H data available</p>
      ) : (
        <>
          {/* Bar */}
          <div className="flex h-8 rounded-lg overflow-hidden mb-4">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pctH}%` }}
              transition={{ duration: 0.7, delay: 0.1 }}
              className="bg-neon-green flex items-center justify-center"
            >
              <span className="text-xs font-bold text-black">{h2h.home_wins}W</span>
            </motion.div>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pctD}%` }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="bg-yellow-500 flex items-center justify-center"
            >
              <span className="text-xs font-bold text-black">{h2h.draws}D</span>
            </motion.div>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pctA}%` }}
              transition={{ duration: 0.7, delay: 0.3 }}
              className="bg-neon-blue flex items-center justify-center"
            >
              <span className="text-xs font-bold text-black">{h2h.away_wins}W</span>
            </motion.div>
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground mb-4">
            <span>{homeName}</span>
            <span>Draw</span>
            <span>Away</span>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-surface-elevated rounded-lg p-3 text-center">
              <p className="text-base font-bold text-foreground">{h2h.avg_total_goals.toFixed(1)}</p>
              <p className="text-[10px] text-muted-foreground">Avg goals/match</p>
            </div>
            <div className="bg-surface-elevated rounded-lg p-3 text-center">
              <p className="text-base font-bold text-foreground">{h2h.total_meetings}</p>
              <p className="text-[10px] text-muted-foreground">Total meetings</p>
            </div>
          </div>

          {/* Trend */}
          <div className="bg-neon-green/10 border border-neon-green/20 rounded-lg p-3 mb-4">
            <p className="text-xs text-foreground italic">"{h2h.trend}"</p>
          </div>

          {/* Last 3 */}
          {h2h.last_3.length > 0 && (
            <div>
              <p className="text-[10px] text-muted-foreground mb-2">Last meetings</p>
              <div className="space-y-1.5">
                {h2h.last_3.map((result, i) => (
                  <div key={i} className="flex items-center gap-2 bg-surface-elevated rounded-lg px-3 py-2">
                    <Clock className="w-3 h-3 text-muted-foreground shrink-0" />
                    <span className="text-xs text-foreground font-mono">{result}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </GlassCard>
  );
}

// ── Recent Form Table ─────────────────────────────────────────────────────────

function calcFormStats(entries: TeamFormEntry[]) {
  const last5 = [...entries].reverse().slice(0, 5);
  const w = last5.filter((e) => e.result === "W").length;
  const d = last5.filter((e) => e.result === "D").length;
  const l = last5.filter((e) => e.result === "L").length;
  const gf = last5.reduce((s, e) => s + e.goals_for, 0);
  const ga = last5.reduce((s, e) => s + e.goals_against, 0);

  // Streaks (from most recent)
  const sorted = [...entries].reverse(); // newest first
  let unbeaten = 0;
  for (const e of sorted) {
    if (e.result === "L") break;
    unbeaten++;
  }
  let winStreak = 0;
  for (const e of sorted) {
    if (e.result !== "W") break;
    winStreak++;
  }
  let noCS = 0; // no clean sheet streak
  for (const e of sorted) {
    if (e.goals_against === 0) break;
    noCS++;
  }
  let csStreak = 0; // clean sheet streak
  for (const e of sorted) {
    if (e.goals_against > 0) break;
    csStreak++;
  }

  const homeEntries = sorted.filter((e) => e.home_or_away === "H");
  const awayEntries = sorted.filter((e) => e.home_or_away === "A");

  return { w, d, l, gf, ga, unbeaten, winStreak, noCS, csStreak, homeEntries, awayEntries, last5 };
}

function StreakBadge({ stats }: { stats: ReturnType<typeof calcFormStats> }) {
  const badges: { text: string; cls: string }[] = [];

  if (stats.winStreak >= 3)
    badges.push({ text: `🔥 Won last ${stats.winStreak}`, cls: "bg-neon-green/20 text-neon-green border-neon-green/30" });
  else if (stats.unbeaten >= 3)
    badges.push({ text: `✅ Unbeaten in ${stats.unbeaten}`, cls: "bg-neon-green/20 text-neon-green border-neon-green/30" });

  if (stats.csStreak >= 2)
    badges.push({ text: `🔒 ${stats.csStreak} clean sheets`, cls: "bg-neon-blue/20 text-neon-blue border-neon-blue/30" });
  else if (stats.noCS >= 4)
    badges.push({ text: `❌ No clean sheet in ${stats.noCS}`, cls: "bg-red-500/20 text-red-400 border-red-500/30" });

  if (stats.l >= 3)
    badges.push({ text: `📉 Lost ${stats.l} of last 5`, cls: "bg-red-500/20 text-red-400 border-red-500/30" });

  if (badges.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 mb-3">
      {badges.map((b) => (
        <span key={b.text} className={cn("text-[10px] px-2 py-0.5 rounded-full border", b.cls)}>
          {b.text}
        </span>
      ))}
    </div>
  );
}

function HomeAwaySplit({ homeEntries, awayEntries }: {
  homeEntries: TeamFormEntry[];
  awayEntries: TeamFormEntry[];
}) {
  const renderMini = (ents: TeamFormEntry[]) =>
    ents.slice(0, 4).map((e, i) => <FormBadge key={i} result={e.result} />);

  return (
    <div className="grid grid-cols-2 gap-2 mb-3">
      <div className="bg-surface-elevated rounded-lg px-3 py-2">
        <p className="text-[10px] text-muted-foreground mb-1.5">🏠 Home</p>
        <div className="flex gap-1">
          {homeEntries.length > 0 ? renderMini(homeEntries) : <span className="text-[10px] text-muted-foreground">—</span>}
        </div>
      </div>
      <div className="bg-surface-elevated rounded-lg px-3 py-2">
        <p className="text-[10px] text-muted-foreground mb-1.5">✈️ Away</p>
        <div className="flex gap-1">
          {awayEntries.length > 0 ? renderMini(awayEntries) : <span className="text-[10px] text-muted-foreground">—</span>}
        </div>
      </div>
    </div>
  );
}

function RecentFormTable({ entries, name, isHome }: {
  entries: TeamFormEntry[];
  name: string;
  isHome: boolean;
}) {
  const color = isHome ? "text-neon-green" : "text-neon-blue";
  const stats = calcFormStats(entries);

  return (
    <GlassCard>
      <h3 className={cn("font-semibold text-sm mb-3", color)}>{name} — Last Matches</h3>

      {entries.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">No recent matches</p>
      ) : (
        <>
          {/* Summary stats row */}
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex gap-2 text-xs font-mono">
              <span className="text-neon-green font-bold">W{stats.w}</span>
              <span className="text-yellow-400 font-bold">D{stats.d}</span>
              <span className="text-red-400 font-bold">L{stats.l}</span>
            </div>
            <div className="text-xs text-muted-foreground">
              Goals:{" "}
              <span className={cn("font-semibold", stats.gf > stats.ga ? "text-neon-green" : stats.gf < stats.ga ? "text-red-400" : "text-yellow-400")}>
                {stats.gf}–{stats.ga}
              </span>
              <span className={cn("ml-1.5 text-[10px]", stats.gf - stats.ga > 0 ? "text-neon-green" : "text-red-400")}>
                ({stats.gf - stats.ga >= 0 ? "+" : ""}{stats.gf - stats.ga} GD)
              </span>
            </div>
          </div>

          {/* Streak badges */}
          <StreakBadge stats={stats} />

          {/* Home/Away split */}
          <HomeAwaySplit homeEntries={stats.homeEntries} awayEntries={stats.awayEntries} />

          {/* Match rows */}
          <div className="space-y-1.5">
            {stats.last5.map((e, i) => (
              <div key={i} className="flex items-center gap-3 bg-surface-elevated rounded-lg px-3 py-2">
                <FormBadge result={e.result} />
                <span className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0",
                  e.home_or_away === "H"
                    ? "bg-neon-green/10 text-neon-green"
                    : "bg-neon-blue/10 text-neon-blue"
                )}>
                  {e.home_or_away}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-foreground truncate">
                    {e.home_or_away === "H" ? "vs" : "@"} {e.opponent}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{e.date}</p>
                </div>
                <span className={cn(
                  "text-xs font-mono font-bold whitespace-nowrap",
                  e.result === "W" ? "text-neon-green" : e.result === "L" ? "text-red-400" : "text-yellow-400"
                )}>
                  {e.goals_for}–{e.goals_against}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </GlassCard>
  );
}

// ── Narrative ─────────────────────────────────────────────────────────────────

function NarrativeCard({ text }: { text: string }) {
  return (
    <GlassCard className="border border-neon-purple/20">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-neon-purple/20 flex items-center justify-center shrink-0 mt-0.5">
          <Brain className="w-4 h-4 text-neon-purple" />
        </div>
        <div>
          <p className="text-xs font-semibold text-neon-purple mb-2">AI Analysis</p>
          <p className="text-sm text-foreground leading-relaxed">{text}</p>
        </div>
      </div>
    </GlassCard>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function PreMatchAnalysisPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  const predId = parseInt(id, 10);

  const { data, isLoading, error } = useQuery({
    queryKey: ["pre-match", predId],
    queryFn: async () => {
      const res = await predictionsApi.getPreMatch(predId);
      return res.data as PreMatchAnalysis;
    },
    enabled: !isNaN(predId),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-4">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-48 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8 text-center">
        <p className="text-red-400">Failed to load pre-match analysis.</p>
        <Link href={`/predictions/${id}`} className="text-neon-green text-sm mt-2 inline-block hover:underline">
          ← Back to prediction
        </Link>
      </div>
    );
  }

  const fade = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Back nav */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href={`/predictions/${id}`}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to prediction
        </Link>
        <span className="text-border">|</span>
        <span className="text-sm text-muted-foreground">Pre-Match Deep Analysis</span>
      </div>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
          <span className="text-neon-green">{data.home_name}</span>
          <span className="text-muted-foreground mx-3">vs</span>
          <span className="text-neon-blue">{data.away_name}</span>
        </h1>
        <p className="text-sm text-muted-foreground">Pre-Match Analysis Engine</p>
      </motion.div>

      {/* AI Narrative */}
      <motion.div variants={fade} initial="hidden" animate="show" transition={{ delay: 0.05 }} className="mb-6">
        <SectionHeader icon={Brain} title="AI Narrative" accent="purple" />
        <NarrativeCard text={data.narrative} />
      </motion.div>

      {/* Team Overview */}
      <motion.div variants={fade} initial="hidden" animate="show" transition={{ delay: 0.1 }} className="mb-6">
        <SectionHeader icon={Activity} title="Team Overview" accent="green" />
        <div className="grid md:grid-cols-2 gap-4">
          <TeamOverviewCard
            name={data.home_name}
            form={data.home_form}
            goals={data.home_goals}
            style={data.home_style}
            isHome={true}
          />
          <TeamOverviewCard
            name={data.away_name}
            form={data.away_form}
            goals={data.away_goals}
            style={data.away_style}
            isHome={false}
          />
        </div>
      </motion.div>

      {/* Recent form tables */}
      <motion.div variants={fade} initial="hidden" animate="show" transition={{ delay: 0.15 }} className="mb-6">
        <SectionHeader icon={TrendingUp} title="Recent Matches" accent="green" />
        <div className="grid md:grid-cols-2 gap-4">
          <RecentFormTable entries={data.home_form_entries} name={data.home_name} isHome={true} />
          <RecentFormTable entries={data.away_form_entries} name={data.away_name} isHome={false} />
        </div>
      </motion.div>

      {/* Squad Analysis */}
      <motion.div variants={fade} initial="hidden" animate="show" transition={{ delay: 0.2 }} className="mb-6">
        <SectionHeader icon={Users} title="Squad Analysis" accent="blue" />
        <div className="grid md:grid-cols-2 gap-4">
          <SquadCard name={data.home_name} squad={data.home_squad} isHome={true} />
          <SquadCard name={data.away_name} squad={data.away_squad} isHome={false} />
        </div>
      </motion.div>

      {/* Tactical Matchup */}
      <motion.div variants={fade} initial="hidden" animate="show" transition={{ delay: 0.25 }} className="mb-6">
        <SectionHeader icon={Crosshair} title="Tactical Matchup" accent="purple" />
        <MatchupCard matchup={data.matchup} homeName={data.home_name} awayName={data.away_name} />
      </motion.div>

      {/* H2H */}
      <motion.div variants={fade} initial="hidden" animate="show" transition={{ delay: 0.3 }} className="mb-6">
        <SectionHeader icon={BarChart2} title="Historical Comparison" accent="blue" />
        <H2HCard h2h={data.h2h} homeName={data.home_name} />
      </motion.div>

      {/* CTA back to prediction */}
      <div className="text-center mt-8">
        <Link
          href={`/predictions/${id}`}
          className="inline-flex items-center gap-2 px-6 py-3 bg-neon-green/10 hover:bg-neon-green/20 border border-neon-green/30 text-neon-green rounded-xl text-sm font-medium transition-colors"
        >
          <Target className="w-4 h-4" />
          View AI Prediction
        </Link>
      </div>
    </div>
  );
}
