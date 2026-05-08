"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Brain, Zap, TrendingUp, Shield, Target, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MatchAnalysis } from "@/types";

interface Props {
  analysis: MatchAnalysis;
}

type Section = "tactical" | "stats" | "ai";

const SECTIONS: { id: Section; label: string; icon: typeof Brain }[] = [
  { id: "ai",       label: "AI Summary",       icon: Brain },
  { id: "tactical", label: "Tactical Breakdown", icon: Zap },
  { id: "stats",    label: "Key Statistics",    icon: TrendingUp },
];

function StatRow({ label, home, away, homeColor = "text-neon-green", awayColor = "text-neon-blue" }: {
  label: string;
  home: string | number;
  away: string | number;
  homeColor?: string;
  awayColor?: string;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-2 border-b border-surface-border/40 last:border-0">
      <span className={cn("text-sm font-semibold text-right tabular-nums", homeColor)}>{home}</span>
      <span className="text-[10px] text-muted-foreground text-center min-w-[100px] px-2">{label}</span>
      <span className={cn("text-sm font-semibold tabular-nums", awayColor)}>{away}</span>
    </div>
  );
}

function FactChip({ text, idx }: { text: string; idx: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: idx * 0.06 }}
      className="flex items-start gap-2 text-sm text-foreground/90"
    >
      <div className="mt-1 w-1.5 h-1.5 rounded-full bg-neon-green shrink-0" style={{ boxShadow: "0 0 6px rgba(0,255,135,0.8)" }} />
      {text}
    </motion.div>
  );
}

