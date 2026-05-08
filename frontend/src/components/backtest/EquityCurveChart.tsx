"use client";

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";

interface MonthlyEntry {
  month: string;
  roi: number;
  profit_loss: number;
  count: number;
}

interface Props {
  data: MonthlyEntry[];
}

export function EquityCurveChart({ data }: Props) {
  if (!data?.length) return (
    <div className="glass-card p-6 flex items-center justify-center h-64">
      <p className="text-muted-foreground text-sm">No equity data yet</p>
    </div>
  );

  // Build cumulative P&L curve
  let cumulative = 0;
  const chartData = data.map((d) => {
    cumulative += d.profit_loss ?? 0;
    return {
      month: d.month,
      equity: +cumulative.toFixed(2),
      roi:    +d.roi.toFixed(2),
    };
  });

  const isPositive = chartData[chartData.length - 1].equity >= 0;
  const strokeColor  = isPositive ? "#00FF87" : "#F87171";
  const gradientId   = "equityGrad";

  const minVal = Math.min(0, ...chartData.map((d) => d.equity));
  const maxVal = Math.max(0, ...chartData.map((d) => d.equity));

  return (
    <div className="glass-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Equity Curve</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">Cumulative profit / loss per unit staked</p>
        </div>
        <div className="text-right">
          <p
            className="text-xl font-black font-mono"
            style={{ color: strokeColor }}
          >
            {chartData[chartData.length - 1].equity >= 0 ? "+" : ""}
            {chartData[chartData.length - 1].equity.toFixed(2)}u
          </p>
          <p className="text-[10px] text-muted-foreground">total P&L</p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={strokeColor} stopOpacity={0.35} />
              <stop offset="50%" stopColor={strokeColor} stopOpacity={0.10} />
              <stop offset="95%" stopColor={strokeColor} stopOpacity={0} />
            </linearGradient>
            {/* Glow filter on the line */}
            <filter id="equityGlow" x="-10%" y="-40%" width="120%" height="180%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="#30363D" />
          <XAxis dataKey="month" tick={{ fill: "#7D8590", fontSize: 11 }} />
          <YAxis
            domain={[minVal * 1.15, maxVal * 1.15]}
            tick={{ fill: "#7D8590", fontSize: 11 }}
            tickFormatter={(v) => `${v > 0 ? "+" : ""}${v.toFixed(1)}u`}
          />
          <ReferenceLine y={0} stroke="#7D8590" strokeDasharray="4 3" strokeOpacity={0.6} />
          <Tooltip
            contentStyle={{
              background: "#1C2128",
              border: "1px solid #30363D",
              borderRadius: "8px",
              color: "#E6EDF3",
              fontSize: 12,
            }}
            formatter={(val: number, name: string) => [
              name === "equity" ? `${val >= 0 ? "+" : ""}${val.toFixed(2)}u` : `${val >= 0 ? "+" : ""}${val.toFixed(1)}%`,
              name === "equity" ? "Cumulative P&L" : "Monthly ROI",
            ]}
          />
          <Area
            type="monotoneX"
            dataKey="equity"
            stroke={strokeColor}
            strokeWidth={2.5}
            fill={`url(#${gradientId})`}
            dot={false}
            activeDot={{ r: 5, strokeWidth: 0, fill: strokeColor }}
            filter="url(#equityGlow)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
