"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Zap, X, AlertTriangle, Brain, TrendingUp, ChevronRight } from "lucide-react";
import { analyticsApi } from "@/lib/api";
import Link from "next/link";

interface Alert {
  id: string;
  type: "value" | "injury" | "model";
  priority: "high" | "medium" | "low";
  title: string;
  text: string;
  league: string;
  prediction_id: number | null;
}

const TYPE_CONFIG = {
  value:  { icon: Zap,           color: "text-neon-green",  bg: "bg-neon-green/10",  border: "border-neon-green/25" },
  injury: { icon: AlertTriangle, color: "text-amber-400",   bg: "bg-amber-400/10",   border: "border-amber-400/25" },
  model:  { icon: Brain,         color: "text-neon-purple", bg: "bg-neon-purple/10", border: "border-neon-purple/25" },
};

export function AIAlertsBanner() {
  const [dismissed, setDismissed] = useState<string[]>([]);

  const { data: alerts = [] } = useQuery<Alert[]>({
    queryKey: ["analytics", "alerts"],
    queryFn: () => analyticsApi.getAlerts().then((r) => r.data),
    refetchInterval: 5 * 60 * 1000,
    staleTime: 2 * 60 * 1000,
  });

  const visible = alerts.filter((a) => !dismissed.includes(a.id)).slice(0, 5);
  if (!visible.length) return null;

  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
      <div className="flex items-center gap-2 mb-1">
        <Zap className="w-3.5 h-3.5 text-neon-green" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">AI Alerts</span>
        <span className="text-[10px] bg-neon-green/20 text-neon-green px-1.5 py-0.5 rounded-full font-mono">{visible.length}</span>
      </div>
      <AnimatePresence>
        {visible.map((alert) => {
          const cfg = TYPE_CONFIG[alert.type];
          const Icon = cfg.icon;
          return (
            <motion.div
              key={alert.id}
              layout
              initial={{ opacity: 0, x: -10, height: 0 }}
              animate={{ opacity: 1, x: 0, height: "auto" }}
              exit={{ opacity: 0, x: 10, height: 0 }}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border ${cfg.bg} ${cfg.border}`}
            >
              <div className={`p-1 rounded-md ${cfg.bg} flex-shrink-0`}>
                <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <span className={`text-[10px] font-bold uppercase ${cfg.color} mr-2`}>{alert.title}</span>
                <span className="text-xs text-foreground">{alert.text}</span>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {alert.prediction_id && (
                  <Link
                    href={`/predictions/${alert.prediction_id}`}
                    className={`text-[10px] ${cfg.color} hover:underline flex items-center gap-0.5`}
                  >
                    View <ChevronRight className="w-3 h-3" />
                  </Link>
                )}
                <button
                  onClick={() => setDismissed((d) => [...d, alert.id])}
                  className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </motion.div>
  );
}