export function MatchIntelligencePanel({ analysis }: Props) {
  const [open, setOpen] = useState(true);
  const [active, setActive] = useState<Section>("ai");

  const { prediction: p } = analysis;
  const m = p.match;

  const keyFactors: string[] = p.key_factors ?? [];
  const tacticalNotes = p.tactical_notes ?? "";
  const aiSummary = p.ai_summary ?? "";

  return (
    <div className="glass-card overflow-hidden">
      {/* Header — always visible */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between p-5 text-left group"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-neon-purple/15 flex items-center justify-center">
            <Brain className="w-4 h-4 text-neon-purple" style={{ filter: "drop-shadow(0 0 4px rgba(139,92,246,0.7))" }} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Match Intelligence</h3>
            <p className="text-xs text-muted-foreground">AI tactical analysis · Key factors · Stats</p>
          </div>
        </div>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.25 }}>
          <ChevronDown className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            style={{ overflow: "hidden" }}
          >
            {/* Tab nav */}
            <div className="flex border-t border-surface-border/60 px-5">
              {SECTIONS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setActive(s.id)}
                  className={cn(
                    "flex items-center gap-1.5 py-3 px-3 text-xs font-medium border-b-2 transition-colors",
                    active === s.id
                      ? "border-neon-purple text-neon-purple"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  <s.icon className="w-3.5 h-3.5" />
                  {s.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="p-5 pt-4">
              <AnimatePresence mode="wait">
                {active === "ai" && (
                  <motion.div
                    key="ai"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-4"
                  >
                    {aiSummary ? (
                      <p className="text-sm text-foreground/80 leading-relaxed">{aiSummary}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">No AI summary available.</p>
                    )}
                    {keyFactors.length > 0 && (
                      <div className="space-y-2 pt-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Key Factors</p>
                        <div className="space-y-2">
                          {keyFactors.map((f, i) => <FactChip key={i} text={f} idx={i} />)}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}

                {active === "tactical" && (
                  <motion.div
                    key="tactical"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-4"
                  >
                    {tacticalNotes ? (
                      <p className="text-sm text-foreground/80 leading-relaxed">{tacticalNotes}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">No tactical notes available.</p>
                    )}

                    {/* Risk + confidence mini-indicators */}
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <div className="bg-surface-navy/60 rounded-xl p-3 space-y-1 border border-surface-border/50">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Shield className="w-3 h-3" /> Risk Score
                        </div>
                        <div className="flex items-end gap-1.5">
                          <span className={cn(
                            "text-2xl font-bold font-mono",
                            p.risk_score < 30 ? "text-neon-green" :
                            p.risk_score < 60 ? "text-amber-400" : "text-red-400"
                          )}>
                            {p.risk_score.toFixed(0)}
                          </span>
                          <span className="text-xs text-muted-foreground pb-0.5">/100</span>
                        </div>
                        <div className="w-full h-1 bg-surface-elevated rounded-full overflow-hidden">
                          <motion.div
                            className={cn(
                              "h-full rounded-full",
                              p.risk_score < 30 ? "bg-neon-green" :
                              p.risk_score < 60 ? "bg-amber-400" : "bg-red-400"
                            )}
                            initial={{ width: 0 }}
                            animate={{ width: `${p.risk_score}%` }}
                            transition={{ duration: 0.8, delay: 0.1, ease: "easeOut" }}
                          />
                        </div>
                      </div>
                      <div className="bg-surface-navy/60 rounded-xl p-3 space-y-1 border border-surface-border/50">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Target className="w-3 h-3" /> AI Confidence
                        </div>
                        <div className="flex items-end gap-1.5">
                          <span className={cn(
                            "text-2xl font-bold font-mono",
                            p.confidence_score >= 70 ? "text-neon-green" :
                            p.confidence_score >= 50 ? "text-amber-400" : "text-red-400"
                          )}>
                            {p.confidence_score.toFixed(0)}
                          </span>
                          <span className="text-xs text-muted-foreground pb-0.5">/100</span>
                        </div>
                        <div className="w-full h-1 bg-surface-elevated rounded-full overflow-hidden">
                          <motion.div
                            className={cn(
                              "h-full rounded-full",
                              p.confidence_score >= 70 ? "bg-neon-green" :
                              p.confidence_score >= 50 ? "bg-amber-400" : "bg-red-400"
                            )}
                            initial={{ width: 0 }}
                            animate={{ width: `${p.confidence_score}%` }}
                            transition={{ duration: 0.8, delay: 0.15, ease: "easeOut" }}
                          />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {active === "stats" && (
                  <motion.div
                    key="stats"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.2 }}
                  >
                    {/* Team labels */}
                    <div className="grid grid-cols-[1fr_auto_1fr] mb-3 gap-3">
                      <p className="text-xs font-semibold text-neon-green text-right truncate">{m.home_team.name}</p>
                      <div className="min-w-[100px]" />
                      <p className="text-xs font-semibold text-neon-blue truncate">{m.away_team.name}</p>
                    </div>
                    <StatRow label="xG" home={p.home_xg.toFixed(2)} away={p.away_xg.toFixed(2)} />
                    <StatRow label="Win Prob" home={`${(p.home_win_prob * 100).toFixed(1)}%`} away={`${(p.away_win_prob * 100).toFixed(1)}%`} />
                    <StatRow label="Goals Scored avg" home={analysis.home_goals_scored_avg.toFixed(2)} away={analysis.away_goals_scored_avg.toFixed(2)} />
                    <StatRow label="Goals Conceded avg" home={analysis.home_goals_conceded_avg.toFixed(2)} away={analysis.away_goals_conceded_avg.toFixed(2)} />
                    <StatRow label="ELO" home={m.home_team.elo_rating.toFixed(0)} away={m.away_team.elo_rating.toFixed(0)} />
                    <StatRow label="Attack str." home={m.home_team.attack_strength.toFixed(2)} away={m.away_team.attack_strength.toFixed(2)} />
                    <StatRow label="Defense weak." home={m.home_team.defense_weakness.toFixed(2)} away={m.away_team.defense_weakness.toFixed(2)} />
                    <div className="mt-4 pt-3 border-t border-surface-border/40 flex justify-between text-xs text-muted-foreground">
                      <span>Over 2.5: <span className="text-foreground font-semibold">{(p.over_25_prob * 100).toFixed(1)}%</span></span>
                      <span>BTTS Yes: <span className="text-foreground font-semibold">{(p.btts_yes_prob * 100).toFixed(1)}%</span></span>
                      <span>Draw: <span className="text-foreground font-semibold">{(p.draw_prob * 100).toFixed(1)}%</span></span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
