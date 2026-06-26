"use client";

import React, { useState, useEffect, useRef } from "react";

interface AddHoldingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddHoldingModal({ isOpen, onClose, onSuccess }: AddHoldingModalProps) {
  const [query, setQuery] = useState("");
  const [resolvedQuote, setResolvedQuote] = useState<{ symbol: string; name: string; exchange: string } | null>(null);
  const [amount, setAmount] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Click outside handler for suggestions dropdown
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch suggestions with debouncing
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
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  if (!isOpen) return null;

  const handleSelectSuggestion = (quote: any) => {
    setResolvedQuote({
      symbol: quote.symbol,
      name: quote.name,
      exchange: quote.exchange,
    });
    setQuery(`${quote.name} (${quote.symbol})`);
    setShowSuggestions(false);
  };

  const handleQuickAmount = (val: number) => {
    setAmount(String(val));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvedQuote || !amount) {
      setError("Please select a resolved company and specify an amount.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/holdings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: resolvedQuote.name,
          ticker: resolvedQuote.symbol,
          amountInvested: Number(amount),
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to add holding");
      }

      onSuccess();
      setQuery("");
      setResolvedQuote(null);
      setAmount("");
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save holding");
    } finally {
      setIsSubmitting(false);
    }
  };

  const quickAmounts = [25000, 50000, 100000, 250000];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div
        ref={wrapperRef}
        className="w-full max-w-md bg-surface-container border border-outline rounded p-6 shadow-2xl relative"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface text-lg font-mono"
        >
          ✕
        </button>

        <h2 className="text-base font-hanken font-bold tracking-wider text-on-surface border-b border-outline-variant pb-3 mb-5">
          ADD NEW HOLDING
        </h2>

        {error && (
          <div className="bg-error/15 border border-error text-error text-xs p-3 rounded mb-4 font-mono">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Company Search Input */}
          <div className="relative">
            <label className="block text-[10px] font-mono font-bold tracking-widest text-on-surface-variant uppercase mb-1.5">
              Company Name or Ticker
            </label>
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setShowSuggestions(true);
                if (resolvedQuote) setResolvedQuote(null); // Reset resolved if they edit
              }}
              onFocus={() => setShowSuggestions(true)}
              placeholder="e.g. Reliance or RELIANCE.NS"
              required
              className="w-full bg-surface-container-lowest border border-outline-variant rounded p-3 text-xs font-mono text-on-surface focus:outline-none focus:border-secondary transition-colors"
            />

            {/* Resolved ticker checkmark display */}
            {resolvedQuote && (
              <div className="mt-1.5 flex items-center gap-1.5">
                <span className="text-[10px] font-mono bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded font-bold uppercase">
                  {resolvedQuote.symbol} ✓
                </span>
                <span className="text-[10px] font-sans text-on-surface-variant truncate max-w-[240px]">
                  {resolvedQuote.name} ({resolvedQuote.exchange})
                </span>
              </div>
            )}

            {/* Autocomplete Suggestions */}
            {showSuggestions && suggestions.length > 0 && (
              <ul className="absolute z-10 w-full bg-surface-container-highest border border-outline rounded mt-1.5 max-h-48 overflow-y-auto shadow-xl">
                {suggestions.map((quote) => (
                  <li
                    key={quote.symbol}
                    onClick={() => handleSelectSuggestion(quote)}
                    className="p-3 text-xs font-mono border-b border-outline-variant/30 hover:bg-surface-container-low cursor-pointer flex justify-between items-center transition-colors"
                  >
                    <span className="font-semibold text-on-surface">{quote.name}</span>
                    <span className="text-secondary bg-secondary/10 px-1.5 py-0.5 rounded text-[10px]">
                      {quote.symbol}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {isResolving && (
              <div className="absolute right-3 top-[34px] text-[10px] font-mono text-primary animate-pulse">
                LOOKING UP...
              </div>
            )}
          </div>

          {/* Amount input */}
          <div>
            <label className="block text-[10px] font-mono font-bold tracking-widest text-on-surface-variant uppercase mb-1.5">
              Amount to Invest (₹)
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 100000"
              required
              min="1"
              className="w-full bg-surface-container-lowest border border-outline-variant rounded p-3 text-xs font-mono text-on-surface focus:outline-none focus:border-secondary transition-colors"
            />

            {/* Quick Amounts */}
            <div className="grid grid-cols-4 gap-2 mt-2">
              {quickAmounts.map((val) => (
                <button
                  type="button"
                  key={val}
                  onClick={() => handleQuickAmount(val)}
                  className="bg-surface-container-low border border-outline-variant hover:border-secondary py-1.5 px-1 rounded text-[10px] font-mono text-on-surface-variant hover:text-on-surface transition-all"
                >
                  ₹{(val / 1000).toFixed(0)}k
                </button>
              ))}
            </div>
          </div>

          {/* Preview Card */}
          {resolvedQuote && amount && (
            <div className="bg-surface-container-lowest border border-outline-variant/60 p-4 rounded text-xs space-y-1.5 font-mono">
              <div className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">
                PREVIEW
              </div>
              <div className="text-on-surface font-semibold truncate">
                {resolvedQuote.name}
              </div>
              <div className="flex justify-between items-center text-on-surface mt-1">
                <span>Amount:</span>
                <span className="font-bold text-primary">
                  ₹{Number(amount).toLocaleString("en-IN")}
                </span>
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="flex justify-end gap-3 pt-3 border-t border-outline-variant">
            <button
              type="button"
              onClick={onClose}
              className="bg-transparent border border-outline-variant hover:bg-surface-container-low px-4 py-2 rounded text-xs font-mono text-on-surface-variant hover:text-on-surface transition-colors"
            >
              CANCEL
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !resolvedQuote || !amount}
              className="bg-primary text-on-primary font-bold hover:bg-primary/95 disabled:bg-outline-variant disabled:text-on-surface-variant px-5 py-2 rounded text-xs font-mono transition-colors"
            >
              {isSubmitting ? "ADDING..." : "ADD TO PORTFOLIO"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
