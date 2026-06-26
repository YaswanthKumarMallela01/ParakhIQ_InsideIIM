import React from "react";

interface PredictionRangeProps {
  rangeLow: number;
  rangeHigh: number;
  midpoint: number;
  guidance: "hold" | "reconsider" | "reduce";
}

export function PredictionRange({
  rangeLow,
  rangeHigh,
  midpoint,
  guidance,
}: PredictionRangeProps) {
  // Map values to percentage on a -30% to +30% scale
  const scaleValue = (val: number) => {
    const minVal = -30;
    const maxVal = 30;
    const percentage = ((val - minVal) / (maxVal - minVal)) * 100;
    return Math.max(0, Math.min(100, percentage));
  };

  const lowPercent = scaleValue(rangeLow);
  const highPercent = scaleValue(rangeHigh);
  const midpointPercent = scaleValue(midpoint);

  let guidanceText = "HOLD / ACCUMULATE";
  let guidanceColor = "text-primary border-primary bg-primary/10";
  if (guidance === "reconsider") {
    guidanceText = "RECONSIDER / NEUTRAL";
    guidanceColor = "text-yellow-500 border-yellow-500 bg-yellow-500/10";
  } else if (guidance === "reduce") {
    guidanceText = "REDUCE / SELL";
    guidanceColor = "text-error border-error bg-error/10";
  }

  return (
    <div className="bg-surface-container border border-outline-variant p-4 rounded flex flex-col justify-between">
      <div className="flex justify-between items-center mb-4">
        <span className="text-[10px] font-mono font-bold tracking-widest text-on-surface-variant uppercase">
          1-Year Directional Prediction
        </span>
        <span className={`text-[10px] font-mono font-bold border px-2 py-0.5 rounded ${guidanceColor}`}>
          {guidanceText}
        </span>
      </div>

      {/* Midpoint display */}
      <div className="mb-4">
        <div className="text-2xl font-mono font-bold text-primary">
          {rangeLow >= 0 ? "+" : ""}
          {rangeLow}% to {rangeHigh >= 0 ? "+" : ""}
          {rangeHigh}%
        </div>
        <div className="text-xs font-mono text-on-surface-variant mt-1">
          Midpoint: <span className="text-on-surface font-semibold">{midpoint >= 0 ? "+" : ""}{midpoint}%</span>
        </div>
      </div>

      {/* Visual range slider */}
      <div className="relative w-full h-8 flex items-center mb-2">
        {/* Scale labels */}
        <div className="absolute top-0 left-0 text-[9px] font-mono text-on-surface-variant">-30%</div>
        <div className="absolute top-0 right-0 text-[9px] font-mono text-on-surface-variant">+30%</div>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 text-[9px] font-mono text-on-surface-variant">0%</div>

        {/* Slider bar background */}
        <div className="w-full h-1 bg-surface-container-low rounded relative mt-3">
          {/* Range segment */}
          <div
            className="absolute h-1 bg-primary/40 rounded"
            style={{
              left: `${lowPercent}%`,
              width: `${highPercent - lowPercent}%`,
            }}
          />
          {/* Midpoint pin */}
          <div
            className="absolute w-3 h-3 -mt-1 bg-primary rounded-full border border-surface shadow cursor-pointer transform -translate-x-1/2"
            style={{ left: `${midpointPercent}%` }}
          />
          {/* 0% marker line */}
          <div className="absolute left-1/2 h-2 -mt-0.5 w-0.5 bg-outline-variant" />
        </div>
      </div>

      <div className="text-[10px] font-mono text-on-surface-variant leading-relaxed border-t border-outline-variant pt-2.5">
        ℹ️ Heuristic estimate based on trend extrapolation and sentiment; not a financial guarantee.
      </div>
    </div>
  );
}
