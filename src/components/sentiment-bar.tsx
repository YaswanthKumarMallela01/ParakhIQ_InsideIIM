import React from "react";

interface SentimentBarProps {
  score: number; // -1 to +1
}

export function SentimentBar({ score }: SentimentBarProps) {
  // Clamp score
  const clampedScore = Math.max(-1, Math.min(1, score));
  // Convert -1 to +1 range to percentage widths
  // If score is positive: left: 50%, width: score * 50%
  // If score is negative: right: 50%, width: Math.abs(score) * 50%
  const percentage = Math.round(Math.abs(clampedScore) * 50);

  const direction =
    clampedScore > 0.1
      ? "Bullish"
      : clampedScore < -0.1
      ? "Bearish"
      : "Neutral";

  const colorClass =
    clampedScore > 0.1
      ? "bg-primary"
      : clampedScore < -0.1
      ? "bg-error"
      : "bg-on-surface-variant";

  const textColorClass =
    clampedScore > 0.1
      ? "text-primary"
      : clampedScore < -0.1
      ? "text-error"
      : "text-on-surface-variant";

  return (
    <div className="bg-surface-container border border-outline-variant p-4 rounded flex flex-col justify-between">
      <div className="flex justify-between items-center mb-2">
        <span className="text-[10px] font-mono font-bold tracking-widest text-on-surface-variant uppercase">
          News Sentiment Analysis
        </span>
        <span className={`text-[10px] font-mono font-bold uppercase ${textColorClass}`}>
          {direction}
        </span>
      </div>

      {/* Bar visualizer */}
      <div className="relative h-4 w-full bg-surface-container-low rounded border border-outline-variant overflow-hidden mb-3">
        {/* Center Divider line */}
        <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-outline-variant z-10" />

        {/* Sentiment filled bar */}
        {clampedScore >= 0 ? (
          <div
            className={`absolute top-0 bottom-0 ${colorClass}`}
            style={{ left: "50%", width: `${percentage}%` }}
          />
        ) : (
          <div
            className={`absolute top-0 bottom-0 ${colorClass}`}
            style={{ right: "50%", width: `${percentage}%` }}
          />
        )}
      </div>

      <div className="flex justify-between items-center text-xs font-mono">
        <span className="text-error">-1.0 (Bearish)</span>
        <span className="text-on-surface font-bold">
          {clampedScore > 0 ? "+" : ""}
          {clampedScore.toFixed(2)}
        </span>
        <span className="text-primary">+1.0 (Bullish)</span>
      </div>
    </div>
  );
}
