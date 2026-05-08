"use client";

import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { PageTransition } from "@/components/layout/PageTransition";
import { MobileNav } from "@/components/layout/MobileNav";
import { FocusModeProvider, useFocusMode } from "@/context/FocusModeContext";

const NO_SHELL_ROUTES = ["/login", "/register"];

function ShellInner({ children }: { children: React.ReactNode }) {
  const { isFocused } = useFocusMode();

  return (
    <div className="flex h-screen overflow-hidden relative">
      {/* Noise texture */}
      <div className="noise-layer" aria-hidden="true" />

      {/* Floating ambient orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0" aria-hidden="true">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
      </div>

      {/* Sidebar — hidden in focus mode */}
      <AnimatePresence>
        {!isFocused && (
          <motion.div
            key="sidebar"
            initial={{ x: 0 }}
            exit={{ x: -300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
            className="hidden sm:flex"
          >
            <Sidebar />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col flex-1 overflow-hidden relative z-10 min-w-0">
        {/* TopBar — hidden in focus mode */}
        <AnimatePresence>
          {!isFocused && (
            <motion.div
              key="topbar"
              initial={{ y: 0 }}
              exit={{ y: -60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            >
              <TopBar />
            </motion.div>
          )}
        </AnimatePresence>

        <main className={`flex-1 overflow-y-auto transition-all duration-300 ${isFocused ? "p-0" : "p-4 pb-20 md:p-6 md:pb-6 lg:p-8 lg:pb-8"}`}>
          <PageTransition>{children}</PageTransition>
        </main>
      </div>

      {/* Mobile nav — hidden in focus mode */}
      {!isFocused && <MobileNav />}
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = NO_SHELL_ROUTES.some((r) => pathname.startsWith(r));

  if (isAuthPage) {
    return <>{children}</>;
  }

  return (
    <FocusModeProvider>
      <ShellInner>{children}</ShellInner>
    </FocusModeProvider>
  );
}
