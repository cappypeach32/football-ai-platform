"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { EspnLiveMatch } from "@/types";

const WS_URL = (process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000");
const REST_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000");
const RECONNECT_DELAY = 5_000;
const REST_FALLBACK_INTERVAL = 30_000;

export type WsStatus = "connecting" | "open" | "closed";

export function useEspnLive() {
  const [matches, setMatches] = useState<EspnLiveMatch[]>([]);
  const [wsStatus, setWsStatus] = useState<WsStatus>("connecting");
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();
  const pollTimer = useRef<ReturnType<typeof setInterval>>();
  const usingWs = useRef(false);

  // ── REST fallback ─────────────────────────────────────────────────────────
  const fetchRest = useCallback(async () => {
    try {
      const r = await fetch(`${REST_URL}/api/v1/live/matches`);
      if (!r.ok) return;
      const data = await r.json();
      setMatches(data.live_matches ?? []);
    } catch { /* ignore */ }
  }, []);

  const startRestFallback = useCallback(() => {
    if (pollTimer.current) return; // already running
    fetchRest();
    pollTimer.current = setInterval(fetchRest, REST_FALLBACK_INTERVAL);
  }, [fetchRest]);

  const stopRestFallback = useCallback(() => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = undefined;
    }
  }, []);

  // ── WebSocket ─────────────────────────────────────────────────────────────
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setWsStatus("connecting");
    const ws = new WebSocket(`${WS_URL}/ws/global`);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsStatus("open");
      usingWs.current = true;
      stopRestFallback(); // WS is working — stop polling
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string);

        if (msg.type === "live_state") {
          // Initial snapshot sent on connect
          setMatches(msg.matches ?? []);
        } else if (msg.type === "match_update") {
          // Incremental update for one match
          setMatches((prev) => {
            const idx = prev.findIndex((m) => m.match_external_id === msg.match_external_id);
            if (idx === -1) return [...prev, msg as EspnLiveMatch];
            const next = [...prev];
            next[idx] = { ...next[idx], ...msg };
            return next;
          });
        } else if (msg.type === "match_finished") {
          setMatches((prev) => prev.filter((m) => m.match_external_id !== msg.match_external_id));
        }
      } catch { /* ignore */ }
    };

    ws.onclose = () => {
      setWsStatus("closed");
      usingWs.current = false;
      // Fall back to REST polling while WS reconnects
      startRestFallback();
      reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY);
    };

    ws.onerror = () => ws.close();
  }, [startRestFallback, stopRestFallback]);

  useEffect(() => {
    // Start with REST immediately so there's no blank state while WS connects
    fetchRest();
    connect();

    return () => {
      clearTimeout(reconnectTimer.current);
      clearInterval(pollTimer.current);
      wsRef.current?.close();
    };
  }, [connect, fetchRest]);

  return { matches, wsStatus };
}
