"use client";

import { motion, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";

const variants = {
  initial:  { opacity: 0, y: 10, filter: "blur(4px)", scale: 0.99 },
  enter:    { opacity: 1, y: 0,  filter: "blur(0px)", scale: 1 },
  exit:     { opacity: 0, y: -6, filter: "blur(2px)", scale: 1.005 },
};

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        variants={variants}
        initial="initial"
        animate="enter"
        exit="exit"
        transition={{
          duration: 0.28,
          ease: [0.25, 0.46, 0.45, 0.94],
          filter: { duration: 0.22 },
          scale:  { duration: 0.28 },
        }}
        style={{ willChange: "opacity, transform, filter" }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
