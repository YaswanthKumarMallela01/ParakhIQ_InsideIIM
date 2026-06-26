"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { Nav } from "@/components/nav";
import { Disclaimer } from "@/components/disclaimer";
import { KPICard } from "@/components/kpi-card";
import { SentimentBar } from "@/components/sentiment-bar";
import { PredictionRange } from "@/components/prediction-range";
import { AddHoldingModal } from "@/components/add-holding-modal";

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
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push("/");
      } else {
        setUser(user);
        fetchHoldings();
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

    // If guest mode, ask them what email to send the report to!
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

  // Calculate totals
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
                      <div className="text-[10px] font-mono text-on-surface-variant uppercase">
                        Tracked Amount
                      </div>
                      <div className="text-base font-mono font-bold text-on-surface">
                        ₹{Number(holding.amount_invested).toLocaleString("en-IN")}
                      </div>
                      <button
                        onClick={() => handleRemoveHolding(holding.id)}
                        className="text-[10px] font-mono text-error hover:underline bg-transparent border-0 cursor-pointer pt-1"
                      >
                        REMOVE FROM TRACKER
                      </button>
                    </div>
                  </div>

                  {/* Prediction Section */}
                  {pred ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-outline-variant/30 pt-4">
                      <PredictionRange
                        rangeLow={pred.range_low}
                        rangeHigh={pred.range_high}
                        midpoint={pred.midpoint}
                        guidance={pred.guidance}
                      />
                      <SentimentBar score={pred.score} />
                    </div>
                  ) : (
                    <div className="text-center py-6 font-mono text-xs text-on-surface-variant border-t border-outline-variant/30 pt-4 animate-pulse">
                      CALCULATING PREDICTIONS...
                    </div>
                  )}
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
