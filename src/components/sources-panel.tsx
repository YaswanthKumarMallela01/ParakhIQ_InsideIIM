"use client";

import React, { useState } from "react";
import { Source } from "@/lib/agent/state";

interface SourcesPanelProps {
  sources: Source[];
}

export function SourcesPanel({ sources }: SourcesPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!sources || sources.length === 0) {
    return null;
  }

  const groupedSources = sources.reduce((acc, src) => {
    const key = src.used_for;
    if (!acc[key]) acc[key] = [];
    acc[key].push(src);
    return acc;
  }, {} as Record<string, Source[]>);

  const getGroupTitle = (key: string) => {
    switch (key) {
      case "news": return "News & Recent Articles";
      case "sector_context": return "Sector Context & Peers";
      case "bearish_evidence": return "Bearish Risk Analysis";
      default: return "Other Sources";
    }
  };

  return (
    <div className="bg-surface-container border border-outline-variant rounded mt-6 overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex justify-between items-center p-4 bg-surface-container-low hover:bg-surface-container-high transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <span className="text-on-surface-variant">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"></path>
            </svg>
          </span>
          <span className="font-hanken font-bold text-sm tracking-wide text-on-surface">EVIDENCE SOURCES ({sources.length})</span>
        </div>
        <span className="text-on-surface-variant transition-transform duration-200" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </span>
      </button>

      {isExpanded && (
        <div className="p-4 space-y-6 border-t border-outline-variant">
          {Object.entries(groupedSources).map(([key, groupSources]) => (
            <div key={key}>
              <h4 className="text-[10px] font-mono font-bold text-on-surface-variant uppercase mb-3 tracking-widest">{getGroupTitle(key)}</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {groupSources.map((src, idx) => {
                  let hostname = "";
                  try { hostname = new URL(src.url).hostname; } catch(e) {}
                  return (
                    <a
                      key={idx}
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-3 bg-surface-container-lowest border border-outline-variant hover:border-primary rounded transition-colors flex flex-col gap-2 group"
                    >
                      <div className="flex items-center gap-2">
                        {hostname && (
                          <img
                            src={`https://www.google.com/s2/favicons?domain=${hostname}&sz=32`}
                            alt=""
                            className="w-4 h-4 rounded-sm"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        )}
                        <span className="text-xs font-bold text-on-surface group-hover:text-primary truncate">{src.title}</span>
                      </div>
                      <p className="text-[10px] text-on-surface-variant/80 line-clamp-2 leading-relaxed">
                        {src.snippet}
                      </p>
                      {hostname && (
                        <div className="text-[9px] font-mono text-on-surface-variant mt-1">
                          {hostname}
                        </div>
                      )}
                    </a>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
