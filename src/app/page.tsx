"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";

export default function LandingPage() {
  const router = useRouter();
  const supabase = createSupabaseBrowser();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGuestLoading, setIsGuestLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    // Redirect if already authenticated
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        router.push("/research");
      }
    });
  }, [supabase, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: isSignUp ? "sign-up" : "sign-in",
          email,
          password,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Authentication failed");
      }

      if (isSignUp) {
        setErrorMsg("Account created! Check your email for verification or sign in.");
        setIsSignUp(false);
      } else {
        router.push("/research");
        router.refresh();
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to log in.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleContinueAsGuest = async () => {
    setIsGuestLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "guest" }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to enter Guest Mode");
      }

      router.push("/research");
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to initialize guest session.");
    } finally {
      setIsGuestLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
      {/* Visual background details */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl -z-10" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/5 rounded-full blur-3xl -z-10" />

      <div className="w-full max-w-md bg-surface-container/70 border border-outline-variant/60 backdrop-blur-md p-8 rounded-xl shadow-2xl space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-primary rotate-45 mb-2 select-none">
            <span className="-rotate-45 font-hanken font-bold text-lg text-on-primary">P</span>
          </div>
          <h1 className="font-hanken font-bold text-3xl tracking-widest text-primary">
            PARAKHIQ
          </h1>
          <p className="text-xs font-mono text-on-surface-variant uppercase tracking-wider">
            Analytical Intelligence for Indian Equity Markets
          </p>
          <p className="text-[10px] font-mono text-error/80 uppercase">
            research tool, not financial advice
          </p>
        </div>

        {errorMsg && (
          <div className="bg-surface-container-low border border-outline text-xs p-3 rounded font-mono text-center">
            {errorMsg}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="block text-[10px] font-mono font-bold tracking-widest text-on-surface-variant uppercase">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full bg-surface-container-lowest border border-outline-variant rounded p-3 text-xs font-mono text-on-surface focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-[10px] font-mono font-bold tracking-widest text-on-surface-variant uppercase">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full bg-surface-container-lowest border border-outline-variant rounded p-3 text-xs font-mono text-on-surface focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-primary text-on-primary font-bold py-3 rounded text-xs font-mono tracking-widest hover:bg-primary/95 transition-all select-none cursor-pointer"
          >
            {isLoading ? "AUTHENTICATING..." : isSignUp ? "SIGN UP" : "SIGN IN"}
          </button>
        </form>

        {/* Separator / Switch auth type */}
        <div className="flex items-center justify-between text-xs font-mono text-on-surface-variant pt-2">
          <span>
            {isSignUp ? "Already have an account?" : "Need an account?"}
          </span>
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-secondary hover:underline bg-transparent border-0 cursor-pointer"
          >
            {isSignUp ? "SIGN IN" : "SIGN UP"}
          </button>
        </div>

        {/* Divider line */}
        <div className="relative flex py-2 items-center">
          <div className="flex-grow border-t border-outline-variant/30"></div>
          <span className="flex-shrink mx-4 text-[10px] font-mono text-on-surface-variant">OR</span>
          <div className="flex-grow border-t border-outline-variant/30"></div>
        </div>

        {/* Guest Mode */}
        <div className="space-y-3">
          <button
            onClick={handleContinueAsGuest}
            disabled={isGuestLoading}
            className="w-full bg-transparent border border-secondary text-secondary hover:bg-secondary/5 font-bold py-3 rounded text-xs font-mono tracking-widest transition-all cursor-pointer"
          >
            {isGuestLoading ? "SEEDING DEMO PORTFOLIO..." : "CONTINUE AS GUEST"}
          </button>
          <p className="text-[10px] text-center font-mono text-on-surface-variant leading-relaxed">
            Explore with a pre-loaded demo portfolio. No sign-up required.
          </p>
        </div>

        {/* Feature Highlights Footer */}
        <div className="border-t border-outline-variant/30 pt-4 grid grid-cols-2 gap-4 text-left">
          <div className="space-y-1">
            <div className="text-[10px] font-mono font-bold text-primary">AI RESEARCH PIPELINE</div>
            <div className="text-[10px] text-on-surface-variant leading-relaxed">
              Thesis generation challenged by disconfirming web searches.
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-[10px] font-mono font-bold text-secondary">PORTFOLIO TRACKING</div>
            <div className="text-[10px] text-on-surface-variant leading-relaxed">
              Extrapolated 1Y predictions and daily morning email digests.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
