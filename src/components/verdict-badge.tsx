import React from "react";

interface VerdictBadgeProps {
  verdict: "Invest" | "Pass";
  size?: "sm" | "md" | "lg";
}

export function VerdictBadge({ verdict, size = "md" }: VerdictBadgeProps) {
  const isInvest = verdict?.toLowerCase() === "invest";
  
  const colors = isInvest
    ? "bg-primary text-on-primary border-primary"
    : "bg-error text-on-error border-error";

  const sizeClasses = {
    sm: "px-2 py-0.5 text-[10px] tracking-wider",
    md: "px-4 py-1 text-xs tracking-widest",
    lg: "px-6 py-2 text-sm tracking-widest font-bold",
  };

  return (
    <span
      className={`inline-block font-mono border rounded font-bold uppercase select-none ${colors} ${sizeClasses[size]}`}
    >
      {verdict}
    </span>
  );
}
