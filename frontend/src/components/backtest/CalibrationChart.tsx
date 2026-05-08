"use client";

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Line,
  ComposedChart,
} from "recharts";

interface CalibrationPoint {
  predicted_prob_pct: number;
  actual_win_rate: number;
  count: number;
}

interface Props {
  data: CalibrationPoint[];
}

const CustomDot = (props: any) => {
  const { cx, cy, payload } = props;
  const r = Math.max(4, Math.min(14, Math.sqrt(payload.count) * 1.5));
  return <circle cx={cx} cy={cy} r={r} fill="#00FF87" fillOpacity={0.8} stroke="#00FF87" strokeWidth={1} />;
};

export function CalibrationChart({ data }: Props) {
  if (!data?.length) return (
    <div className="glass-card p-6 flex items-center justify-center h-64">
      <p className="text-muted-foreground text-sm">No calibration data yet</p>
    </div>
  );

  // Perfect calibration reference line: predicted == actual
  const perfectLine = [
    { predicted_prob_pct: 0, actual_win_rate: 0 },
    { predicted_prob_pct: 100, actual_win_rate: 1 },
  ];

  const chartData = data.map((d) => ({
    ...d,
    predicted: d.predicted_prob_pct,
    actual_pct: +(d.actual_win_rate * 100).toFixed(1),
  }));

  return (
    <div className="glass-card p-6 space-y-4">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-foreground">Confidence Calibration</h3>
        <p className="text-xs text-muted-foreground">
          Predicted probability vs actual win rate — dots sized by sample count
        </p>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#30363D" />
          <XAxis
            dataKey="predicted"
            type="number"
            domain={[0, 100]}
            tick={{ fill: "#7D8590", fontSize: 11 }}
            unit="%"
            label={{ value: "Predicted %", position: "insideBottom", offset: -2, fill: "#7D8590", fontSize: 10 }}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fill: "#7D8590", fontSize: 11 }}
            unit="%"
            label={{ value: "Actual %", angle: -90, position: "insideLeft", fill: "#7D8590", fontSize: 10 }}
          />
          <Tooltip
            contentStyle={{ background: "#1C2128", border: "1px solid #30363D", borderRadius: "8px", color: "#E6EDF3" }}
            formatter={(val: number, name: string) => [`${val}%`, name]}
            labelFormatter={(label) => `Predicted: ${label}%`}
          />
          {/* Perfect calibration line */}
          <Line
            data={[{ predicted: 0, actual_pct: 0 }, { predicted: 100, actual_pct: 100 }]}
            type="linear"
            dataKey="actual_pct"
            stroke="#7D8590"
            strokeDasharray="5 5"
            dot={false}
            name="Perfect calibration"
          />
          {/* Actual data scatter */}
          <Scatter dataKey="actual_pct" fill="#00FF87" name="Actual win rate" shape={<CustomDot />} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
