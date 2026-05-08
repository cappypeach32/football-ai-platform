"use client";

import { useQuery } from "@tanstack/react-query";
import { analyticsApi } from "@/lib/api";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export function LeagueStatsTable() {
  const { data } = useQuery({
    queryKey: ["analytics", "leagues"],
    queryFn: () => analyticsApi.getLeagueStats().then((r) => r.data as Array<{ id: number; name: string; country: string; match_count: number }>),
  });

  return (
    <div className="glass-card overflow-hidden">
      <div className="px-6 py-4 border-b border-surface-border">
        <h3 className="text-sm font-semibold text-foreground">Leagues Coverage</h3>
      </div>
      <div className="p-6">
        {data?.length ? (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data.slice(0, 10)} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#30363D" horizontal={false} />
              <XAxis type="number" tick={{ fill: "#7D8590", fontSize: 11 }} />
              <YAxis dataKey="name" type="category" width={120} tick={{ fill: "#E6EDF3", fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: "#1C2128", border: "1px solid #30363D", borderRadius: "8px", color: "#E6EDF3" }}
              />
              <Bar dataKey="match_count" fill="#00FF87" radius={[0, 4, 4, 0]} name="Matches" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-muted-foreground text-sm text-center py-8">No league data available</p>
        )}
      </div>
    </div>
  );
}
