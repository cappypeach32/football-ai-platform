"use client";

import { motion } from "framer-motion";
import { Brain, TrendingUp, AlertTriangle, Activity, Zap, Shield, Wind, BarChart2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Prediction } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  prediction: Prediction;
}

// ─── Factor icon mapping ──────────────────────────────────────────────────────

function factorIcon(text: string) {
  const t = text.toLowerCase();
  if (t.includes("elo"))           return { icon: BarChart2, color: "text-violet-400" };
  if (t.includes("xg") || t.includes("expected goal")) return { icon: Activity, color: "text-sky-400" };
  if (t.includes("form") || t.includes("ppg")) return { icon: TrendingUp, color: "text-neon-green" };
  if (t.includes("injur") || t.includes("missing")) return { icon: AlertTriangle, color: "text-orange-400" };
  if (t.includes("h2h") || t.includes("head")) return { icon: Shield, color: "text-amber-400" };
  if (t.includes("rain") || t.includes("cold") || t.includes("weather")) return { icon: Wind, color: "text-sky-300" };
  if (t.includes("goal") || t.includes("over") || t.includes("under")) return { icon: Zap, color: "text-emerald-400" };
  return { icon: Brain, color: "text-muted-foreground/60" };
}

// ─── Model agreement dots ─────────────────────────────────────────────────────

function AgreementDots({ agreement }: { agreement: number | null }) {
  if (agreement === null || agreement === undefined) return null;
  const colors = ["bg-muted-foreground/20", "bg-muted-foreground/20", "bg-muted-foreground/20"];
  for (let i = 0; i < agreement; i++) {
    colors[i] = agreement === 3 ? "bg-emerald-400" : agreement === 2 ? "bg-amber-400" : "bg-orange-400";
  }
  const label = agreement === 3 ? "All 3 models agree" : agreement === 2 ? "2 of 3 models agree" : "1 of 3 models agree";
  const labelColor = agreement === 3 ? "text-emerald-400" : agreement === 2 ? "text-amber-400" : "text-orange-400";
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1">
        {colors.map((c, i) => (
          <div key={i} className={cn("w-2 h-2 rounded-full", c)} />
        ))}
      </div>
      <span className={cn("text-[10px] font-semibold uppercase tracking-wider", labelColor)}>{label}</span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ModelTransparencyPanel({ prediction: p }: Props) {
  const factors = p.key_factors ?? [];
  if (factors.length === 0 && !p.model_agreement) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="rounded-2xl border border-white/6 bg-gradient-to-b from-[#0f0f12] to-[#0a0a0d] overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <Brain className="w-4 h-4 text-neon-green" />
          <h3 className="text-sm font-bold text-foreground tracking-tight">Model Transparency</h3>
        </div>
        <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/40">
          What drove this prediction
        </p>
      </div>

      <div className="px-6 py-5 space-y-5">
        {/* Model agreement */}
        {p.model_agreement !== null && p.model_agreement !== undefined && (
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/40 mb-2">
              Ensemble Consensus
            </p>
            <div className="flex items-center justify-between">
              <AgreementDots agreement={p.model_agreement} />
              <span className="text-[10px] text-muted-foreground/40">Poisson · ELO · XGBoost</span>
            </div>
          </div>
        )}

        {/* Influencing factors */}
        {factors.length > 0 && (
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/40 mb-3">
              Top Influencing Factors
            </p>
            <div className="space-y-2">
              {factors.map((factor, i) => {
                const { icon: Icon, color } = factorIcon(factor);
                const weight = Math.max(20, 100 - i * 18); // visual weight bar, strongest first
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 * i + 0.1, duration: 0.25 }}
                    className="flex items-start gap-3"
                  >
                    {/* Rank */}
                    <span className="text-[10px] font-black text-muted-foreground/25 w-4 pt-0.5 tabular-nums shrink-0">
                      {i + 1}
                    </span>
                    {/* Icon */}
                    <Icon className={cn("w-3.5 h-3.5 mt-0.5 shrink-0", color)} />
                    {/* Text + bar */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground/80 leading-snug">{factor}</p>
                      <div className="mt-1.5 h-0.5 bg-white/5 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${weight}%` }}
                          transition={{ delay: 0.1 * i + 0.2, duration: 0.5, ease: "easeOut" }}
                          className={cn("h-full rounded-full opacity-60", {
                            "bg-violet-400": color === "text-violet-400",
                            "bg-sky-400":    color === "text-sky-400",
                            "bg-emerald-400": color === "text-neon-green" || color === "text-emerald-400",
                            "bg-orange-400": color === "text-orange-400",
                            "bg-amber-400":  color === "text-amber-400",
                            "bg-sky-300":    color === "text-sky-300",
                            "bg-muted-foreground": color === "text-muted-foreground/60",
                          })}
                        />
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {/* Confidence + Risk + Category row */}
        <div className="grid grid-cols-3 gap-3 pt-1">
          <div className="rounded-xl bg-white/[0.025] px-4 py-3">
            <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/40 mb-1.5">
              Model Confidence
            </p>
            <p className={cn("text-xl font-black tabular-nums",
              p.confidence_score >= 65 ? "text-emerald-400" :
              p.confidence_score >= 50 ? "text-amber-400" :
              "text-orange-400"
            )}>
              {p.confidence_score?.toFixed(1)}%
            </p>
          </div>
          <div className="rounded-xl bg-white/[0.025] px-4 py-3">
            <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/40 mb-1.5">
              Model Risk
            </p>
            <p className={cn("text-xl font-black tabular-nums",
              p.risk_score >= 65 ? "text-red-400" :
              p.risk_score >= 45 ? "text-orange-400" :
              "text-emerald-400"
            )}>
              {p.risk_score?.toFixed(1)}%
            </p>
          </div>
          <div className="rounded-xl bg-white/[0.025] px-4 py-3">
            <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/40 mb-1.5">
              Risk Category
            </p>
            <p className={cn("text-sm font-black",
              p.risk_category === "Safe"       ? "text-emerald-400" :
              p.risk_category === "Balanced"   ? "text-sky-400" :
              p.risk_category === "Aggressive" ? "text-amber-400" :
                                                  "text-red-400"
            )}>
              {p.risk_category ?? "—"}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
