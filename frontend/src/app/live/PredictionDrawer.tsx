"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { predictionsApi, matchesApi } from "@/lib/api";
import { Skeleton } from "@/components/ui/Skeleton";
import { TeamLogo } from "@/components/ui/TeamLogo";
import type { EspnLiveMatch, Prediction, LineupPlayer, TeamLineup } from "@/types";
import { X, Brain, TrendingUp, AlertTriangle, ExternalLink, Users, ChevronDown, ChevronUp, User } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

function ProbBar({ label, prob, color }: { label: string; prob: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground w-10 shrink-0 text-right">{label}</span>
      <div className="flex-1 h-1.5 bg-surface-elevated rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${prob * 100}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className={cn("h-full rounded-full", color)}
        />
      </div>
      <span className="text-xs font-mono font-semibold text-foreground w-11 shrink-0">
        {(prob * 100).toFixed(1)}%
      </span>
    </div>
  );
}

function PlayerRow({ player }: { player: LineupPlayer }) {
  const [imgFailed, setImgFailed] = useState(false);
  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-surface-border/40 last:border-0">
      {/* Photo */}
      <div className="w-7 h-7 rounded-full bg-surface-elevated flex-shrink-0 overflow-hidden flex items-center justify-center">
        {player.photo_url && !imgFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={player.photo_url}
            alt={player.name}
            className="w-full h-full object-cover"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <User className="w-3.5 h-3.5 text-muted-foreground" />
        )}
      </div>
      {/* Jersey */}
      <span className="text-[11px] font-mono text-muted-foreground w-5 text-center flex-shrink-0">
        {player.jersey}
      </span>
      {/* Name */}
      <span className="flex-1 text-xs text-foreground truncate">{player.name}</span>
      {/* Position */}
      <span className="text-[10px] font-bold text-muted-foreground bg-surface-elevated px-1.5 py-0.5 rounded flex-shrink-0">
        {player.position}
      </span>
    </div>
  );
}

