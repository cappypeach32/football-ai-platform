"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain, Search, Zap, CheckCircle2, XCircle, Clock,
  ChevronLeft, ChevronRight, X, AlertTriangle, Edit3,
} from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface AdminPrediction {
  id: number;
  match_date: string;
  home_team: string;
  away_team: string;
  league: string;
  home_win_prob: number;
  draw_prob: number;
  away_win_prob: number;
  confidence_score: number;
  recommended_bet: string | null;
  value_bet: boolean;
  result: string | null;
  is_correct: boolean | null;
  ai_summary: string | null;
  home_score: number | null;
  away_score: number | null;
}

const RESULT_STYLE: Record<string, string> = {
  win:     "text-neon-green bg-neon-green/10 border-neon-green/20",
  loss:    "text-red-400 bg-red-500/10 border-red-500/20",
  draw:    "text-amber-400 bg-amber-400/10 border-amber-400/20",
  pending: "text-muted-foreground bg-surface-elevated border-surface-border",
};

function OverrideModal({ pred, onClose }: { pred: AdminPrediction; onClose: () => void }) {
  const qc = useQueryClient();
  const [confidence, setConfidence] = useState(String(pred.confidence_score ?? ""));
  const [bet, setBet] = useState(pred.recommended_bet ?? "");
  const [valueBet, setValueBet] = useState(pred.value_bet);
  const [summary, setSummary] = useState(pred.ai_summary ?? "");

  const mutation = useMutation({
    mutationFn: () =>
      adminApi.overridePrediction(pred.id, {
        confidence_score: confidence ? parseFloat(confidence) : undefined,
        recommended_bet: bet || undefined,
        value_bet: valueBet,
        ai_summary: summary || undefined,
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "predictions"] }); onClose(); },
  });

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="glass-card w-full max-w-md p-6 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Edit3 className="w-4 h-4 text-neon-purple" /> Override Prediction #{pred.id}
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>

        <p className="text-xs text-muted-foreground">{pred.home_team} vs {pred.away_team}</p>

        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-muted-foreground">Confidence Score (0–100)</label>
            <input
              type="number" min={0} max={100} step={0.1}
              value={confidence}
              onChange={(e) => setConfidence(e.target.value)}
              className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-neon-green/40"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-muted-foreground">Recommended Bet</label>
            <select
              value={bet}
              onChange={(e) => setBet(e.target.value)}
              className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-neon-green/40"
            >
              <option value="">— Keep current —</option>
              <option value="1">Home Win (1)</option>
              <option value="X">Draw (X)</option>
              <option value="2">Away Win (2)</option>
              <option value="over_2.5">Over 2.5</option>
              <option value="under_2.5">Under 2.5</option>
              <option value="btts_yes">BTTS Yes</option>
              <option value="btts_no">BTTS No</option>
            </select>
          </div>

          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold uppercase text-muted-foreground">Value Bet</label>
            <button
              onClick={() => setValueBet((v) => !v)}
              className={cn("w-10 h-5 rounded-full transition-all relative", valueBet ? "bg-neon-green" : "bg-surface-border")}
            >
              <span className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all", valueBet ? "left-5" : "left-0.5")} />
            </button>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-muted-foreground">AI Summary Override</label>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={3}
              placeholder="Override AI analysis text…"
              className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-neon-green/40"
            />
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="flex-1 py-2 bg-neon-purple/20 hover:bg-neon-purple/30 border border-neon-purple/30 text-neon-purple rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
          >
            {mutation.isPending ? "Saving…" : "Apply Override"}
          </button>
          <button onClick={onClose} className="px-4 py-2 text-muted-foreground hover:text-foreground text-sm">Cancel</button>
        </div>

        {mutation.isError && (
          <p className="text-xs text-red-400 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Failed to override. Try again.
          </p>
        )}
      </motion.div>
    </motion.div>
  );
}

