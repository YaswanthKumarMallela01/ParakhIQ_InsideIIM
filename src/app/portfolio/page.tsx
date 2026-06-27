"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { Nav } from "@/components/nav";
import { Disclaimer } from "@/components/disclaimer";
import { KPICard } from "@/components/kpi-card";
import { AddHoldingModal } from "@/components/add-holding-modal";
import { PriceChart } from "@/components/price-chart";

export default function PortfolioPage() {
  const router = useRouter();
  const supabase = createSupabaseBrowser();

  const [holdings, setHoldings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDigestLoading, setIsDigestLoading] = useState(false);
  const [digestMessage, setDigestMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [user, setUser] = useState<any>(null);

  const fetchHoldings = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/holdings");
      const data = await res.json();
      if (res.ok && !data.error) {
        setHoldings(data);
      }
    } catch (err) {
      console.error("Failed to fetch holdings:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        fetchHoldings();
      } else {
        supabase.auth.getUser().then(({ data: { user } }) => {
          if (!user) {
            router.push("/");
          } else {
            setUser(user);
            fetchHoldings();
          }
        });
      }
    });
  }, [supabase, router]);

  const handleRemoveHolding = async (id: string) => {
    if (!confirm("Are you sure you want to remove this holding from your tracking list?")) return;

    try {
      const res = await fetch(`/api/holdings?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchHoldings();
      }
    } catch (err) {
      console.error("Failed to remove holding:", err);
    }
  };

  const handleSendDigestNow = async () => {
    setIsDigestLoading(true);
    setDigestMessage(null);

    let emailInput = "";
    if (isGuest) {
      const email = prompt("Enter your email address to receive the test digest:");
      if (!email) {
        setIsDigestLoading(false);
        return;
      }
      emailInput = email;
    }

    try {
      const res = await fetch("/api/digest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailInput }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setDigestMessage({ type: "success", text: data.message });
      } else {
        setDigestMessage({ type: "error", text: data.error || data.message || "Failed to send email." });
      }
    } catch (err: any) {
      setDigestMessage({ type: "error", text: err.message || "Email request failed." });
    } finally {
      setIsDigestLoading(false);
    }
  };

  const isGuest = user?.is_anonymous || user?.email?.startsWith("guest_");
  const totalInvested = holdings.reduce((sum, h) => sum + Number(h.amount_invested), 0);
  const holdingsCount = holdings.length;

  return (
    <div className="flex-1 flex flex-col min-h-screen pb-16 md:pb-0">
      <Disclaimer />
      <Nav />

      <main className="flex-grow max-w-6xl w-full mx-auto p-4 md:p-6 space-y-6">
        {/* Guest Warning Banner if Guest Mode */}
        {isGuest && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 p-4 rounded flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="space-y-1">
              <span className="text-xs font-mono font-bold text-yellow-500 uppercase tracking-widest">
                GUEST SESSION ACTIVE
              </span>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                You are currently exploring as a guest with seed data. Sign up with email/password in Settings to enable permanent portfolio tracking and morning email digests.
              </p>
            </div>
            <button
              onClick={() => router.push("/settings")}
              className="bg-yellow-500 text-black font-bold font-mono text-[11px] tracking-wider py-1.5 px-3 rounded hover:bg-yellow-400 cursor-pointer select-none"
            >
              SIGN UP NOW
            </button>
          </div>
        )}

        {/* Dashboard Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-surface-container border border-outline-variant p-4 rounded">
          <div className="space-y-1">
            <h1 className="font-hanken font-bold text-lg text-on-surface">MY PORTFOLIO TRACKER</h1>
            <p className="text-xs font-mono text-on-surface-variant uppercase">
              Current Holdings & Directional Predictions
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleSendDigestNow}
              disabled={isDigestLoading || holdingsCount === 0}
              className="bg-transparent border border-secondary text-secondary hover:bg-secondary/5 font-bold py-2 px-4 rounded text-xs font-mono tracking-widest disabled:opacity-50 transition-all cursor-pointer"
            >
              {isDigestLoading ? "SENDING DIGEST..." : "SEND ME A DIGEST NOW"}
            </button>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="bg-primary text-on-primary font-bold py-2 px-4 rounded text-xs font-mono tracking-widest hover:bg-primary/95 transition-all cursor-pointer"
            >
              ADD NEW HOLDING
            </button>
          </div>
        </div>

        {digestMessage && (
          <div
            className={`border text-xs p-3 rounded font-mono ${
              digestMessage.type === "success"
                ? "bg-primary/10 border-primary/30 text-primary"
                : "bg-error/10 border-error/30 text-error"
            }`}
          >
            {digestMessage.text}
          </div>
        )}

        {/* Portfolio Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <KPICard
            label="Total Amount Tracked"
            value={`₹${totalInvested.toLocaleString("en-IN")}`}
            subValue="INTENDED INVESTMENT"
          />
          <KPICard
            label="Tracked Holdings"
            value={holdingsCount}
            subValue="ACTIVE STOCKS"
          />
          <KPICard
            label="Daily Email Digest"
            value={isGuest ? "DISABLED" : "ENABLED"}
            subValue={isGuest ? "GUEST SESSIONS RUN ON-DEMAND ONLY" : "DAILY AT ~7:30 AM IST"}
          />
        </div>

        {/* Holdings List */}
        {isLoading ? (
          <div className="w-full text-center py-12 font-mono text-xs text-on-surface-variant animate-pulse">
            LOADING HOLDINGS...
          </div>
        ) : holdingsCount === 0 ? (
          <div className="bg-surface-container border border-outline-variant p-12 rounded text-center space-y-3">
            <span className="text-xl">💼</span>
            <h3 className="font-hanken font-bold text-sm text-on-surface">NO HOLDINGS TRACKED</h3>
            <p className="text-xs text-on-surface-variant max-w-sm mx-auto leading-relaxed">
              Your portfolio is currently empty. Click "Add New Holding" or run stock research first to populate your dashboard.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {holdings.map((holding) => {
              const pred = holding.latestPrediction;
              const isGain = holding.gain_loss >= 0;
              const curr = holding.currencySymbol || "₹";
              const locale = curr === "$" ? "en-US" : "en-IN";

              return (
                <div
                  key={holding.id}
                  className="bg-surface-container border border-outline-variant rounded p-6 space-y-4 hover:border-primary/50 transition-colors"
                >
                  {/* Holding Header */}
                  <div className="flex justify-between items-start flex-wrap gap-3">
                    <div>
                      <span className="text-[10px] font-mono bg-secondary/15 text-secondary border border-secondary/20 px-2.5 py-0.5 rounded font-semibold uppercase mr-2">
                        {holding.ticker}
                      </span>
                      <h3 className="text-base font-hanken font-bold text-on-surface mt-1.5 inline-block">
                        {holding.company}
                      </h3>
                      <div className="text-[11px] font-mono text-on-surface-variant mt-1">
                        Added at: {new Date(holding.added_at).toLocaleDateString("en-IN")}
                      </div>
                    </div>

                    <div className="text-right flex flex-col items-end gap-2">
                      <div className="flex items-center gap-1 text-[10px] font-mono text-on-surface-variant uppercase justify-end">
                        <span>Intended Investment</span>
                        <span
                          className="text-secondary text-[10px] cursor-help font-bold select-none"
                          title={`The total amount of ${curr === "$" ? "Dollars" : "Rupees"} you plan to invest in this stock.`}
                        >
                          [i]
                        </span>
                      </div>
                      <div className="text-base font-mono font-bold text-on-surface">
                        {curr}{Number(holding.amount_invested).toLocaleString(locale)}
                      </div>
                      <button
                        onClick={() => handleRemoveHolding(holding.id)}
                        className="text-[10px] font-mono text-error hover:underline bg-transparent border-0 cursor-pointer pt-1"
                      >
                        REMOVE FROM TRACKER
                      </button>
                    </div>
                  </div>

                  {/* Upgraded Values & Graph layout */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-outline-variant/30 pt-4">
                    {/* Left Column: Key Values with explaining [i] tooltips */}
                    <div className="grid grid-cols-2 gap-4">
                      {/* Invested Price */}
                      <div className="bg-surface-container-low border border-outline-variant/40 p-3 rounded space-y-1">
                        <div className="flex items-center gap-1 text-[10px] font-mono font-bold tracking-widest text-on-surface-variant uppercase">
                          <span>Invested Price</span>
                          <span
                            className="text-secondary text-[9px] cursor-help font-bold select-none"
                            title="The price of the stock on the day you added it to your tracker."
                          >
                            [i]
                          </span>
                        </div>
                        <div className="text-sm font-mono font-bold text-on-surface">
                          {curr}{holding.purchase_price.toLocaleString(locale)}
                        </div>
                      </div>

                      {/* Price Today */}
                      <div className="bg-surface-container-low border border-outline-variant/40 p-3 rounded space-y-1">
                        <div className="flex items-center gap-1 text-[10px] font-mono font-bold tracking-widest text-on-surface-variant uppercase">
                          <span>Price Today</span>
                          <span
                            className="text-secondary text-[9px] cursor-help font-bold select-none"
                            title="The latest market trading price of this stock fetched live."
                          >
                            [i]
                          </span>
                        </div>
                        <div className="text-sm font-mono font-bold text-primary">
                          {curr}{holding.current_price.toLocaleString(locale)}
                        </div>
                      </div>

                      {/* Tracked Shares */}
                      <div className="bg-surface-container-low border border-outline-variant/40 p-3 rounded space-y-1">
                        <div className="flex items-center gap-1 text-[10px] font-mono font-bold tracking-widest text-on-surface-variant uppercase">
                          <span>Tracked Shares</span>
                          <span
                            className="text-secondary text-[9px] cursor-help font-bold select-none"
                            title="The equivalent shares, calculated as: Intended Investment / Invested Price."
                          >
                            [i]
                          </span>
                        </div>
                        <div className="text-sm font-mono font-bold text-on-surface">
                          {holding.shares}
                        </div>
                      </div>

                      {/* Current Value */}
                      <div className="bg-surface-container-low border border-outline-variant/40 p-3 rounded space-y-1">
                        <div className="flex items-center gap-1 text-[10px] font-mono font-bold tracking-widest text-on-surface-variant uppercase">
                          <span>Current Value</span>
                          <span
                            className="text-secondary text-[9px] cursor-help font-bold select-none"
                            title="The current valuation of your tracked holding: Tracked Shares * Price Today."
                          >
                            [i]
                          </span>
                        </div>
                        <div className="text-sm font-mono font-bold text-on-surface">
                          {curr}{holding.current_value.toLocaleString(locale)}
                        </div>
                      </div>

                      {/* Total P&L Gain/Loss */}
                      <div className="col-span-2 bg-surface-container-low border border-outline-variant/40 p-3 rounded space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1 text-[10px] font-mono font-bold tracking-widest text-on-surface-variant uppercase">
                            <span>Total Gain / Loss</span>
                            <span
                              className="text-secondary text-[9px] cursor-help font-bold select-none"
                              title="The absolute and percentage returns between the current valuation and your invested amount."
                            >
                              [i]
                            </span>
                          </div>
                          <span className={`text-xs font-mono font-bold ${isGain ? "text-primary" : "text-error"}`}>
                            {holding.gain_loss_percent >= 0 ? "+" : ""}{holding.gain_loss_percent}%
                          </span>
                        </div>
                        <div className={`text-base font-mono font-bold ${isGain ? "text-primary" : "text-error"}`}>
                          {isGain ? "+" : ""}{curr}{holding.gain_loss.toLocaleString(locale)}
                        </div>
                      </div>

                      {/* Advisory suggestion note */}
                      {pred && (
                        <div className="col-span-2 bg-surface-container-lowest border border-outline-variant/30 p-2.5 rounded font-mono text-[10px] text-on-surface-variant flex items-center justify-between">
                          <div className="flex items-center gap-1 uppercase font-bold text-on-surface-variant">
                            <span>[Model Advisory Guidance]</span>
                            <span
                              className="text-secondary text-[9px] cursor-help font-bold select-none"
                              title="A suggestion calculated by extrapolating the 1Y linear price slope and news sentiment."
                            >
                              [i]
                            </span>
                          </div>
                          <span className={`px-2 py-0.5 border rounded uppercase font-bold text-[9px] ${
                            pred.guidance.includes("hold") || pred.guidance.includes("accumulate")
                              ? "bg-primary/10 text-primary border-primary/20"
                              : pred.guidance.includes("reduce") || pred.guidance.includes("sell")
                              ? "bg-error/10 text-error border-error/20"
                              : "bg-secondary/10 text-secondary border-secondary/20"
                          }`}>
                            {pred.guidance}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Right Column: Price Trend Line Chart */}
                    <div className="flex flex-col justify-between">
                      {holding.priceHistory && holding.priceHistory.length > 0 ? (
                        <PriceChart data={holding.priceHistory} height={180} currencySymbol={curr} />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-surface-container-low border border-outline-variant rounded font-mono text-xs text-on-surface-variant min-h-[180px]">
                          Fetching live price trend data...
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Add Holding Modal */}
      <AddHoldingModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={fetchHoldings}
      />
    </div>
  );
}
