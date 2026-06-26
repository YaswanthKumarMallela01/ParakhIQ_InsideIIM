"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { Nav } from "@/components/nav";
import { Disclaimer } from "@/components/disclaimer";

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createSupabaseBrowser();

  const [user, setUser] = useState<any>(null);
  const [emailDigestEnabled, setEmailDigestEnabled] = useState(true);
  const [profile, setProfile] = useState<"conservative" | "aggressive">("aggressive");
  const [isLoading, setIsLoading] = useState(true);

  // Upgrade guest states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchSettings = async (currentUser: any) => {
    setIsLoading(true);
    try {
      // 1. Fetch email digest preference
      const res = await fetch("/api/preferences");
      const data = await res.json();
      if (res.ok && !data.error) {
        setEmailDigestEnabled(data.email_digest_enabled);
      }

      // 2. Fetch locally stored investor profile selection or default to aggressive
      const savedProfile = localStorage.getItem(`profile_${currentUser.id}`) as any;
      if (savedProfile === "conservative" || savedProfile === "aggressive") {
        setProfile(savedProfile);
      }
    } catch (err) {
      console.error("Failed to load settings:", err);
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
        fetchSettings(user);
      }
    });
  }, [supabase, router]);

  const handleToggleDigest = async (val: boolean) => {
    if (user?.is_anonymous) {
      alert("Email digests are disabled in Guest Mode. Please sign up to enable this feature.");
      return;
    }

    setEmailDigestEnabled(val);
    try {
      await fetch("/api/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email_digest_enabled: val }),
      });
    } catch (err) {
      console.error("Failed to update preferences:", err);
    }
  };

  const handleProfileSelection = (selected: "conservative" | "aggressive") => {
    setProfile(selected);
    if (user) {
      localStorage.setItem(`profile_${user.id}`, selected);
    }
  };

  const handleUpgradeAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setUpgradeLoading(true);
    setMessage(null);

    try {
      // Sign up the guest user to a permanent account
      // In Supabase, linking an anonymous session is supported by signUp()
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) throw error;

      // Transfer preferences
      await fetch("/api/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email_digest_enabled: true }),
      });

      setMessage({
        type: "success",
        text: "Account upgraded successfully! You are now logged in and email digests are active.",
      });
      
      // Fetch new user session details
      const { data: { user: updatedUser } } = await supabase.auth.getUser();
      setUser(updatedUser);
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to upgrade account." });
    } finally {
      setUpgradeLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen pb-16 md:pb-0">
      <Disclaimer />
      <Nav />

      <main className="flex-grow max-w-3xl w-full mx-auto p-4 md:p-6 space-y-6">
        {/* Settings Header */}
        <div className="bg-surface-container border border-outline-variant p-4 rounded space-y-1">
          <h1 className="font-hanken font-bold text-lg text-on-surface">ACCOUNT & PREFERENCES</h1>
          <p className="text-xs font-mono text-on-surface-variant uppercase">
            Manage Investment Profile & Email Subscriptions
          </p>
        </div>

        {isLoading ? (
          <div className="w-full text-center py-12 font-mono text-xs text-on-surface-variant animate-pulse">
            LOADING SETTINGS...
          </div>
        ) : (
          <div className="space-y-6">
            {/* Guest Banner if Anonymous */}
            {user?.is_anonymous && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 p-6 rounded-xl space-y-4">
                <div className="space-y-1">
                  <h3 className="text-xs font-mono font-bold text-yellow-500 uppercase tracking-widest">
                    GUEST SESSION ACTIVE
                  </h3>
                  <p className="text-xs text-on-surface-variant leading-relaxed">
                    Recruiter warning: you are in Guest Mode. Upgrading to a permanent account unlocks the scheduled daily morning digests (running automatically at ~7:30 AM IST).
                  </p>
                </div>

                {message && (
                  <div
                    className={`border text-xs p-3 rounded font-mono ${
                      message.type === "success"
                        ? "bg-primary/10 border-primary/30 text-primary"
                        : "bg-error/10 border-error/30 text-error"
                    }`}
                  >
                    {message.text}
                  </div>
                )}

                <form onSubmit={handleUpgradeAccount} className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <input
                    type="email"
                    placeholder="Enter email to upgrade"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="bg-surface-container-lowest border border-outline-variant rounded p-2.5 text-xs font-mono text-on-surface focus:outline-none focus:border-yellow-500"
                  />
                  <input
                    type="password"
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="bg-surface-container-lowest border border-outline-variant rounded p-2.5 text-xs font-mono text-on-surface focus:outline-none focus:border-yellow-500"
                  />
                  <button
                    type="submit"
                    disabled={upgradeLoading}
                    className="sm:col-span-2 bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-2.5 rounded text-xs font-mono tracking-widest cursor-pointer select-none transition-colors"
                  >
                    {upgradeLoading ? "UPGRADING..." : "UPGRADE TO PERMANENT ACCOUNT"}
                  </button>
                </form>
              </div>
            )}

            {/* Email Digest Settings */}
            <div className="bg-surface-container border border-outline-variant p-6 rounded-xl space-y-4">
              <h3 className="text-xs font-mono font-bold tracking-widest text-on-surface-variant uppercase border-b border-outline-variant pb-2">
                Daily Morning Digest
              </h3>
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-xs font-semibold text-on-surface">Email Updates</div>
                  <p className="text-[11px] text-on-surface-variant leading-relaxed">
                    Receive a consolidated daily email digest of your holdings at ~7:30 AM IST. Includes guidance updates (hold/reconsider/reduce) and range predictions.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-[9px] font-mono font-bold border px-2 py-0.5 rounded ${
                      emailDigestEnabled && !user?.is_anonymous
                        ? "text-primary border-primary bg-primary/10"
                        : "text-on-surface-variant border-outline-variant"
                    }`}
                  >
                    {emailDigestEnabled && !user?.is_anonymous ? "ENABLED" : "DISABLED"}
                  </span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={emailDigestEnabled && !user?.is_anonymous}
                      disabled={user?.is_anonymous}
                      onChange={(e) => handleToggleDigest(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-surface-container-lowest peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-on-surface-variant after:border-outline-variant after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:bg-primary peer-checked:bg-primary/20 border border-outline-variant"></div>
                  </label>
                </div>
              </div>
            </div>

            {/* Investor Profile Configuration */}
            <div className="bg-surface-container border border-outline-variant p-6 rounded-xl space-y-4">
              <h3 className="text-xs font-mono font-bold tracking-widest text-on-surface-variant uppercase border-b border-outline-variant pb-2">
                Default Investor Profile
              </h3>
              <p className="text-[11px] text-on-surface-variant leading-relaxed">
                Configure your risk appetite and investment horizon. The agent's thesis review, final verdict weighting, and narrative reasoning adapt dynamically to this choice.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
                {/* Conservative */}
                <div
                  onClick={() => handleProfileSelection("conservative")}
                  className={`p-4 border rounded-lg cursor-pointer bg-surface-container-lowest transition-all hover:border-primary ${
                    profile === "conservative"
                      ? "border-primary ring-1 ring-primary/20"
                      : "border-outline-variant/60"
                  }`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-mono font-bold text-on-surface">CONSERVATIVE</span>
                    {profile === "conservative" && <span className="text-[10px] font-mono text-primary">SELECTED</span>}
                  </div>
                  <p className="text-[11px] text-on-surface-variant leading-relaxed">
                    Long-horizon (3-5 years). Focuses heavily on balance sheet safety, low debt, valuation multiples, and margins of safety.
                  </p>
                </div>

                {/* Aggressive */}
                <div
                  onClick={() => handleProfileSelection("aggressive")}
                  className={`p-4 border rounded-lg cursor-pointer bg-surface-container-lowest transition-all hover:border-primary ${
                    profile === "aggressive"
                      ? "border-primary ring-1 ring-primary/20"
                      : "border-outline-variant/60"
                  }`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-mono font-bold text-on-surface">AGGRESSIVE</span>
                    {profile === "aggressive" && <span className="text-[10px] font-mono text-primary">SELECTED</span>}
                  </div>
                  <p className="text-[11px] text-on-surface-variant leading-relaxed">
                    Short-horizon (6-12 months). Focuses on revenue growth speed, market tailwinds, momentum, and short-term catalysts.
                  </p>
                </div>
              </div>
            </div>

            {/* Account Metadata */}
            <div className="bg-surface-container border border-outline-variant p-6 rounded-xl space-y-4">
              <h3 className="text-xs font-mono font-bold tracking-widest text-on-surface-variant uppercase border-b border-outline-variant pb-2">
                Session Metadata
              </h3>
              <div className="space-y-2 text-xs font-mono">
                <div className="flex justify-between py-1 border-b border-outline-variant/20">
                  <span className="text-on-surface-variant">User Type:</span>
                  <span className="text-on-surface">{user?.is_anonymous ? "GUEST SESSION" : "REGISTERED ACCOUNT"}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-outline-variant/20">
                  <span className="text-on-surface-variant">Account ID:</span>
                  <span className="text-on-surface select-all truncate max-w-[200px]">{user?.id}</span>
                </div>
                {!user?.is_anonymous && (
                  <div className="flex justify-between py-1 border-b border-outline-variant/20">
                    <span className="text-on-surface-variant">Email Address:</span>
                    <span className="text-on-surface">{user?.email}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
