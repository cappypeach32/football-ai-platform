"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { LayoutDashboard, Brain, Activity, BarChart3, History } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/",            label: "Home",     icon: LayoutDashboard },
  { href: "/predictions", label: "Picks",    icon: Brain },
  { href: "/live",        label: "Live",     icon: Activity },
  { href: "/analytics",   label: "Stats",    icon: BarChart3 },
  { href: "/backtest",    label: "Backtest", icon: History },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 sm:hidden">
      <div
        className="bg-surface-elevated/90 backdrop-blur-xl border-t border-surface-border/60 flex items-center justify-around px-2 py-2"
        style={{
          boxShadow: "0 -8px 32px rgba(0,0,0,0.4), 0 -1px 0 rgba(0,255,135,0.08)",
          paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))",
        }}
      >
        {items.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center gap-0.5 px-3 py-1.5 relative min-w-[48px]"
            >
              {active && (
                <motion.div
                  layoutId="mobile-nav-indicator"
                  className="absolute inset-0 rounded-xl bg-neon-green/10 border border-neon-green/20"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <Icon
                className={cn(
                  "w-5 h-5 relative z-10 transition-colors duration-200",
                  active ? "text-neon-green" : "text-muted-foreground"
                )}
                style={active ? { filter: "drop-shadow(0 0 5px rgba(0,255,135,0.6))" } : undefined}
              />
              <span
                className={cn(
                  "text-[10px] font-medium relative z-10 transition-colors duration-200",
                  active ? "text-neon-green" : "text-muted-foreground/60"
                )}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