function TeamLineupColumn({ side, lineup }: { side: "home" | "away"; lineup: TeamLineup }) {
  const [showBench, setShowBench] = useState(false);
  return (
    <div className="flex-1 min-w-0">
      <div className="text-center mb-2">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
          {side === "home" ? "Home" : "Away"}
        </span>
        {lineup.formation && (
          <div className="mt-0.5 inline-flex items-center gap-1 bg-neon-green/10 border border-neon-green/25 rounded px-2 py-0.5">
            <span className="text-[11px] font-bold text-neon-green font-mono">{lineup.formation}</span>
          </div>
        )}
      </div>
      <div>
        {lineup.starters.map((p, i) => (
          <PlayerRow key={i} player={p} />
        ))}
      </div>
      {lineup.bench.length > 0 && (
        <button
          onClick={() => setShowBench((v) => !v)}
          className="flex items-center gap-1 mt-2 text-[10px] text-muted-foreground hover:text-foreground transition-colors w-full"
        >
          {showBench ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {showBench ? "Hide bench" : `Bench (${lineup.bench.length})`}
        </button>
      )}
      {showBench && (
        <div className="mt-1 border-t border-dashed border-surface-border pt-1">
          {lineup.bench.map((p, i) => (
            <PlayerRow key={i} player={p} />
          ))}
        </div>
      )}
    </div>
  );
}

export function PredictionDrawer({
  match,
  onClose,
}: {
  match: EspnLiveMatch;
  onClose: () => void;
}) {
  const [showLineups, setShowLineups] = useState(true);

  const { data: homeResults, isLoading: loadingHome } = useQuery({
    queryKey: ["pred-by-team", match.home_team, "live"],
    queryFn: () =>
      predictionsApi.getByTeam(match.home_team, 20, false).then((r) => r.data as Prediction[]),
  });
  const { data: awayResults, isLoading: loadingAway } = useQuery({
    queryKey: ["pred-by-team", match.away_team, "live"],
    queryFn: () =>
      predictionsApi.getByTeam(match.away_team, 20, false).then((r) => r.data as Prediction[]),
    enabled: !homeResults?.length,
  });

  // Lineup query
  const { data: lineupData, isLoading: loadingLineup } = useQuery({
    queryKey: ["lineup", match.league_slug, match.match_external_id],
    queryFn: () =>
      matchesApi.getLineup(match.league_slug, match.match_external_id).then((r) => r.data),
    staleTime: 3 * 60 * 1000,
    retry: false,
  });

  const isLoading = loadingHome || loadingAway;
  const allCandidates = [...(homeResults ?? []), ...(awayResults ?? [])];

  // Match ESPN team names against DB team names via token overlap
  function teamMatches(espnName: string, dbName: string): boolean {
    const esp = espnName.toLowerCase().replace(/[^a-z0-9 ]/g, "");
    const db  = dbName.toLowerCase().replace(/[^a-z0-9 ]/g, "");
    if (esp === db || esp.includes(db) || db.includes(esp)) return true;
    // Token overlap: at least one significant word in common
    const STOP = new Set(["fc", "cf", "sc", "ac", "united", "city", "the"]);
    const espTokens = esp.split(" ").filter((t) => t.length > 2 && !STOP.has(t));
    const dbTokens  = db.split(" ").filter((t) => t.length > 2 && !STOP.has(t));
    return espTokens.some((t) => dbTokens.includes(t));
  }

  const basePred =
    allCandidates.find(
      (p) =>
        teamMatches(match.home_team, p.match.home_team.name) &&
        teamMatches(match.away_team, p.match.away_team.name)
    ) ??
    // Fallback: any candidate containing the home team name
    allCandidates.find(
      (p) =>
        teamMatches(match.home_team, p.match.home_team.name) ||
        teamMatches(match.away_team, p.match.away_team.name)
    ) ??
    null;

  const { data: preMatchData, isFetching: fetchingRich } = useQuery({
    queryKey: ["pre-match", basePred?.id],
    queryFn: () =>
      predictionsApi
        .getPreMatch(basePred!.id)
        .then((r) => r.data as { prediction: Prediction }),
    enabled: !!basePred?.id,
    staleTime: 5 * 60 * 1000,
  });

  const richPred = preMatchData?.prediction;
  const pred = basePred
    ? {
        ...basePred,
        ai_summary: richPred?.ai_summary ?? basePred.ai_summary,
        tactical_notes: richPred?.tactical_notes ?? basePred.tactical_notes,
        key_factors: richPred?.key_factors ?? basePred.key_factors,
        home_xg: richPred?.home_xg ?? basePred.home_xg,
        away_xg: richPred?.away_xg ?? basePred.away_xg,
        confidence_score: richPred?.confidence_score ?? basePred.confidence_score,
      }
    : null;

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
      />

      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 26, stiffness: 280 }}
        className="fixed top-0 right-0 h-full w-full max-w-md bg-surface-card border-l border-surface-border z-50 flex flex-col shadow-2xl overflow-y-auto"
      >
        {/* Header: live score */}
        <div className="sticky top-0 bg-surface-card/95 backdrop-blur-md border-b border-surface-border p-4 z-10">
          <div className="flex items-start justify-between gap-2 mb-4">
            <div>
              <span className="text-[11px] text-muted-foreground">{match.league_name}</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <motion.div
                  animate={{ opacity: [1, 0.2, 1] }}
                  transition={{ duration: 1.2, repeat: Infinity }}
                  className="w-2 h-2 rounded-full bg-red-500"
                />
                <span className="text-xs font-bold text-red-400 font-mono">{match.clock}</span>
                <span className="text-xs text-muted-foreground">
                  · {match.status_name.replace(/^STATUS_/, "").replace(/_/g, " ")}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-surface-elevated transition-colors text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Teams + score */}
          <div className="flex items-center gap-3">
            <div className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
              {match.home_logo ? (
                <TeamLogo src={match.home_logo} name={match.home_team} className="w-12 h-12" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-surface-elevated" />
              )}
              <span className="text-sm font-semibold text-center leading-tight">{match.home_team}</span>
            </div>

            <div className="shrink-0 text-center px-2">
              <div className="text-4xl font-bold font-mono text-neon-green tabular-nums">
                {match.home_score}
                <span className="text-muted-foreground mx-2">-</span>
                {match.away_score}
              </div>
            </div>

            <div className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
              {match.away_logo ? (
                <TeamLogo src={match.away_logo} name={match.away_team} className="w-12 h-12" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-surface-elevated" />
              )}
              <span className="text-sm font-semibold text-center leading-tight">{match.away_team}</span>
            </div>
          </div>
        </div>

        {/* Prediction content */}
        <div className="flex-1 p-4 space-y-5">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-neon-green" />
            <h3 className="text-sm font-semibold text-foreground">AI Prediction</h3>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-6 rounded" />)}
            </div>
          ) : !pred ? (
            <div className="glass-card p-6 text-center space-y-2">
              <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto" />
              <p className="text-sm text-foreground font-medium">No prediction found</p>
              <p className="text-xs text-muted-foreground">
                This match isn&apos;t in our database yet.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Confidence */}
              <div className="glass-card p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Confidence</p>
                  <p className="text-2xl font-bold text-neon-green">
                    {pred.confidence_score.toFixed(0)}
                    <span className="text-sm font-normal text-muted-foreground ml-0.5">%</span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground mb-0.5">Recommended Bet</p>
                  <span className="px-3 py-1.5 rounded-lg bg-neon-green/15 border border-neon-green/30 text-neon-green font-bold text-sm">
                    {pred.recommended_bet === "1"
                      ? `${pred.match.home_team.name} wins`
                      : pred.recommended_bet === "2"
                      ? `${pred.match.away_team.name} wins`
                      : "Draw"}
                  </span>
                </div>
              </div>

              {/* Win probabilities */}
              <div className="glass-card p-4 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Win Probabilities
                </p>
                <ProbBar label="1" prob={pred.home_win_prob} color="bg-neon-green" />
                <ProbBar label="X" prob={pred.draw_prob} color="bg-amber-400" />
                <ProbBar label="2" prob={pred.away_win_prob} color="bg-red-500" />
              </div>

              {/* Over/BTTS/xG grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="glass-card p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Over 2.5</p>
                  <p className="text-xl font-bold text-foreground font-mono">
                    {(pred.over_25_prob * 100).toFixed(0)}%
                  </p>
                </div>
                <div className="glass-card p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">BTTS</p>
                  <p className="text-xl font-bold text-foreground font-mono">
                    {(pred.btts_yes_prob * 100).toFixed(0)}%
                  </p>
                </div>
                <div className="glass-card p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Home xG</p>
                  <p className="text-xl font-bold text-neon-green font-mono">{pred.home_xg.toFixed(2)}</p>
                </div>
                <div className="glass-card p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Away xG</p>
                  <p className="text-xl font-bold text-red-400 font-mono">{pred.away_xg.toFixed(2)}</p>
                </div>
              </div>

              {/* AI summary */}
              {pred.ai_summary && (
                <div className="glass-card p-4 space-y-2">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-3.5 h-3.5 text-neon-green" />
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      AI Summary
                    </p>
                    {fetchingRich && !richPred && (
                      <motion.span
                        animate={{ opacity: [1, 0.3, 1] }}
                        transition={{ duration: 1.2, repeat: Infinity }}
                        className="ml-auto text-[10px] text-neon-green/60"
                      >
                        Enriching...
                      </motion.span>
                    )}
                  </div>
                  <p className="text-sm text-foreground/90 leading-relaxed">{pred.ai_summary}</p>
                </div>
              )}

              {/* Key factors */}
              {pred.key_factors && pred.key_factors.length > 0 && (
                <div className="glass-card p-4 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Key Factors
                  </p>
                  {pred.key_factors.slice(0, 4).map((f, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-neon-green mt-1.5 shrink-0" />
                      <p className="text-xs text-foreground/80">{f}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Full analysis link */}
              <Link
                href={`/predictions/${pred.id}`}
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-neon-green/15 border border-neon-green/30 text-neon-green text-sm font-semibold hover:bg-neon-green/25 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Full Analysis
              </Link>
            </div>
          )}

          {/* ── Starting Lineups ── */}
          <div className="glass-card overflow-hidden">
            <button
              onClick={() => setShowLineups((v) => !v)}
              className="flex items-center justify-between w-full p-4 hover:bg-surface-elevated/30 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-neon-green" />
                <span className="text-sm font-semibold text-foreground">Starting Lineups</span>
              </div>
              {showLineups ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              )}
            </button>

            {showLineups && (
              <div className="px-4 pb-4">
                {loadingLineup ? (
                  <div className="space-y-2">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Skeleton key={i} className="h-8 rounded" />
                    ))}
                  </div>
                ) : !lineupData?.home && !lineupData?.away ? (
                  <div className="text-center py-4 space-y-1">
                    <Users className="w-6 h-6 text-muted-foreground mx-auto" />
                    <p className="text-xs text-muted-foreground">
                      Lineups not yet announced
                    </p>
                    <p className="text-[10px] text-muted-foreground/60">
                      Usually confirmed ~60 min before kickoff
                    </p>
                  </div>
                ) : (
                  <div className="flex gap-4">
                    {lineupData?.home && (
                      <TeamLineupColumn side="home" lineup={lineupData.home} />
                    )}
                    {lineupData?.home && lineupData?.away && (
                      <div className="w-px bg-surface-border flex-shrink-0" />
                    )}
                    {lineupData?.away && (
                      <TeamLineupColumn side="away" lineup={lineupData.away} />
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </>
  );
}
