"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { Nav } from "@/components/nav";
import { Disclaimer } from "@/components/disclaimer";
import { ReasoningStepper } from "@/components/reasoning-stepper";
import { VerdictBadge } from "@/components/verdict-badge";
import { KPICard } from "@/components/kpi-card";
import { PriceChart } from "@/components/price-chart";
import { AddHoldingModal } from "@/components/add-holding-modal";
import { ValuationChart } from "@/components/valuation-chart";

export default function ResearchPage() {
  const router = useRouter();
  const supabase = createSupabaseBrowser();

  const [query, setQuery] = useState("");
  const [profile, setProfile] = useState<"conservative" | "aggressive">("aggressive");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentNode, setCurrentNode] = useState("");
  const [logs, setLogs] = useState<string[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Autocomplete state
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Analysis result states
  const [memo, setMemo] = useState<any>(null);
  const [ticker, setTicker] = useState("");
  const [exchange, setExchange] = useState("");

  // Research history state
  const [history, setHistory] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);

  // Inline investment states
  const [investAmount, setInvestAmount] = useState("");
  const [isInvesting, setIsInvesting] = useState(false);
  const [investSuccessMsg, setInvestSuccessMsg] = useState<string | null>(null);
  const [investErrorMsg, setInvestErrorMsg] = useState<string | null>(null);
  const investFormRef = useRef<HTMLDivElement>(null);

  const fetchHistory = async () => {
    try {
      const res = await fetch("/api/research/history");
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch (err) {
      console.error("Failed to fetch research history:", err);
    }
  };

  // Auth check using session cache to avoid page transition lag
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        fetchHistory();
      } else {
        supabase.auth.getUser().then(({ data: { user } }) => {
          if (!user) {
            router.push("/");
          } else {
            setUser(user);
            fetchHistory();
          }
        });
      }
    });
  }, [supabase, router]);

  // Load last research from localStorage on mount
  useEffect(() => {
    try {
      const cached = localStorage.getItem("parakhiq_last_research");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.memo) {
          setMemo(parsed.memo);
          setTicker(parsed.ticker || "");
          setExchange(parsed.exchange || "");
          setCurrentNode(parsed.currentNode || "");
          setQuery(parsed.query || "");
          setLogs(parsed.logs || []);
        }
      }
    } catch (e) {
      console.error("Failed to load last research from cache:", e);
    }
  }, []);

  // Save last research to localStorage on changes
  useEffect(() => {
    if (memo) {
      try {
        localStorage.setItem(
          "parakhiq_last_research",
          JSON.stringify({
            memo,
            ticker,
            exchange,
            currentNode,
            query,
            logs,
          })
        );
      } catch (e) {
        console.error("Failed to save research state to cache:", e);
      }
    } else {
      localStorage.removeItem("parakhiq_last_research");
    }
  }, [memo, ticker, exchange, currentNode, query, logs]);

  // Click outside listener for autocomplete suggestions
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch autocomplete suggestions with debouncing
  useEffect(() => {
    if (query.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setIsResolving(true);
      try {
        const res = await fetch(`/api/research/resolve?query=${encodeURIComponent(query)}`);
        const data = await res.json();
        setSuggestions(data.quotes || []);
      } catch (err) {
        console.error("Autocomplete fetch error:", err);
      } finally {
        setIsResolving(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  const handleSelectSuggestion = (quote: any) => {
    setQuery(quote.symbol);
    setShowSuggestions(false);
  };

  const handleSelectHistoryItem = (item: any) => {
    setQuery(item.company_name);
    setTicker(item.ticker);
    setExchange(item.memo.exchange || "NSE");
    setMemo(item.memo);
    setCurrentNode("done");
    
    // Clear investment messages
    setInvestSuccessMsg(null);
    setInvestErrorMsg(null);
    setInvestAmount("");
  };

  const handleStartAnalysis = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsAnalyzing(true);
    setCurrentNode("intake");
    setLogs([]);
    setMemo(null);
    setTicker("");
    setExchange("");
    setInvestSuccessMsg(null);
    setInvestErrorMsg(null);
    setShowSuggestions(false);

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
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;

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
              fetchHistory(); // Refresh sidebar history
            } else if (eventType === "error") {
              setLogs((prev) => [...prev, `[ERROR] ${eventData.error}`]);
            }
          }
        }
      }
    } catch (err: any) {
      setLogs((prev) => [...prev, `[CRITICAL ERROR] ${err.message || err}`]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDeleteHistoryItem = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/research/history?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setHistory((prev) => prev.filter((item) => item.id !== id));
      }
    } catch (err) {
      console.error("Failed to delete history item:", err);
    }
  };

  const handleInlineInvest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memo || !investAmount) return;
    setIsInvesting(true);
    setInvestSuccessMsg(null);
    setInvestErrorMsg(null);

    try {
      const res = await fetch("/api/holdings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: memo.companyName || query,
          ticker: ticker,
          amountInvested: Number(investAmount),
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to add holding");
      }

      setInvestSuccessMsg(
        `Successfully added ₹${Number(investAmount).toLocaleString("en-IN")} of ${
          memo.companyName || query
        } to your tracked portfolio!`
      );
      setInvestAmount("");
    } catch (err: any) {
      setInvestErrorMsg(err.message || "Failed to add to portfolio.");
    } finally {
      setIsInvesting(false);
    }
  };

  const scrollToInvestForm = () => {
    investFormRef.current?.scrollIntoView({ behavior: "smooth" });
    const input = investFormRef.current?.querySelector("input");
    if (input) {
      input.focus();
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen pb-16 md:pb-0">
      <Disclaimer />
      <Nav />

      <main className="flex-grow max-w-7xl w-full mx-auto p-4 md:p-6 space-y-6">
        {/* Terminal Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-surface-container border border-outline-variant p-4 rounded">
          <div className="space-y-1">
            <h1 className="font-hanken font-bold text-lg text-on-surface">AI RESEARCH TERMINAL</h1>
            <p className="text-xs font-mono text-on-surface-variant uppercase">
              Indian-Market First Equity Thesis Engine & Critic
            </p>
          </div>
          {/* Intake inputs form - always visible, fields disabled during active analysis */}
          <form onSubmit={handleStartAnalysis} className="w-full md:w-auto flex flex-col md:flex-row gap-3 relative">
            <div ref={searchContainerRef} className="relative flex-grow">
              <input
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                placeholder="e.g. Reliance or RELIANCE.NS"
                required
                disabled={isAnalyzing}
                className="bg-surface-container-lowest border border-outline-variant rounded px-3 py-2 text-xs font-mono text-on-surface focus:outline-none focus:border-primary min-w-[220px] disabled:opacity-60"
              />

              {/* Autocomplete Suggestions */}
              {showSuggestions && suggestions.length > 0 && !isAnalyzing && (
                <ul className="absolute z-50 left-0 top-full mt-1.5 w-full bg-surface-container-highest border border-outline-variant rounded max-h-48 overflow-y-auto shadow-xl">
                  {suggestions.map((quote) => (
                    <li
                      key={quote.symbol}
                      onClick={() => handleSelectSuggestion(quote)}
                      className="p-2.5 text-[11px] font-mono border-b border-outline-variant/30 hover:bg-surface-container-low cursor-pointer flex justify-between items-center text-on-surface transition-colors"
                    >
                      <span className="font-semibold truncate max-w-[130px]">{quote.name}</span>
                      <span className="text-secondary bg-secondary/10 px-1.5 py-0.5 rounded text-[9px] font-bold">
                        {quote.symbol}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {isResolving && (
                <div className="absolute right-3 top-2.5 text-[9px] font-mono text-primary animate-pulse">
                  ...
                </div>
              )}
            </div>

            <select
              value={profile}
              onChange={(e) => setProfile(e.target.value as any)}
              disabled={isAnalyzing}
              className="bg-surface-container-lowest border border-outline-variant rounded px-3 py-2 text-xs font-mono text-on-surface focus:outline-none focus:border-primary disabled:opacity-60"
            >
              <option value="aggressive">AGGRESSIVE / SHORT-HORIZON</option>
              <option value="conservative">CONSERVATIVE / LONG-HORIZON</option>
            </select>

            <button
              type="submit"
              disabled={isAnalyzing}
              className="bg-primary text-on-primary font-bold px-5 py-2 rounded text-xs font-mono tracking-widest hover:bg-primary/95 transition-colors cursor-pointer disabled:opacity-50"
            >
              {isAnalyzing ? "ANALYZING..." : "RUN RESEARCH"}
            </button>
            {memo && !isAnalyzing && (
              <button
                type="button"
                onClick={() => {
                  setCurrentNode("");
                  setMemo(null);
                  setQuery("");
                  setTicker("");
                  setExchange("");
                  setLogs([]);
                }}
                className="bg-surface-container-high border border-outline-variant hover:bg-surface-container-highest px-4 py-2 rounded text-xs font-mono text-on-surface transition-colors cursor-pointer"
              >
                RESET
              </button>
            )}
          </form>
        </div>

        {/* Content Layout: 1/4 Left Sidebar for History, 3/4 Main Area */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Sidebar (Past Runs) */}
          <div className="lg:col-span-1 bg-surface-container border border-outline-variant p-4 rounded flex flex-col h-fit lg:max-h-[calc(100vh-180px)] overflow-y-auto space-y-4">
            <div className="flex justify-between items-center border-b border-outline-variant pb-2">
              <span className="text-[10px] font-mono font-bold tracking-widest text-on-surface-variant uppercase">
                Terminal History
              </span>
              <span className="text-[9px] font-mono text-primary font-bold">SAVED</span>
            </div>

            {history.length === 0 ? (
              <div className="text-[10px] font-mono text-on-surface-variant italic py-4 text-center">
                No past runs recorded.
              </div>
            ) : (
              <div className="space-y-2">
                {history.map((run) => (
                  <div key={run.id} className="relative group w-full">
                    <button
                      onClick={() => handleSelectHistoryItem(run)}
                      className="w-full text-left bg-surface-container-lowest hover:bg-surface-container-low border border-outline-variant/60 hover:border-outline p-2.5 rounded font-mono text-xs transition-all flex flex-col gap-1 cursor-pointer"
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-on-surface group-hover:text-primary truncate max-w-[100px]">
                          {run.ticker}
                        </span>
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded uppercase font-bold ${
                            run.verdict.toLowerCase() === "invest"
                              ? "bg-primary/10 text-primary border border-primary/20"
                              : "bg-error/10 text-error border border-error/20"
                          }`}
                        >
                          {run.verdict}
                        </span>
                      </div>
                      <div className="text-[10px] text-on-surface-variant truncate pr-6">
                        {run.company_name}
                      </div>
                      <div className="text-[8px] text-on-surface-variant/70 text-right pt-1 mt-1 border-t border-outline-variant/10">
                        {new Date(run.created_at).toLocaleDateString("en-IN", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </button>
                    <button
                      onClick={(e) => handleDeleteHistoryItem(e, run.id)}
                      title="Delete from history"
                      className="absolute bottom-1.5 left-2 p-1 text-on-surface-variant/50 hover:text-error hover:bg-error/10 rounded transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18"></path>
                        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Main Area */}
          <div className="lg:col-span-3 space-y-6">
            {/* Stepper Timeline & Active Logger */}
            {(isAnalyzing || (currentNode && currentNode !== "done")) && (
              <div
                className={`bg-surface-container border border-outline-variant p-6 rounded ${
                  currentNode === "done" ? "" : "w-full"
                }`}
              >
                <ReasoningStepper currentNode={currentNode} logs={logs} />

                {currentNode === "done" && (
                  <div className="mt-6 pt-6 border-t border-outline-variant flex flex-col md:flex-row gap-3">
                    <button
                      onClick={() => {
                        setCurrentNode("");
                        setMemo(null);
                        setQuery("");
                      }}
                      className="flex-1 bg-surface-container-low hover:bg-surface-container-high border border-outline-variant py-2.5 rounded text-xs font-mono text-on-surface transition-colors"
                    >
                      RUN NEW ANALYSIS
                    </button>
                    <button
                      onClick={() => setIsAddModalOpen(true)}
                      className="flex-1 bg-primary text-on-primary font-bold py-2.5 rounded text-xs font-mono tracking-wider hover:bg-primary/95 transition-colors"
                    >
                      ADD TO PORTFOLIO (MANUAL)
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Initial Search Guide */}
            {!isAnalyzing && !currentNode && (
              <div className="bg-surface-container border border-outline-variant p-8 rounded text-center space-y-4">
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
              <div className="space-y-6">
                {/* Verdict Summary Card */}
                <div className="bg-surface-container border border-outline-variant p-6 rounded space-y-4">
                  <div className="flex flex-wrap justify-between items-center gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-mono bg-secondary/15 text-secondary border border-secondary/20 px-2.5 py-0.5 rounded uppercase font-bold select-all">
                          {ticker || "RELIANCE.NS"}
                        </span>
                        <span className="text-xs font-mono text-on-surface-variant">{exchange || "NSE"}</span>
                        {memo.kpis?.currentPrice && memo.kpis.currentPrice !== "unavailable" && (
                          <span className="text-[10px] font-mono bg-primary/15 text-primary border border-primary/20 px-2 py-0.5 rounded font-bold">
                            Live Price: {memo.kpis.currentPrice}
                          </span>
                        )}
                      </div>
                      <h2 className="text-base font-hanken font-bold text-on-surface mt-1.5">
                        {memo.companyName || query}
                      </h2>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-[10px] font-mono text-on-surface-variant uppercase">Confidence</div>
                        <div className="text-sm font-mono font-bold text-primary">{memo.confidence}%</div>
                      </div>
                      <button
                        onClick={scrollToInvestForm}
                        className="hover:opacity-90 active:scale-95 transition-all bg-transparent border-0 cursor-pointer"
                        title="Click to scroll to invest form"
                      >
                        <VerdictBadge verdict={memo.verdict} size="lg" />
                      </button>
                    </div>
                  </div>

                  {/* Confidence bar */}
                  <div className="w-full h-1 bg-surface-container-low rounded-full overflow-hidden border border-outline-variant/30">
                    <div
                      className={`h-full ${memo.verdict === "Invest" ? "bg-primary" : "bg-error"}`}
                      style={{ width: `${memo.confidence}%` }}
                    />
                  </div>

                  <p className="text-xs text-on-surface leading-relaxed border-t border-outline-variant/30 pt-4 pb-2">
                    {memo.summary}
                  </p>

                  {/* Integrated Inline Investment Form */}
                  <div
                    ref={investFormRef}
                    className="bg-surface-container-lowest border border-outline-variant/50 p-4 rounded space-y-3 pt-4 mt-2"
                  >
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-mono font-bold tracking-widest text-on-surface-variant uppercase">
                        Quick Deposit (Add to Tracked Portfolio)
                      </label>
                      <span className="text-[9px] font-mono text-primary font-bold">1-CLICK TRACKING</span>
                    </div>

                    {investSuccessMsg && (
                      <div className="bg-primary/10 border border-primary/20 text-primary text-xs p-2.5 rounded font-mono text-center">
                        [STATUS] {investSuccessMsg}
                      </div>
                    )}
                    {investErrorMsg && (
                      <div className="bg-error/10 border border-error/20 text-error text-xs p-2.5 rounded font-mono text-center">
                        [ERROR] {investErrorMsg}
                      </div>
                    )}

                    <form onSubmit={handleInlineInvest} className="flex gap-2">
                      <div className="relative flex-grow">
                        <span className="absolute left-3 top-2.5 text-xs text-on-surface-variant font-mono">₹</span>
                        <input
                          type="number"
                          value={investAmount}
                          onChange={(e) => setInvestAmount(e.target.value)}
                          placeholder="Amount in Rupees (e.g. 100000)"
                          min="1"
                          required
                          className="w-full bg-surface-container border border-outline-variant rounded py-2 pl-7 pr-3 text-xs font-mono text-on-surface focus:outline-none focus:border-primary transition-colors"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={isInvesting || !investAmount}
                        className="bg-primary hover:bg-primary/95 text-on-primary font-bold px-4 py-2 rounded text-xs font-mono tracking-wider transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        {isInvesting ? "ADDING..." : "INVEST NOW"}
                      </button>
                    </form>

                    <div className="grid grid-cols-4 gap-2">
                      {[25000, 50000, 100000, 250000].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setInvestAmount(String(val))}
                          className="bg-surface-container-low border border-outline-variant hover:border-primary py-1.5 px-1 rounded text-[10px] font-mono text-on-surface-variant hover:text-on-surface transition-all cursor-pointer"
                        >
                          ₹{(val / 1000).toFixed(0)}k
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* KPI Cards Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <KPICard
                    label="P/E Ratio"
                    value={memo.kpis.peRatio}
                    subValue={
                      memo.kpis.peSectorRatio !== "unavailable"
                        ? `VS SECTOR ${memo.kpis.peSectorRatio}`
                        : "Sector PE N/A"
                    }
                    trend={
                      memo.kpis.peRatio !== "unavailable" && memo.kpis.peSectorRatio !== "unavailable"
                        ? Number(memo.kpis.peRatio) <= Number(memo.kpis.peSectorRatio)
                          ? "up"
                          : "down"
                        : "none"
                    }
                  />
                  <KPICard label="Market Cap" value={memo.kpis.marketCap} subValue="INR" />
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
                    trend={
                      memo.kpis.promoterHolding.includes("↑")
                        ? "up"
                        : memo.kpis.promoterHolding.includes("↓")
                        ? "down"
                        : "none"
                    }
                  />
                  <KPICard label="52W High" value={memo.kpis.fiftyTwoWeekHigh} subValue="Resistance" />
                  <KPICard label="52W Low" value={memo.kpis.fiftyTwoWeekLow} subValue="Support" />
                </div>

                {/* Price History Line Chart */}
                {memo.priceData && memo.priceData.length > 0 && <PriceChart data={memo.priceData} currencySymbol={memo.kpis.currentPrice?.includes("$") || memo.kpis.marketCap?.includes("$") ? "$" : "₹"} />}

                {/* Valuation & Profitability Comparison Bar Charts */}
                <ValuationChart
                  ticker={ticker}
                  companyName={memo.companyName || query}
                  peRatio={memo.kpis.peRatio}
                  peSector={memo.kpis.peSectorRatio}
                />

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
                    The analysis will be considered invalidated and the Invest call immediately reversed to Pass if
                    any of the following occur:
                  </p>
                  <ul className="space-y-3">
                    {memo.killCriteria?.map((kc: string, i: number) => (
                      <li
                        key={i}
                        className="text-xs text-on-surface leading-relaxed flex items-start gap-2.5 bg-surface-container-lowest/50 p-2.5 border border-error/20 rounded"
                      >
                        <span className="text-error font-mono text-[10px] mt-0.5 font-bold">{`CRIT-0${i + 1}`}</span>
                        <span>{kc}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
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
