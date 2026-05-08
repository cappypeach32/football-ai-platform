"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, Search, Shield, ShieldBan, ShieldCheck, Crown, User,
  ChevronLeft, ChevronRight, Check, X, AlertTriangle,
} from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

type Plan = "free" | "premium" | "vip";
type Role = "user" | "admin" | "moderator";

interface AdminUser {
  id: string;
  email: string;
  username: string;
  full_name: string | null;
  role: Role;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
  last_login: string | null;
  subscription: { plan: Plan; status: string; current_period_end: string | null };
}

const PLAN_COLORS: Record<Plan, string> = {
  free: "text-muted-foreground bg-surface-elevated",
  premium: "text-neon-blue bg-neon-blue/10 border border-neon-blue/20",
  vip: "text-amber-400 bg-amber-400/10 border border-amber-400/20",
};

const ROLE_COLORS: Record<Role, string> = {
  user: "text-muted-foreground",
  moderator: "text-neon-blue",
  admin: "text-neon-purple",
};

function PlanBadge({ plan }: { plan: Plan }) {
  return (
    <span className={cn("text-[10px] font-bold uppercase px-2 py-0.5 rounded-full", PLAN_COLORS[plan])}>
      {plan}
    </span>
  );
}

function RoleBadge({ role }: { role: Role }) {
  const Icon = role === "admin" ? Crown : role === "moderator" ? Shield : User;
  return (
    <span className={cn("flex items-center gap-1 text-[10px] font-semibold uppercase", ROLE_COLORS[role])}>
      <Icon className="w-3 h-3" />{role}
    </span>
  );
}

