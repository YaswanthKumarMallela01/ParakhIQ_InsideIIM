import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const supabase = await createSupabaseServer();
  const { action, email, password } = await request.json();

  try {
    if (action === "sign-in") {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ user: data.user });
    }

    if (action === "sign-up") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });

      // Create default user preferences
      if (data.user) {
        const adminSupabase = createSupabaseAdmin();
        await adminSupabase.from("user_preferences").insert({
          user_id: data.user.id,
          email_digest_enabled: true,
        });
      }

      return NextResponse.json({ user: data.user });
    }

    if (action === "sign-out") {
      await supabase.auth.signOut();
      return NextResponse.json({ success: true });
    }

    if (action === "guest") {
      // Sign in anonymously
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });

      const user = data.user;
      if (user) {
        const adminSupabase = createSupabaseAdmin();

        // 1. Create user preferences
        await adminSupabase.from("user_preferences").insert({
          user_id: user.id,
          email_digest_enabled: true,
        });

        // 2. Check if holdings already exist (should not, but safety check)
        const { data: existingHoldings } = await adminSupabase
          .from("holdings")
          .select("id")
          .eq("user_id", user.id);

        if (!existingHoldings || existingHoldings.length === 0) {
          // 3. Seed demo holdings
          const demoHoldings = [
            {
              user_id: user.id,
              company: "Reliance Industries Ltd",
              ticker: "RELIANCE.NS",
              amount_invested: 250000,
            },
            {
              user_id: user.id,
              company: "Tata Consultancy Services Ltd",
              ticker: "TCS.NS",
              amount_invested: 150000,
            },
            {
              user_id: user.id,
              company: "HDFC Bank Ltd",
              ticker: "HDFCBANK.NS",
              amount_invested: 100000,
            },
          ];

          const { data: insertedHoldings, error: holdingsError } = await adminSupabase
            .from("holdings")
            .insert(demoHoldings)
            .select();

          if (holdingsError) {
            console.error("Seeding holdings failed:", holdingsError);
          } else if (insertedHoldings) {
            // 4. Seed predictions for the demo holdings
            const demoPredictions = [
              {
                holding_id: insertedHoldings.find((h) => h.ticker === "RELIANCE.NS")?.id,
                score: 0.52,
                range_low: 8,
                range_high: 22,
                midpoint: 15,
                guidance: "hold",
              },
              {
                holding_id: insertedHoldings.find((h) => h.ticker === "TCS.NS")?.id,
                score: 0.38,
                range_low: 3,
                range_high: 17,
                midpoint: 10,
                guidance: "hold",
              },
              {
                holding_id: insertedHoldings.find((h) => h.ticker === "HDFCBANK.NS")?.id,
                score: 0.12,
                range_low: -1,
                range_high: 13,
                midpoint: 6,
                guidance: "hold",
              },
            ].filter((p) => p.holding_id !== undefined);

            await adminSupabase.from("predictions").insert(demoPredictions);
          }
        }
      }

      return NextResponse.json({ user });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || error }, { status: 500 });
  }
}
