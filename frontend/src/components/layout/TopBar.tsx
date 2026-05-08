"use client";

import { Bell, Search, User, Wifi } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { analyticsApi } from "@/lib/api";
import { useState } from "react";

export function TopBar() {
  const [showAlerts, setShowAlerts] = useState(false);

  const { data: alerts = [] } = useQuery<any[]>({
    queryKey: ["analytics", "alerts"],
    queryFn: () => analyticsApi.getAlerts().then((r) => r.data),
    refetchInterval: 5 * 60 * 1000,
    staleTime: 2 * 60 * 1000,
  });

  return (
    <header className="h-16 bg-surface-elevated border-b border-surface-border flex items-center justify-between px-6 gap-4 z-10">
      {/* Search */}
      <div className="relative max-w-md w-full hidden md:flex items-center">
        <Search className="absolute left-3 w-4 h-4 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          placeholder="Search teams, leagues, matches..."
          className="w-full bg-surface-card border border-surface-border rounded-lg pl-10 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-neon-green/50 transition-colors"
        />
        <kbd className="absolute right-3 text-[10px] text-muted-foreground bg-surface-border px-1.5 py-0.5 rounded">⌘K</kbd>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3 ml-auto">
        {/* Live indicator */}
        <motion.div
          animate={{ opacity: [1, 0.5, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="hidden sm:flex items-center gap-1.5 text-xs text-emerald-400"
        >
          <Wifi className="w-3.5 h-3.5" />
          <span>Live Feed Active</span>
        </motion.div>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setShowAlerts((v) => !v)}
            className="relative p-2 rounded-lg hover:bg-surface-card transition-colors text-muted-foreground hover:text-foreground"
          >
            <Bell className="w-5 h-5" />
            {alerts.length > 0 && (
              <motion.span
                key={alerts.length}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute top-1 right-1 min-w-[14px] h-[14px] bg-neon-green rounded-full flex items-center justify-center text-[9px] font-bold text-black px-0.5"
              >
                {alerts.length}
              </motion.span>
            )}
          </button>

          {/* Dropdown */}
          <AnimatePresence>
            {showAlerts && alerts.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.95 }}
                className="absolute right-0 top-full mt-2 w-80 bg-surface-elevated border border-surface-border rounded-xl shadow-2xl z-50 overflow-hidden"
              >
                <div className="px-4 py-3 border-b border-surface-border">
                  <p className="text-xs font-semibold text-foreground">AI Alerts</p>
                  <p className="text-[10px] text-muted-foreground">{alerts.length} active notifications</p>
                </div>
                <div className="max-h-72 overflow-y-auto divide-y divide-surface-border">
                  {alerts.slice(0, 6).map((a: any) => (
                    <div key={a.id} className="px-4 py-3 hover:bg-surface-card transition-colors">
                      <p className="text-xs font-semibold text-foreground">{a.title}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{a.text}</p>
                      <p className="text-[9px] text-muted-foreground/60 mt-1">{a.league}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Avatar */}
        <button className="flex items-center gap-2 p-1 pr-3 rounded-lg hover:bg-surface-card transition-colors">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-neon-purple to-neon-blue flex items-center justify-center">
            <User className="w-4 h-4 text-white" />
          </div>
          <div className="hidden sm:block text-left">
            <p className="text-xs font-medium text-foreground">Account</p>
            <p className="text-[10px] text-muted-foreground">Premium</p>
          </div>
        </button>
      </div>
    </header>
  );
}