export default function AdminPredictionsPage() {
  const [search, setSearch] = useState("");
  const [resultFilter, setResultFilter] = useState("");
  const [valueBetFilter, setValueBetFilter] = useState<"" | "true" | "false">("");
  const [minConf, setMinConf] = useState(0);
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<AdminPrediction | null>(null);
  const LIMIT = 25;

  const params: Record<string, unknown> = { limit: LIMIT, offset: page * LIMIT };
  if (search) params.search = search;
  if (resultFilter) params.result = resultFilter;
  if (valueBetFilter) params.value_bet = valueBetFilter === "true";
  if (minConf > 0) params.min_confidence = minConf;

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "predictions", params],
    queryFn: () => adminApi.getPredictions(params).then((r) => r.data as { total: number; predictions: AdminPrediction[] }),
  });

  const totalPages = data ? Math.ceil(data.total / LIMIT) : 0;

  return (
    <>
      <AnimatePresence>{editing && <OverrideModal pred={editing} onClose={() => setEditing(null)} />}</AnimatePresence>

      <div className="space-y-5">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Brain className="w-5 h-5 text-neon-purple" /> Prediction Monitor
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {data ? `${data.total} predictions` : "Loading…"} — override AI outputs
            </p>
          </div>
        </motion.div>

        {/* Filters */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              placeholder="Team or league…"
              className="w-full bg-surface-elevated border border-surface-border rounded-lg pl-9 pr-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-neon-green/40"
            />
          </div>
          <select value={resultFilter} onChange={(e) => { setResultFilter(e.target.value); setPage(0); }} className="bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-neon-green/40">
            <option value="">All Results</option>
            <option value="win">Win</option>
            <option value="loss">Loss</option>
            <option value="draw">Draw</option>
            <option value="pending">Pending</option>
          </select>
          <select value={valueBetFilter} onChange={(e) => { setValueBetFilter(e.target.value as "" | "true" | "false"); setPage(0); }} className="bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-neon-green/40">
            <option value="">All Bets</option>
            <option value="true">Value Bets Only</option>
            <option value="false">Non-Value</option>
          </select>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground whitespace-nowrap">Min conf:</label>
            <input
              type="number" min={0} max={100} step={5}
              value={minConf}
              onChange={(e) => { setMinConf(Number(e.target.value)); setPage(0); }}
              className="w-20 bg-surface-elevated border border-surface-border rounded-lg px-2 py-2 text-sm focus:outline-none focus:border-neon-green/40"
            />
          </div>
        </motion.div>

        {/* Table */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-surface-border">
                <tr>
                  {["Match", "League", "Date", "Probs", "Confidence", "Bet", "Value", "Result", "Score", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase text-muted-foreground tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border/50">
                {isLoading
                  ? Array.from({ length: 10 }).map((_, i) => (
                    <tr key={i}><td colSpan={10} className="px-4 py-3"><Skeleton className="h-5 rounded" /></td></tr>
                  ))
                  : (data?.predictions ?? []).map((p) => {
                    const resultKey = p.result ?? "pending";
                    return (
                      <tr key={p.id} className="hover:bg-surface-elevated/50 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-medium text-foreground text-xs">{p.home_team}</p>
                          <p className="text-[10px] text-muted-foreground">vs {p.away_team}</p>
                        </td>
                        <td className="px-4 py-3 text-[11px] text-muted-foreground">{p.league}</td>
                        <td className="px-4 py-3 text-[11px] text-muted-foreground font-mono">
                          {format(new Date(p.match_date), "dd MMM HH:mm")}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-[10px] font-mono space-y-0.5">
                            <p><span className="text-neon-green">{(p.home_win_prob * 100).toFixed(0)}%</span> H</p>
                            <p><span className="text-amber-400">{(p.draw_prob * 100).toFixed(0)}%</span> D</p>
                            <p><span className="text-neon-blue">{(p.away_win_prob * 100).toFixed(0)}%</span> A</p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn("text-xs font-mono font-bold",
                            (p.confidence_score ?? 0) >= 70 ? "text-neon-green" :
                            (p.confidence_score ?? 0) >= 55 ? "text-amber-400" : "text-muted-foreground"
                          )}>
                            {p.confidence_score?.toFixed(1) ?? "—"}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[11px] font-mono text-foreground">{p.recommended_bet ?? "—"}</td>
                        <td className="px-4 py-3">
                          {p.value_bet && <Zap className="w-3.5 h-3.5 text-neon-green" />}
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn("text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border", RESULT_STYLE[resultKey])}>
                            {resultKey}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs font-mono text-foreground">
                          {p.home_score !== null ? `${p.home_score}–${p.away_score}` : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setEditing(p)}
                            className="text-[10px] px-2 py-1 rounded bg-neon-purple/10 text-neon-purple border border-neon-purple/20 hover:bg-neon-purple/20 transition-all flex items-center gap-1"
                          >
                            <Edit3 className="w-2.5 h-2.5" /> Override
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-surface-border">
              <p className="text-xs text-muted-foreground">Page {page + 1} of {totalPages}</p>
              <div className="flex gap-1">
                <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="p-1 rounded hover:bg-surface-elevated disabled:opacity-30 text-muted-foreground">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="p-1 rounded hover:bg-surface-elevated disabled:opacity-30 text-muted-foreground">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </>
  );
}
