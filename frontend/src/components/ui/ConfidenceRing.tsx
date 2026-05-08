"use client";

import { motion, useSpring, useTransform } from "framer-motion";
import { useEffect, useRef } from "react";

interface Props {
  value: number;          // 0-100
  size?: number;          // px, default 96
  strokeWidth?: number;   // default 7
  color?: string;
  label?: string;
  sublabel?: string;
  showPulse?: boolean;
}

function getColor(value: number) {
  if (value >= 75) return "#00FF87";   // neon green — high confidence
  if (value >= 55) return "#F5A623";   // amber — medium
  return "#F87171";                     // red — low
}

export function ConfidenceRing({
  value,
  size = 96,
  strokeWidth = 7,
  color,
  label,
  sublabel,
  showPulse = true,
}: Props) {
  const resolvedColor = color ?? getColor(value);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Animate the stroke
  const spring = useSpring(0, { stiffness: 40, damping: 16 });
  const dashOffset = useTransform(spring, (v) =>
    circumference - (v / 100) * circumference
  );

  useEffect(() => {
    spring.set(value);
  }, [value, spring]);

  const cx = size / 2;
  const cy = size / 2;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      {/* Outer pulse ring */}
      {showPulse && (
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{ border: `2px solid ${resolvedColor}` }}
          animate={{ scale: [1, 1.12, 1], opacity: [0.4, 0, 0.4] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      {/* SVG ring */}
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        {/* Glow filter */}
        <defs>
          <filter id={`ring-glow-${value}`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Track */}
        <circle
          cx={cx} cy={cy} r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={strokeWidth}
        />

        {/* Animated progress arc */}
        <motion.circle
          cx={cx} cy={cy} r={radius}
          fill="none"
          stroke={resolvedColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          style={{ strokeDashoffset: dashOffset, filter: `url(#ring-glow-${value})` }}
        />
      </svg>

      {/* Centre label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <motion.span
          className="font-black font-mono leading-none"
          style={{ color: resolvedColor, fontSize: size * 0.22 }}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
        >
          {Math.round(value)}%
        </motion.span>
        {label && (
          <span
            className="text-muted-foreground text-center leading-none mt-1"
            style={{ fontSize: size * 0.1 }}
          >
            {label}
          </span>
        )}
      </div>
    </div>
  );
}
