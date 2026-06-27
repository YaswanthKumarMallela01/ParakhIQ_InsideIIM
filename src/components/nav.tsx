"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase/client";

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createSupabaseBrowser();
  const [user, setUser] = useState<any>(null);
  const [time, setTime] = useState<Date | null>(null);

  useEffect(() => {
    setTime(new Date());
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  const handleSignOut = async () => {
    await fetch("/api/auth", {
      method: "POST",
      body: JSON.stringify({ action: "sign-out" }),
    });
    router.push("/");
    router.refresh();
  };

  const navItems = [
    { label: "RESEARCH", path: "/research" },
    { label: "PORTFOLIO", path: "/portfolio" },
    { label: "SETTINGS", path: "/settings" },
  ];

  return (
    <header className="border-b border-outline-variant bg-surface-container-lowest/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/research" className="flex items-center gap-2">
            {/* Green diamond icon */}
            <div className="w-5 h-5 bg-primary rotate-45 flex items-center justify-center text-[10px] text-on-primary font-bold">
              P
            </div>
            <span className="font-hanken font-bold text-lg tracking-wider text-primary">
              PARAKHIQ
            </span>
          </Link>
          <nav className="hidden md:flex gap-1">
            {navItems.map((item) => {
              const isActive = pathname === item.path;
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`px-4 py-2 rounded text-xs font-mono tracking-wider transition-colors ${
                    isActive
                      ? "bg-surface-container-highest text-primary border-b-2 border-primary"
                      : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          {time && (
            <div className="hidden sm:block text-[10px] font-mono text-on-surface-variant bg-surface-container py-1 px-2.5 rounded border border-outline-variant">
              IST: {time.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true })}
            </div>
          )}
          {user && (() => {
            const isGuest = user.is_anonymous || user.email?.startsWith("guest_");
            return (
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-mono text-on-surface-variant bg-surface-container py-1 px-2.5 rounded border border-outline-variant">
                  {isGuest ? "GUEST MODE" : user.email?.split("@")[0].toUpperCase()}
                </span>
                <button
                  onClick={handleSignOut}
                  className="text-xs font-mono text-error hover:underline bg-transparent border-0 cursor-pointer"
                >
                  {isGuest ? "END SESSION" : "SIGN OUT"}
                </button>
              </div>
            );
          })()}
        </div>
      </div>
      {/* Mobile nav bar at the bottom */}
      <div className="md:hidden flex justify-around border-t border-outline-variant bg-surface-container-lowest fixed bottom-0 left-0 right-0 z-50 py-2">
        {navItems.map((item) => {
          const isActive = pathname === item.path;
          return (
            <Link
              key={item.path}
              href={item.path}
              className={`flex flex-col items-center py-1 px-3 rounded text-[10px] font-mono tracking-wider transition-colors ${
                isActive ? "text-primary font-bold" : "text-on-surface-variant"
              }`}
            >
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </header>
  );
}
