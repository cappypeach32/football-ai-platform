/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Design system – dark AI aesthetic
        background:  "hsl(var(--background))",
        foreground:  "hsl(var(--foreground))",
        card:        { DEFAULT: "hsl(var(--card))",        foreground: "hsl(var(--card-foreground))" },
        popover:     { DEFAULT: "hsl(var(--popover))",     foreground: "hsl(var(--popover-foreground))" },
        primary:     { DEFAULT: "hsl(var(--primary))",     foreground: "hsl(var(--primary-foreground))" },
        secondary:   { DEFAULT: "hsl(var(--secondary))",   foreground: "hsl(var(--secondary-foreground))" },
        muted:       { DEFAULT: "hsl(var(--muted))",       foreground: "hsl(var(--muted-foreground))" },
        accent:      { DEFAULT: "hsl(var(--accent))",      foreground: "hsl(var(--accent-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        border:      "hsl(var(--border))",
        input:       "hsl(var(--input))",
        ring:        "hsl(var(--ring))",
        // Neon palette
        neon: {
          green:  "#00FF87",
          blue:   "#00D4FF",
          purple: "#8B5CF6",
          pink:   "#F472B6",
          amber:  "#FBBF24",
        },
        surface: {
          DEFAULT: "#0D1117",
          elevated: "#161B22",
          card: "#1C2128",
          border: "#30363D",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains)", "monospace"],
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic": "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
        "card-shine": "linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0) 100%)",
        "neon-glow-green": "radial-gradient(circle, rgba(0,255,135,0.15) 0%, transparent 70%)",
        "neon-glow-blue": "radial-gradient(circle, rgba(0,212,255,0.15) 0%, transparent 70%)",
      },
      boxShadow: {
        "neon-green":  "0 0 20px rgba(0,255,135,0.3), 0 0 40px rgba(0,255,135,0.1)",
        "neon-blue":   "0 0 20px rgba(0,212,255,0.3), 0 0 40px rgba(0,212,255,0.1)",
        "neon-purple": "0 0 20px rgba(139,92,246,0.3), 0 0 40px rgba(139,92,246,0.1)",
        "card-glow":   "0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)",
        "glass":       "0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)",
      },
      animation: {
        "fade-in":       "fadeIn 0.5s ease-out",
        "slide-up":      "slideUp 0.4s ease-out",
        "slide-in-right":"slideInRight 0.4s ease-out",
        "pulse-neon":    "pulseNeon 2s infinite",
        "shimmer":       "shimmer 1.5s infinite",
        "float":         "float 3s ease-in-out infinite",
      },
      keyframes: {
        fadeIn:       { from: { opacity: "0" },           to: { opacity: "1" } },
        slideUp:      { from: { opacity: "0", transform: "translateY(20px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        slideInRight: { from: { opacity: "0", transform: "translateX(20px)" }, to: { opacity: "1", transform: "translateX(0)" } },
        pulseNeon:    { "0%,100%": { opacity: "1" }, "50%": { opacity: "0.6" } },
        shimmer:      { "0%": { backgroundPosition: "-200% 0" }, "100%": { backgroundPosition: "200% 0" } },
        float:        { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-8px)" } },
      },
    },
  },
  plugins: [],
};
