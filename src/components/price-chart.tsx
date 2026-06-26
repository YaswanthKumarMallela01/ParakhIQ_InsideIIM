"use client";

import React, { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface PricePoint {
  date: string;
  close: number;
}

interface PriceChartProps {
  data: PricePoint[];
  height?: number;
}

export function PriceChart({ data, height = 240 }: PriceChartProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted || !data || data.length === 0) {
    return (
      <div
        className="w-full flex items-center justify-center bg-surface-container-low border border-outline-variant rounded font-mono text-xs text-on-surface-variant"
        style={{ height }}
      >
        No price history available
      </div>
    );
  }

  // Format dates for X-Axis (e.g., 'Jul', 'Sep')
  const formattedData = data.map((d) => {
    const dateObj = new Date(d.date);
    const month = dateObj.toLocaleString("en-US", { month: "short" });
    return {
      ...d,
      formattedDate: `${month} ${dateObj.getFullYear().toString().substring(2)}`,
    };
  });

  // Calculate min/max price for Y-Axis limits
  const prices = data.map((d) => d.close);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const padding = (maxPrice - minPrice) * 0.1 || 10;
  const yDomain = [Math.floor(minPrice - padding), Math.ceil(maxPrice + padding)];

  return (
    <div className="w-full bg-surface-container border border-outline-variant p-4 rounded">
      <div className="flex items-center justify-between mb-4">
        <span className="text-[10px] font-mono font-bold tracking-widest text-on-surface-variant uppercase">
          1-Year Price History (INR)
        </span>
        <span className="text-[10px] font-mono text-primary font-bold">
          LIVE CHART
        </span>
      </div>
      <div className="w-full" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={formattedData}
            margin={{ top: 5, right: 5, left: -20, bottom: 5 }}
          >
            <defs>
              <linearGradient id="chartColor" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
            <XAxis
              dataKey="formattedDate"
              stroke="#86948a"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              dy={10}
            />
            <YAxis
              domain={yDomain}
              stroke="#86948a"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              dx={-5}
              tickFormatter={(v) => `₹${v.toLocaleString("en-IN")}`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1c1c21",
                border: "1px solid #3f3f46",
                borderRadius: "4px",
                fontFamily: "JetBrains Mono, monospace",
                fontSize: "11px",
                color: "#e5e1e4",
              }}
              formatter={(value: any) => [`₹${Number(value).toFixed(2)}`, "Price"]}
              labelFormatter={(label) => `Date: ${label}`}
            />
            <Area
              type="monotone"
              dataKey="close"
              stroke="#10b981"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#chartColor)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
