import React from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { formatKpiValue, formatWeekShort } from "@/config/kpiConfig";

const CATEGORY_COLORS = {
  revenue: "#16a34a",
  leads: "#2563eb",
  social: "#db2777",
  operations: "#d97706",
};

export default function KpiTrendChart({ kpiDef, data }) {
  const color = CATEGORY_COLORS[kpiDef.category] || "#6366f1";

  const chartData = data.map((d) => ({
    week: formatWeekShort(d.month),
    actual: Number(d.actual_value) || 0,
    target: d.target_value !== null && d.target_value !== undefined ? Number(d.target_value) : null,
  }));

  if (chartData.length < 2) {
    return (
      <div className="h-36 flex items-center justify-center text-sm text-gray-400">
        Need at least 2 weeks of data
      </div>
    );
  }

  return (
    <div className="h-40">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
          <XAxis dataKey="week" tick={{ fontSize: 11 }} className="text-gray-500" />
          <YAxis tick={{ fontSize: 11 }} className="text-gray-500" width={45} />
          <Tooltip
            contentStyle={{
              backgroundColor: "white",
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
              fontSize: "12px",
            }}
            formatter={(value, name) => [
              formatKpiValue(value, kpiDef.unit),
              name === "actual" ? "Actual" : "Target",
            ]}
          />
          <Line
            type="monotone"
            dataKey="actual"
            stroke={color}
            strokeWidth={2}
            dot={{ fill: color, r: 3 }}
            activeDot={{ r: 5 }}
          />
          {chartData.some((d) => d.target !== null) && (
            <Line
              type="monotone"
              dataKey="target"
              stroke="#9ca3af"
              strokeWidth={1.5}
              strokeDasharray="5 5"
              dot={false}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
