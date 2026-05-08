"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { matchesApi } from "@/lib/api";
import { useEspnLive } from "@/hooks/useEspnLive";
import { Skeleton } from "@/components/ui/Skeleton";
import { TeamLogo } from "@/components/ui/TeamLogo";
import type { Match, EspnLiveMatch } from "@/types";
import {
  ChevronLeft, ChevronRight, Calendar, Wifi, WifiOff, Radio, Maximize2, Minimize2,
} from "lucide-react";
import { format, addDays, subDays, isToday } from "date-fns";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useFocusMode } from "@/context/FocusModeContext";

// Lazy-loaded: only fetched when user opens a drawer
const PredictionDrawer = dynamic(
  () => import("./PredictionDrawer").then((m) => ({ default: m.PredictionDrawer })),
  { ssr: false }
);


// ─── ESPN Live Card ─────────────────────────────────────────────────────────

function EspnLiveCard({
  match,
  onSelect,
}: {
  match: EspnLiveMatch;
  onSelect: (m: EspnLiveMatch) => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      onClick={() => onSelect(match)}
      className="glass-card p-4 border border-red-500/20 hover:border-red-500/50 hover:scale-[1.02] transition-all cursor-pointer min-w-[260px] active:scale-[0.98]"
    >
      {/* League + clock */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-medium text-muted-foreground truncate max-w-[160px]">
          {match.league_name}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          <motion.div
            animate={{ opacity: [1, 0.2, 1] }}
            transition={{ duration: 1.2, repeat: Infinity }}
            className="w-2 h-2 rounded-full bg-red-500"
          />
          <span className="text-xs font-bold text-red-400 font-mono">{match.clock}</span>
        </div>
      </div>

      {/* Teams + score */}
      <div className="flex items-center gap-2">
        {/* Home */}
        <div className="flex-1 flex flex-col items-center gap-1 min-w-0">
          {match.home_logo ? (
            <TeamLogo src={match.home_logo} name={match.home_team} className="w-10 h-10" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-surface-elevated" />
          )}
          <span className="text-xs font-medium text-center leading-tight line-clamp-2">
            {match.home_team}
          </span>
        </div>

        {/* Score */}
        <div className="shrink-0 text-center px-1">
          <div className="text-3xl font-bold font-mono text-neon-green tabular-nums leading-none">
            {match.home_score}
            <span className="text-muted-foreground mx-1 text-2xl">-</span>
            {match.away_score}
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">{match.status_name.replace(/^STATUS_/, "").replace(/_/g, " ")}</div>
        </div>

        {/* Away */}
        <div className="flex-1 flex flex-col items-center gap-1 min-w-0">
          {match.away_logo ? (
            <TeamLogo src={match.away_logo} name={match.away_team} className="w-10 h-10" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-surface-elevated" />
          )}
          <span className="text-xs font-medium text-center leading-tight line-clamp-2">
            {match.away_team}
          </span>
        </div>
      </div>

      {match.venue && (
        <p className="mt-3 text-[10px] text-muted-foreground text-center truncate">
          {match.venue}
        </p>
      )}

      <p className="text-[10px] text-muted-foreground/50 text-center mt-2">Tap for prediction →</p>
    </motion.div>
  );
}

// ─── DB Match Row ────────────────────────────────────────────────────────────

function MatchRow({ match }: { match: Match }) {
  const isLive = match.status === "live";
  const isFinished = match.status === "finished";
  const isScheduled = match.status === "scheduled";

  const timeStr = format(new Date(match.match_date), "HH:mm");

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-surface-elevated rounded-lg transition-colors cursor-pointer group">
      {/* Time / Status */}
      <div className="w-14 text-center shrink-0">
        {isLive ? (
          <span className="text-red-400 font-bold text-sm font-mono animate-pulse">
            {match.minute ?? 0}&apos;
          </span>
        ) : isFinished ? (
          <span className="text-muted-foreground text-xs">FT</span>
        ) : (
          <span className="text-muted-foreground text-sm font-mono">{timeStr}</span>
        )}
      </div>

      {/* Home team */}
      <div className="flex-1 flex items-center justify-end gap-2">
        {match.home_team.logo_url && (
          <TeamLogo src={match.home_team.logo_url} name={match.home_team.name} className="w-5 h-5" />
        )}
        <span className={`text-sm font-medium ${isLive ? "text-foreground" : "text-foreground/80"}`}>
          {match.home_team.name}
        </span>
      </div>

      {/* Score */}
      <div className="w-20 text-center shrink-0">
        {isScheduled ? (
          <span className="text-muted-foreground text-sm font-mono">vs</span>
        ) : (
          <span className={`font-bold font-mono text-lg ${isLive ? "text-neon-green" : "text-foreground"}`}>
            {match.home_score ?? 0} – {match.away_score ?? 0}
          </span>
        )}
      </div>

      {/* Away team */}
      <div className="flex-1 flex items-center justify-start gap-2">
        {match.away_team.logo_url && (
          <TeamLogo src={match.away_team.logo_url} name={match.away_team.name} className="w-5 h-5" />
        )}
        <span className={`text-sm font-medium ${isLive ? "text-foreground" : "text-foreground/80"}`}>
          {match.away_team.name}
        </span>
      </div>

      {/* Live indicator */}
      <div className="w-10 text-right shrink-0">
        {isLive && <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function LivePage() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedMatch, setSelectedMatch] = useState<EspnLiveMatch | null>(null);
  const { isFocused, toggle: toggleFocus } = useFocusMode();

  const dateParam = format(selectedDate, "yyyy-MM-dd");
  const isTodaySelected = isToday(selectedDate);

  // ESPN live matches — WebSocket with REST fallback
  const { matches: liveMatches, wsStatus } = useEspnLive();
  const espnLoading = liveMatches.length === 0 && wsStatus === "connecting";

  // DB schedule for selected date
  const { data: dbMatches, isLoading: dbLoading, refetch } = useQuery({
    queryKey: ["matches", "day", dateParam],
    queryFn: () =>
      matchesApi
        .getAll({ date_from: dateParam, date_to: dateParam, limit: 100 })
        .then((r) => r.data as Match[]),
    refetchInterval: isTodaySelected ? 60_000 : false,
  });

  // Group DB matches by league
  const byLeague = (dbMatches ?? []).reduce<
    Record<string, { league: Match["league"]; matches: Match[] }>
  >((acc, m) => {
    const key = String(m.league.id);
    if (!acc[key]) acc[key] = { league: m.league, matches: [] };
    acc[key].matches.push(m);
    return acc;
  }, {});

  return (
    <>
      <div className={cn("space-y-6 transition-all duration-300", isFocused && "p-6")}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              {liveMatches.length > 0 && (
                <motion.div
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="w-3 h-3 rounded-full bg-red-500"
                />
              )}
              Live
              {liveMatches.length > 0 && (
                <span className="text-sm font-normal text-red-400 ml-1">
                  · {liveMatches.length} ongoing
                </span>
              )}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isTodaySelected ? "Today's matches" : format(selectedDate, "EEEE, d MMMM yyyy")}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs">
              {wsStatus === "open" ? (
                <><Radio className="w-3.5 h-3.5 text-neon-green animate-pulse" />
                <span className="text-neon-green font-medium">Live</span></>
              ) : wsStatus === "connecting" ? (
                <><Wifi className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-amber-400">Connecting…</span></>
              ) : (
                <><WifiOff className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Polling</span></>
              )}
            </div>
            <button
              onClick={() => refetch()}
              className="px-3 py-1.5 rounded-lg bg-surface-card border border-surface-border text-sm text-muted-foreground hover:text-foreground hover:border-neon-green/30 transition-all"
            >
              Refresh
            </button>
            <button
              onClick={toggleFocus}
              className={cn(
                "p-1.5 rounded-lg border transition-all duration-200",
                isFocused
                  ? "bg-neon-green/10 border-neon-green/30 text-neon-green"
                  : "bg-surface-card border-surface-border text-muted-foreground hover:text-foreground hover:border-neon-green/30"
              )}
              title={isFocused ? "Exit Focus Mode" : "Focus Mode"}
            >
              {isFocused
                ? <Minimize2 className="w-4 h-4" />
                : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </motion.div>

        {/* ── ESPN Live Now ──────────────────────────────────────────────── */}
        {isTodaySelected && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
              <div className="w-1 h-5 rounded-full bg-red-500" />
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
                Live Now
              </h2>
              <span className="text-xs text-muted-foreground ml-auto">
                {liveMatches.length} match{liveMatches.length !== 1 ? "es" : ""}
              </span>
            </div>

            {espnLoading ? (
              <div className="flex gap-4 overflow-x-auto pb-1">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-44 min-w-[260px] rounded-xl shrink-0" />
                ))}
              </div>
            ) : liveMatches.length === 0 ? (
              <div className="glass-card p-8 flex flex-col items-center gap-3 text-center">
                <WifiOff className="w-8 h-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No live matches right now</p>
                <p className="text-xs text-muted-foreground/60">
                  Refreshes automatically every 30 seconds
                </p>
              </div>
            ) : (
              <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                <AnimatePresence mode="popLayout">
                  {liveMatches.map((m) => (
                    <div key={m.match_external_id} className="shrink-0">
                      <EspnLiveCard match={m} onSelect={setSelectedMatch} />
                    </div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        )}

        {/* ── Date navigator ─────────────────────────────────────────────── */}
        <div className="glass-card p-3 flex items-center justify-between gap-2">
          <button
            onClick={() => setSelectedDate((d) => subDays(d, 1))}
            className="p-2 rounded-lg hover:bg-surface-elevated transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          </button>

          <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide">
            {[-3, -2, -1, 0, 1, 2, 3].map((offset) => {
              const d =
                offset === 0
                  ? new Date()
                  : offset < 0
                  ? subDays(new Date(), -offset)
                  : addDays(new Date(), offset);
              const active = format(d, "yyyy-MM-dd") === format(selectedDate, "yyyy-MM-dd");
              return (
                <button
                  key={offset}
                  onClick={() => setSelectedDate(d)}
                  className={`flex flex-col items-center px-3 py-2 rounded-lg transition-all shrink-0 ${
                    active
                      ? "bg-neon-green/20 text-neon-green border border-neon-green/40"
                      : "hover:bg-surface-elevated text-muted-foreground"
                  }`}
                >
                  <span className="text-[10px] uppercase font-medium">
                    {offset === 0 ? "Today" : format(d, "EEE")}
                  </span>
                  <span className="text-lg font-bold leading-none">{format(d, "d")}</span>
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setSelectedDate((d) => addDays(d, 1))}
            className="p-2 rounded-lg hover:bg-surface-elevated transition-colors"
          >
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* ── Schedule ───────────────────────────────────────────────────── */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-1 h-5 rounded-full bg-neon-green" />
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
              Schedule
            </h2>
          </div>

          {dbLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-40 rounded-xl" />
              ))}
            </div>
          ) : Object.keys(byLeague).length === 0 ? (
            <div className="glass-card p-16 text-center space-y-4">
              <Calendar className="w-12 h-12 text-muted-foreground mx-auto" />
              <p className="text-lg font-medium text-foreground">No matches in database</p>
              <p className="text-sm text-muted-foreground">
                No matches stored for {format(selectedDate, "d MMMM yyyy")}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.values(byLeague).map(({ league, matches: leagueMatches }) => (
                <motion.div
                  key={league.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass-card overflow-hidden"
                >
                  <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-border bg-surface-elevated">
                    {league.logo_url && (
                      <TeamLogo src={league.logo_url} name={league.name} className="w-5 h-5" />
                    )}
                    <div>
                      <span className="text-sm font-semibold text-foreground">{league.name}</span>
                      <span className="text-xs text-muted-foreground ml-2">{league.country}</span>
                    </div>
                  </div>

                  <div className="divide-y divide-surface-border/50">
                    {leagueMatches.map((match) => (
                      <MatchRow key={match.id} match={match} />
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Prediction Drawer ───────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedMatch && (
          <PredictionDrawer
            match={selectedMatch}
            onClose={() => setSelectedMatch(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

