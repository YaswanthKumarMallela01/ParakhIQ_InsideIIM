"use client";

import React, { useEffect, useState } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export function PortfolioOverview() {
  const [summary, setSummary] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/portfolio/summary")
      .then(res => res.json())
      .then(data => {
        if (!data.error) {
          setSummary(data);
        }
      })
      .catch(err => console.error(err))
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return <div className="h-48 w-full flex items-center justify-center font-mono text-xs text-on-surface-variant animate-pulse">LOADING AGGREGATES...</div>;
  }

  if (!summary || !summary.totalInvested) {
    return null;
  }

  return (
    <div className="bg-surface-container border border-outline-variant p-6 rounded space-y-6">
      <div className="flex justify-between items-center border-b border-outline-variant pb-2">
        <h3 className="text-xs font-mono font-bold tracking-widest text-on-surface-variant uppercase">
          Portfolio Overview & Diagnostics
        </h3>
        <span className="text-[9px] font-mono text-primary font-bold">AGGREGATE</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
        {/* Sector Allocation Donut Chart */}
        <div className="h-[250px] w-full relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={summary.sectorAllocation}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={2}
                dataKey="value"
                stroke="none"
              >
                {summary.sectorAllocation.map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: any) => `₹${Number(value).toLocaleString("en-IN")}`}
                contentStyle={{ backgroundColor: '#1a1c1e', borderColor: '#43474e', fontSize: '12px', fontFamily: 'monospace' }}
                itemStyle={{ color: '#e3e2e6' }}
              />
              <Legend 
                verticalAlign="bottom" 
                height={36} 
                iconType="circle"
                wrapperStyle={{ fontSize: '10px', fontFamily: 'monospace' }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mb-8">
            <span className="text-[10px] font-mono text-on-surface-variant uppercase">Sectors</span>
            <span className="font-bold text-on-surface font-mono">{summary.sectorAllocation.length}</span>
          </div>
        </div>

        {/* Aggregate Stats & Warnings */}
        <div className="space-y-4">
          <div className="bg-surface-container-lowest border border-outline-variant p-4 rounded flex justify-between items-center">
            <div>
              <div className="text-[10px] font-mono text-on-surface-variant uppercase">Forecasted Target Return</div>
              <div className="text-sm font-mono font-bold text-primary mt-1">
                {summary.weightedPredictedRange.low > 0 ? '+' : ''}{summary.weightedPredictedRange.low}% to {summary.weightedPredictedRange.high > 0 ? '+' : ''}{summary.weightedPredictedRange.high}%
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-mono text-on-surface-variant uppercase">Weighted Midpoint</div>
              <div className="text-sm font-mono font-bold text-on-surface mt-1">
                {summary.weightedPredictedRange.midpoint > 0 ? '+' : ''}{summary.weightedPredictedRange.midpoint}%
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-[10px] font-mono font-bold text-on-surface-variant uppercase tracking-widest border-b border-outline-variant/50 pb-1">AI Diagnostics</h4>
            {summary.concentrationWarnings.length > 0 ? (
              summary.concentrationWarnings.map((warn: string, i: number) => (
                <div key={i} className="flex items-start gap-2 text-xs font-mono text-warning bg-warning/10 p-2 rounded border border-warning/20">
                  <span>⚠️</span>
                  <span>{warn}</span>
                </div>
              ))
            ) : (
              <div className="flex items-start gap-2 text-xs font-mono text-primary bg-primary/10 p-2 rounded border border-primary/20">
                <span>✅</span>
                <span>Portfolio is well-diversified. No structural warnings.</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
