import React from "react";

interface KPICardProps {
  label: string;
  value: string | number;
  subValue?: string;
  trend?: "up" | "down" | "none";
}

export function KPICard({ label, value, subValue, trend = "none" }: KPICardProps) {
  let trendColor = "text-on-surface-variant";
  if (trend === "up") trendColor = "text-primary";
  if (trend === "down") trendColor = "text-error";

  return (
    <div className="bg-surface-container border border-outline-variant p-4 rounded flex flex-col justify-between h-28 relative overflow-hidden transition-colors hover:border-primary">
      {/* Top Header Label */}
      <span className="text-[10px] font-mono font-bold tracking-widest text-on-surface-variant uppercase">
        {label}
      </span>

      {/* Main Quantitative Number */}
      <div className="text-xl font-mono font-bold text-on-surface my-1 tracking-tight select-all">
        {value === "unavailable" ? "N/A" : value}
      </div>

      {/* Footer comparison Sparkline subtext */}
      <div className="text-[11px] font-mono flex items-center justify-between">
        <span className={trendColor}>
          {subValue ? subValue : "—"}
        </span>
      </div>
    </div>
  );
}
