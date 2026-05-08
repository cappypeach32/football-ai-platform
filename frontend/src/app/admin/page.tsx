"use client";

import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/lib/api";
import { motion } from "framer-motion";
import { Users, Brain, DollarSign, Activity, Shield, TrendingUp, CheckCircle2, XCircle, AlertTriangle, Zap, ServerCrash } from "lucide-react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/Skeleton";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
  icon: React.ElementType;
}

function StatCard({ label, value, sub, color = "text-neon-green", icon: Icon }: StatCardProps) {
  return (
    <motion.div variants={item} className="glass-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
        <div className={`p-2 rounded-lg bg-surface-elevated`}>
          <Icon className={`w-4 h-4 ${color}`} />
        </div>
      </div>
      <p className={`text-3xl font-bold font-mono ${color}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </motion.div>
  );
}

function HealthDot({ status }: { status: string }) {
  const ok = status === "ok";
  return (
    <span className={`flex items-center gap-1.5 text-xs font-medium ${ok ? "text-neon-green" : "text-red-400"}`}>
      {ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
      {status}
    </span>
  );
}

export default function AdminDashboard() {
  const { data: stats, isLoading, error } = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: () => adminApi.getStats().then((r) => r.data),
    refetchInterval: 60 * 1000,
    retry: false,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const errStatus = (error as any)?.response?.status;

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield className="w-6 h-6 text-neon-purple" />
            Admin <span className="gradient-text-green">Control Panel</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Platform health, users, revenue and AI monitoring</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/users" className="text-xs px-3 py-1.5 rounded-lg border border-neon-blue/30 text-neon-blue hover:bg-neon-blue/10 transition-all">
            Users →
          </Link>
          <Link href="/admin/predictions" className="text-xs px-3 py-1.5 rounded-lg border border-neon-purple/30 text-neon-purple hover:bg-neon-purple/10 transition-all">
            Predictions →
          </Link>
        </div>
      </motion.div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : stats ? (
        <>
          {/* Row 1: Users */}
          <div>
            <p className="text-xs font-bold uppercase text-muted-foreground mb-3 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" /> Users
            </p>
            <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Total Users" value={stats.users.total} color="text-neon-blue" icon={Users} />
              <StatCard label="Active" value={stats.users.active} sub={`${stats.users.banned} banned`} color="text-neon-green" icon={CheckCircle2} />
              <StatCard label="New (7d)" value={stats.users.new_last_7d} color="text-neon-purple" icon={TrendingUp} />
              <StatCard label="Admins" value={stats.users.admins} color="text-amber-400" icon={Shield} />
            </motion.div>
          </div>

          {/* Row 2: Revenue */}
          <div>
            <p className="text-xs font-bold uppercase text-muted-foreground mb-3 flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5" /> Revenue
            </p>
            <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="MRR Estimate" value={`$${stats.revenue.mrr_estimate.toFixed(0)}`} sub="Monthly recurring" color="text-neon-green" icon={DollarSign} />
              <StatCard label="Free Users" value={stats.revenue.free_users} color="text-muted-foreground" icon={Users} />
              <StatCard label="Premium" value={stats.revenue.premium_users} sub="$9.99/mo" color="text-neon-blue" icon={Zap} />
              <StatCard label="VIP" value={stats.revenue.vip_users} sub="$24.99/mo" color="text-amber-400" icon={Zap} />
            </motion.div>
          </div>

          {/* Row 3: Predictions */}
          <div>
            <p className="text-xs font-bold uppercase text-muted-foreground mb-3 flex items-center gap-1.5">
              <Brain className="w-3.5 h-3.5" /> AI Predictions
            </p>
            <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Total" value={stats.predictions.total} color="text-neon-blue" icon={Brain} />
              <StatCard label="Settled" value={stats.predictions.settled} sub={`${stats.predictions.pending} pending`} color="text-foreground" icon={CheckCircle2} />
              <StatCard label="Accuracy" value={`${stats.predictions.accuracy_pct}%`} color={stats.predictions.accuracy_pct >= 50 ? "text-neon-green" : "text-red-400"} icon={TrendingUp} />
              <StatCard label="Value Bets" value={stats.predictions.value_bets} color="text-neon-purple" icon={Zap} />
            </motion.div>
          </div>

          {/* Row 4: API Health */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-card p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-neon-green" /> API Health
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(stats.api_health as Record<string, string>).map(([key, status]) => (
                <div key={key} className="space-y-1">
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wide">{key.replace(/_/g, " ")}</p>
                  <HealthDot status={status} />
                </div>
              ))}
            </div>
          </motion.div>

          {/* Subscription distribution bar */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="glass-card p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">Subscription Distribution</h3>
            <div className="space-y-3">
              {([
                { key: "free", label: "Free", color: "bg-surface-border" },
                { key: "premium", label: "Premium", color: "bg-neon-blue" },
                { key: "vip", label: "VIP", color: "bg-amber-400" },
              ] as const).map(({ key, label, color }) => {
                const count = (stats.subscriptions as Record<string, number>)[key] ?? 0;
                const pct = stats.users.total ? (count / stats.users.total) * 100 : 0;
                return (
                  <div key={key} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-16">{label}</span>
                    <div className="flex-1 h-2 bg-surface-elevated rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.8, delay: 0.4 }}
                        className={`h-full rounded-full ${color}`}
                      />
                    </div>
                    <span className="text-xs font-mono text-foreground w-16 text-right">{count} ({pct.toFixed(0)}%)</span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </>
      ) : (
        <div className="glass-card p-12 text-center space-y-3">
          <ServerCrash className="w-10 h-10 text-red-400 mx-auto" />
          {errStatus === 403 ? (
            <>
              <p className="text-foreground font-semibold">Access Denied</p>
              <p className="text-muted-foreground text-sm">Your account does not have admin privileges.</p>
              <p className="text-xs text-muted-foreground">Log in as <code className="text-neon-green">admin@test.com</code> to access this panel.</p>
              <a href="/login" className="inline-block mt-2 text-xs px-4 py-1.5 rounded-lg border border-neon-green/30 text-neon-green hover:bg-neon-green/10 transition-all">
                Go to Login →
              </a>
            </>
          ) : errStatus === 401 ? (
            <>
              <p className="text-foreground font-semibold">Not Authenticated</p>
              <p className="text-muted-foreground text-sm">Please log in to continue.</p>
              <a href="/login" className="inline-block mt-2 text-xs px-4 py-1.5 rounded-lg border border-neon-green/30 text-neon-green hover:bg-neon-green/10 transition-all">
                Log In →
              </a>
            </>
          ) : (
            <>
              <p className="text-foreground font-semibold">Failed to load admin stats</p>
              <p className="text-muted-foreground text-sm">Backend may be unreachable. Check that the server is running on port 8000.</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