function OverrideModal({
  user,
  onClose,
}: {
  user: AdminUser;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [plan, setPlan] = useState<Plan>(user.subscription.plan);
  const [role, setRole] = useState<Role>(user.role);

  const subMutation = useMutation({
    mutationFn: () => adminApi.setSubscription(user.id, plan),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "users"] }); onClose(); },
  });
  const roleMutation = useMutation({
    mutationFn: () => adminApi.setRole(user.id, role),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "users"] }); onClose(); },
  });

  const saving = subMutation.isPending || roleMutation.isPending;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.92, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="glass-card w-full max-w-sm p-6 space-y-5"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Edit User</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>

        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">{user.username}</p>
          <p className="text-xs text-muted-foreground">{user.email}</p>
        </div>

        {/* Plan */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase text-muted-foreground">Subscription Plan</label>
          <div className="grid grid-cols-3 gap-2">
            {(["free", "premium", "vip"] as Plan[]).map((p) => (
              <button
                key={p}
                onClick={() => setPlan(p)}
                className={cn(
                  "py-1.5 rounded-lg text-xs font-semibold transition-all border",
                  plan === p ? PLAN_COLORS[p] + " border-current" : "text-muted-foreground border-surface-border hover:border-border"
                )}
              >
                {p.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Role */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase text-muted-foreground">Role</label>
          <div className="grid grid-cols-3 gap-2">
            {(["user", "moderator", "admin"] as Role[]).map((r) => (
              <button
                key={r}
                onClick={() => setRole(r)}
                className={cn(
                  "py-1.5 rounded-lg text-xs font-semibold transition-all border capitalize",
                  role === r ? ROLE_COLORS[r] + " border-current bg-surface-elevated" : "text-muted-foreground border-surface-border hover:border-border"
                )}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            onClick={() => { subMutation.mutate(); roleMutation.mutate(); }}
            disabled={saving}
            className="flex-1 py-2 bg-neon-green/20 hover:bg-neon-green/30 border border-neon-green/30 text-neon-green rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
          <button onClick={onClose} className="px-4 py-2 text-muted-foreground hover:text-foreground text-sm">Cancel</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function AdminUsersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState<"" | "true" | "false">("");
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const LIMIT = 20;

  const params: Record<string, unknown> = { limit: LIMIT, offset: page * LIMIT };
  if (search) params.search = search;
  if (planFilter) params.plan = planFilter;
  if (roleFilter) params.role = roleFilter;
  if (activeFilter) params.is_active = activeFilter === "true";

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "users", params],
    queryFn: () => adminApi.getUsers(params).then((r) => r.data as { total: number; users: AdminUser[] }),
  });

  const banMutation = useMutation({
    mutationFn: (id: string) => adminApi.banUser(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "users"] }),
  });
  const unbanMutation = useMutation({
    mutationFn: (id: string) => adminApi.unbanUser(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "users"] }),
  });

  const totalPages = data ? Math.ceil(data.total / LIMIT) : 0;

  return (
    <>
      <AnimatePresence>{editing && <OverrideModal user={editing} onClose={() => setEditing(null)} />}</AnimatePresence>

      <div className="space-y-5">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Users className="w-5 h-5 text-neon-blue" /> User Management
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {data ? `${data.total} users total` : "Loading…"}
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
              placeholder="Search email, username…"
              className="w-full bg-surface-elevated border border-surface-border rounded-lg pl-9 pr-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-neon-green/40 transition-colors"
            />
          </div>
          <select value={planFilter} onChange={(e) => { setPlanFilter(e.target.value); setPage(0); }} className="bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-neon-green/40">
            <option value="">All Plans</option>
            <option value="free">Free</option>
            <option value="premium">Premium</option>
            <option value="vip">VIP</option>
          </select>
          <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(0); }} className="bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-neon-green/40">
            <option value="">All Roles</option>
            <option value="user">User</option>
            <option value="moderator">Moderator</option>
            <option value="admin">Admin</option>
          </select>
          <select value={activeFilter} onChange={(e) => { setActiveFilter(e.target.value as "" | "true" | "false"); setPage(0); }} className="bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-neon-green/40">
            <option value="">All Status</option>
            <option value="true">Active</option>
            <option value="false">Banned</option>
          </select>
        </motion.div>

        {/* Table */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-surface-border">
                <tr className="text-left">
                  {["User", "Role", "Plan", "Status", "Joined", "Last Login", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-3 text-[10px] font-bold uppercase text-muted-foreground tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border/50">
                {isLoading
                  ? Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}><td colSpan={7} className="px-4 py-3"><Skeleton className="h-5 rounded" /></td></tr>
                  ))
                  : (data?.users ?? []).map((u) => (
                    <tr key={u.id} className={cn("hover:bg-surface-elevated/50 transition-colors", !u.is_active && "opacity-60")}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">{u.username}</p>
                        <p className="text-[11px] text-muted-foreground">{u.email}</p>
                      </td>
                      <td className="px-4 py-3"><RoleBadge role={u.role} /></td>
                      <td className="px-4 py-3"><PlanBadge plan={u.subscription.plan} /></td>
                      <td className="px-4 py-3">
                        {u.is_active
                          ? <span className="text-neon-green text-[10px] font-semibold flex items-center gap-1"><Check className="w-3 h-3" />Active</span>
                          : <span className="text-red-400 text-[10px] font-semibold flex items-center gap-1"><ShieldBan className="w-3 h-3" />Banned</span>}
                      </td>
                      <td className="px-4 py-3 text-[11px] text-muted-foreground font-mono">
                        {u.created_at ? format(new Date(u.created_at), "dd MMM yy") : "—"}
                      </td>
                      <td className="px-4 py-3 text-[11px] text-muted-foreground font-mono">
                        {u.last_login ? format(new Date(u.last_login), "dd MMM HH:mm") : "Never"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setEditing(u)}
                            className="text-[10px] px-2 py-1 rounded bg-neon-purple/10 text-neon-purple border border-neon-purple/20 hover:bg-neon-purple/20 transition-all"
                          >
                            Edit
                          </button>
                          {u.is_active ? (
                            <button
                              onClick={() => banMutation.mutate(u.id)}
                              disabled={banMutation.isPending}
                              className="text-[10px] px-2 py-1 rounded bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all disabled:opacity-50"
                            >
                              Ban
                            </button>
                          ) : (
                            <button
                              onClick={() => unbanMutation.mutate(u.id)}
                              disabled={unbanMutation.isPending}
                              className="text-[10px] px-2 py-1 rounded bg-neon-green/10 text-neon-green border border-neon-green/20 hover:bg-neon-green/20 transition-all disabled:opacity-50"
                            >
                              Unban
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
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
