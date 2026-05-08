"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Brain,
  Activity,
  BarChart3,
  History,
  Trophy,
  Settings,
  Zap,
  ChevronLeft,
  ChevronRight,
  Shield,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/",           label: "Dashboard",    icon: LayoutDashboard },
  { href: "/predictions",label: "Predictions",  icon: Brain },
  { href: "/live",       label: "Live",         icon: Activity,  badge: "LIVE" },
  { href: "/analytics",  label: "Analytics",    icon: BarChart3 },
  { href: "/admin",      label: "Admin",        icon: Shield },
  { href: "/backtest",   label: "Backtest",     icon: History },
  { href: "/leagues",    label: "Leagues",      icon: Trophy },
  { href: "/settings",   label: "Settings",     icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <motion.aside
      animate={{ width: collapsed ? 72 : 240 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="relative flex flex-col bg-surface-elevated border-r border-surface-border overflow-hidden z-20"
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-surface-border">
        <div className="relative flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-neon-green to-neon-blue flex items-center justify-center"
             style={{ boxShadow: "0 0 16px rgba(0,255,135,0.35)" }}>
          <Zap className="w-5 h-5 text-surface" />
        </div>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="min-w-0"
          >
            <p className="text-sm font-bold text-foreground truncate font-display tracking-tight">Football AI</p>
            <p className="text-[10px] text-neon-green/60 truncate font-display uppercase tracking-widest">Intelligence</p>
          </motion.div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon, badge }) => {
          const active = pathname === href || (href !== "/" && pathname.startsWith(href));
          return (
            <Link key={href} href={href}>
              <motion.div
                whileHover={{ x: 3 }}
                whileTap={{ scale: 0.97 }}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 relative group",
                  active
                    ? "bg-neon-green/10 text-neon-green border border-neon-green/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-surface-card hover:border hover:border-surface-border"
                )}
              >
                <Icon className={cn(
                  "w-5 h-5 flex-shrink-0 transition-all duration-200",
                  active ? "text-neon-green" : "group-hover:text-neon-green/70"
                )} style={active ? { filter: "drop-shadow(0 0 4px rgba(0,255,135,0.5))" } : {}} />
                {!collapsed && (
                  <span className="truncate">{label}</span>
                )}
                {!collapsed && badge && (
                  <span className="live-badge ml-auto text-[10px] px-1.5 py-0.5 animate-pulse-neon">
                    {badge}
                  </span>
                )}
                {/* Tooltip when collapsed */}
                {collapsed && (
                  <div className="absolute left-full ml-2 px-2 py-1 rounded-md bg-surface-card border border-surface-border text-xs text-foreground whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                    {label}
                  </div>
                )}
              </motion.div>
            </Link>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-center h-10 border-t border-surface-border text-muted-foreground hover:text-foreground transition-colors"
      >
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>
    </motion.aside>
  );
}
