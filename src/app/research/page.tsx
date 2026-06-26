"use client";

import React, { useState } from "react";
import { Nav } from "@/components/nav";
import { Disclaimer } from "@/components/disclaimer";
import { ReasoningStepper } from "@/components/reasoning-stepper";
import { VerdictBadge } from "@/components/verdict-badge";
import { KPICard } from "@/components/kpi-card";
import { PriceChart } from "@/components/price-chart";
import { AddHoldingModal } from "@/components/add-holding-modal";

export default function ResearchPage() {
  const [query, setQuery] = useState("");
  const [profile, setProfile] = useState<"conservative" | "aggressive">("aggressive");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentNode, setCurrentNode] = useState("");
  const [logs, setLogs] = useState<string[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Analysis result states
  const [memo, setMemo] = useState<any>(null);
  const [ticker, setTicker] = useState("");
  const [exchange, setExchange] = useState("");

  const handleStartAnalysis = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsAnalyzing(true);
    setCurrentNode("intake");
    setLogs([]);
    setMemo(null);
    setTicker("");
    setExchange("");

    try {
      const response = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: query,
          investorProfile: profile,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to start research");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("ReadableStream not supported");
      }

      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        // Keep the last partial line in the buffer
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;

          // Parse event: name \n data: JSON
          const eventMatch = line.match(/^event: (.*)\ndata: ([\s\S]*)$/);
          if (eventMatch) {
            const eventType = eventMatch[1];
            const eventData = JSON.parse(eventMatch[2]);

            if (eventType === "update") {
              if (eventData.node) setCurrentNode(eventData.node);
              if (eventData.logs) {
                setLogs((prev) => [...prev, ...eventData.logs]);
              }
              if (eventData.ticker) setTicker(eventData.ticker);
              if (eventData.exchange) setExchange(eventData.exchange);
              if (eventData.memo) setMemo(eventData.memo);
            } else if (eventType === "done") {
              setCurrentNode("done");
              setIsAnalyzing(false);
            } else if (eventType === "error") {
              setLogs((prev) => [...prev, `[ERROR] ${eventData.error}`]);
              setIsAnalyzing(false);
            }
          }
        }
      }
    } catch (err: any) {
      setLogs((prev) => [...prev, `[CRITICAL ERROR] ${err.message || err}`]);
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen pb-16 md:pb-0">
      <Disclaimer />
      <Nav />

      <main className="flex-grow max-w-6xl w-full mx-auto p-4 md:p-6 space-y-6">
        {/* Terminal Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-surface-container border border-outline-variant p-4 rounded">
          <div className="space-y-1">
            <h1 className="font-hanken font-bold text-lg text-on-surface">AI RESEARCH TERMINAL</h1>
            <p className="text-xs font-mono text-on-surface-variant uppercase">
              Indian-Market First Equity Thesis Engine & Critic
            </p>
          </div>
          {/* Intake inputs form */}
          {!isAnalyzing && currentNode !== "done" && (
            <form onSubmit={handleStartAnalysis} className="w-full md:w-auto flex flex-col md:flex-row gap-3">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. Reliance or RELIANCE.NS"
                required
                className="bg-surface-container-lowest border border-outline-variant rounded px-3 py-2 text-xs font-mono text-on-surface focus:outline-none focus:border-primary min-w-[200px]"
              />

              <select
                value={profile}
                onChange={(e) => setProfile(e.target.value as any)}
                className="bg-surface-container-lowest border border-outline-variant rounded px-3 py-2 text-xs font-mono text-on-surface focus:outline-none focus:border-primary"
              >
                <option value="aggressive">AGGRESSIVE / SHORT-HORIZON</option>
                <option value="conservative">CONSERVATIVE / LONG-HORIZON</option>
              </select>

              <button
                type="submit"
                className="bg-primary text-on-primary font-bold px-5 py-2 rounded text-xs font-mono tracking-widest hover:bg-primary/95 transition-colors cursor-pointer"
              >
                RUN RESEARCH
              </button>
            </form>
          )}
        </div>

        {/* Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Stepper Timeline & Active Logger (takes 1 col on results page, full width when loading) */}
          {(isAnalyzing || (currentNode && currentNode !== "done")) && (
            <div className={`bg-surface-container border border-outline-variant p-6 rounded ${
              currentNode === "done" ? "lg:col-span-1" : "lg:col-span-3"
            }`}>
              <ReasoningStepper currentNode={currentNode} logs={logs} />
              
              {currentNode === "done" && (
                <div className="mt-6 pt-6 border-t border-outline-variant flex flex-col gap-3">
                  <button
                    onClick={() => {
                      setCurrentNode("");
                      setMemo(null);
                      setQuery("");
                    }}
                    className="w-full bg-surface-container-low hover:bg-surface-container-high border border-outline-variant py-2.5 rounded text-xs font-mono text-on-surface transition-colors"
                  >
                    RUN NEW ANALYSIS
                  </button>
                  <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="w-full bg-primary text-on-primary font-bold py-2.5 rounded text-xs font-mono tracking-wider hover:bg-primary/95 transition-colors"
                  >
                    ADD TO PORTFOLIO
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Initial Search Guide */}
          {!isAnalyzing && !currentNode && (
            <div className="lg:col-span-3 bg-surface-container border border-outline-variant p-8 rounded text-center space-y-4">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full border border-outline-variant/60 text-primary mb-2">
                <span className="font-mono text-xl">🔍</span>
              </div>
              <h2 className="font-hanken font-bold text-base text-on-surface">START AN INVESTMENT THESIS</h2>
              <p className="text-xs text-on-surface-variant max-w-md mx-auto leading-relaxed">
                Enter any Indian listed company name or ticker suffix (NSE `.NS`, BSE `.BO`). Our multi-agent researcher will gather market data, write an investment thesis, run disconfirming research loops, and render a final verdict.
              </p>
            </div>
          )}

          {/* Research Results Dashboard */}
          {currentNode === "done" && memo && (
            <div className="lg:col-span-2 space-y-6">
              {/* Verdict Summary Card */}
              <div className="bg-surface-container border border-outline-variant p-6 rounded space-y-4">
                <div className="flex flex-wrap justify-between items-center gap-3">
                  <div>
                    <span className="text-[10px] font-mono bg-secondary/15 text-secondary border border-secondary/20 px-2 py-0.5 rounded uppercase mr-2 font-semibold">
                      {ticker || "RELIANCE.NS"}
                    </span>
                    <span className="text-xs font-mono text-on-surface-variant">
                      {exchange || "NSE"}
                    </span>
                    <h2 className="text-base font-hanken font-bold text-on-surface mt-1">
                      {memo.companyName || query}
                    </h2>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-[10px] font-mono text-on-surface-variant uppercase">Confidence</div>
                      <div className="text-sm font-mono font-bold text-primary">{memo.confidence}%</div>
                    </div>
                    <VerdictBadge verdict={memo.verdict} size="lg" />
                  </div>
                </div>

                {/* Confidence bar */}
                <div className="w-full h-1 bg-surface-container-low rounded-full overflow-hidden border border-outline-variant/30">
                  <div
                    className={`h-full ${memo.verdict === "Invest" ? "bg-primary" : "bg-error"}`}
                    style={{ width: `${memo.confidence}%` }}
                  />
                </div>

                <p className="text-xs text-on-surface leading-relaxed border-t border-outline-variant/30 pt-4">
                  {memo.summary}
                </p>
              </div>

              {/* KPI Cards Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <KPICard
                  label="P/E Ratio"
                  value={memo.kpis.peRatio}
                  subValue={memo.kpis.peSectorRatio !== "unavailable" ? `VS SECTOR ${memo.kpis.peSectorRatio}` : "Sector PE N/A"}
                  trend={
                    memo.kpis.peRatio !== "unavailable" && memo.kpis.peSectorRatio !== "unavailable"
                      ? Number(memo.kpis.peRatio) <= Number(memo.kpis.peSectorRatio)
                        ? "up"
                        : "down"
                      : "none"
                  }
                />
                <KPICard
                  label="Market Cap"
                  value={memo.kpis.marketCap}
                  subValue="INR"
                />
                <KPICard
                  label="Debt / Equity"
                  value={memo.kpis.debtToEquity}
                  subValue={Number(memo.kpis.debtToEquity) <= 0.5 ? "Low Leverage" : "Leveraged"}
                  trend={Number(memo.kpis.debtToEquity) <= 0.5 ? "up" : "down"}
                />
                <KPICard
                  label="Promoter Holding"
                  value={memo.kpis.promoterHolding}
                  subValue="QoQ Change"
                  trend={memo.kpis.promoterHolding.includes("↑") ? "up" : memo.kpis.promoterHolding.includes("↓") ? "down" : "none"}
                />
                <KPICard
                  label="52W High"
                  value={memo.kpis.fiftyTwoWeekHigh}
                  subValue="Resistance"
                />
                <KPICard
                  label="52W Low"
                  value={memo.kpis.fiftyTwoWeekLow}
                  subValue="Support"
                />
              </div>

              {/* Price Chart */}
              {memo.priceData && memo.priceData.length > 0 && (
                <PriceChart data={memo.priceData} />
              )}

              {/* Detailed Thesis Bullet Points */}
              <div className="bg-surface-container border border-outline-variant p-6 rounded space-y-4">
                <h3 className="text-xs font-mono font-bold tracking-widest text-on-surface-variant uppercase border-b border-outline-variant pb-2">
                  Investment Thesis Drivers
                </h3>
                <ul className="space-y-3">
                  {memo.thesisPoints?.map((p: string, i: number) => (
                    <li key={i} className="text-xs text-on-surface leading-relaxed flex items-start gap-2.5">
                      <span className="text-primary font-mono text-[10px] mt-0.5 select-none">{`0${i + 1}`}</span>
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Key Risks */}
              <div className="bg-surface-container border border-outline-variant p-6 rounded space-y-4">
                <h3 className="text-xs font-mono font-bold tracking-widest text-on-surface-variant uppercase border-b border-outline-variant pb-2 text-error">
                  Key Structural Risks
                </h3>
                <ul className="space-y-3">
                  {memo.keyRisks?.map((r: string, i: number) => (
                    <li key={i} className="text-xs text-on-surface leading-relaxed flex items-start gap-2.5">
                      <span className="text-error font-mono text-[10px] mt-0.5 select-none">{`•`}</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Kill Criteria */}
              <div className="bg-surface-container border border-outline-variant p-6 rounded space-y-4">
                <h3 className="text-xs font-mono font-bold tracking-widest text-on-surface-variant uppercase border-b border-outline-variant pb-2 text-error">
                  Explicit Kill Criteria
                </h3>
                <p className="text-[11px] font-mono text-on-surface-variant italic mb-2 leading-relaxed">
                  The analysis will be considered invalidated and the Invest call immediately reversed to Pass if any of the following occur:
                </p>
                <ul className="space-y-3">
                  {memo.killCriteria?.map((kc: string, i: number) => (
                    <li key={i} className="text-xs text-on-surface leading-relaxed flex items-start gap-2.5 bg-surface-container-lowest/50 p-2.5 border border-error/20 rounded">
                      <span className="text-error font-mono text-[10px] mt-0.5 font-bold">{`CRIT-0${i + 1}`}</span>
                      <span>{kc}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Add to Portfolio Modal */}
      <AddHoldingModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => {
          // Success action
        }}
      />
    </div>
  );
}
