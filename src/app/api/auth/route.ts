import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { sendOtpEmail } from "@/lib/email/send";

export async function POST(request: Request) {
  const supabase = await createSupabaseServer();
  const { action, email, password, otp } = await request.json();

  try {
    const adminSupabase = createSupabaseAdmin();

    if (action === "sign-in") {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ user: data.user });
    }

    if (action === "send-otp") {
      if (!email || !password) {
        return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
      }

      // Check if user already exists in auth
      const { data: usersList, error: listError } = await adminSupabase.auth.admin.listUsers();
      if (listError) {
        return NextResponse.json({ error: listError.message }, { status: 500 });
      }

      const emailExists = usersList.users.some(
        (u) => u.email?.toLowerCase() === email.toLowerCase() && !u.email?.startsWith("guest_")
      );

      if (emailExists) {
        return NextResponse.json({ error: "An account with this email already exists." }, { status: 400 });
      }

      // Generate a 6-digit OTP code
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

      // Upsert into temp_otps table
      const { error: upsertError } = await adminSupabase.from("temp_otps").upsert({
        email: email.toLowerCase(),
        otp: otpCode,
        password, // saved temporarily in plain text to register the user after OTP succeeds (row is immediately deleted)
      });

      if (upsertError) {
        return NextResponse.json({ error: "Failed to store verification code." }, { status: 500 });
      }

      // Send the OTP via Gmail SMTP
      const emailResult = await sendOtpEmail(email, otpCode);
      if (!emailResult.success) {
        return NextResponse.json({ error: "Failed to send OTP verification email. Please check configuration." }, { status: 500 });
      }

      return NextResponse.json({ success: true, otpSent: true });
    }

    if (action === "verify-otp") {
      if (!email || !otp) {
        return NextResponse.json({ error: "Email and OTP are required" }, { status: 400 });
      }

      // Query the OTP row
      const { data: tempOtp, error: queryError } = await adminSupabase
        .from("temp_otps")
        .select("*")
        .eq("email", email.toLowerCase())
        .maybeSingle();

      if (queryError || !tempOtp) {
        return NextResponse.json({ error: "Verification code expired or not requested." }, { status: 400 });
      }

      if (tempOtp.otp !== otp.trim()) {
        return NextResponse.json({ error: "Incorrect verification code. Please try again." }, { status: 400 });
      }

      // OTP matches! Create the user account with automatic email confirmation
      const { data: createdUser, error: createError } = await adminSupabase.auth.admin.createUser({
        email: email.toLowerCase(),
        password: tempOtp.password,
        email_confirm: true,
      });

      if (createError) {
        return NextResponse.json({ error: createError.message }, { status: 400 });
      }

      // Delete the OTP row
      await adminSupabase.from("temp_otps").delete().eq("email", email.toLowerCase());

      // Create default user preferences
      await adminSupabase.from("user_preferences").insert({
        user_id: createdUser.user.id,
        email_digest_enabled: true,
      });

      // Sign the user in on the server client so that session cookies are set correctly
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase(),
        password: tempOtp.password,
      });

      if (signInError) {
        return NextResponse.json({ error: `Login failed: ${signInError.message}` }, { status: 400 });
      }

      return NextResponse.json({ user: signInData.user });
    }

    if (action === "sign-out") {
      await supabase.auth.signOut();
      return NextResponse.json({ success: true });
    }

    if (action === "delete-account") {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      // Delete user profile via Admin API
      const { error: deleteError } = await adminSupabase.auth.admin.deleteUser(user.id);
      if (deleteError) {
        return NextResponse.json({ error: deleteError.message }, { status: 500 });
      }

      // Sign out / clear session cookies
      await supabase.auth.signOut();

      return NextResponse.json({ success: true });
    }

    if (action === "guest") {
      let user: any = null;

      // Try native anonymous sign-in first
      const { data: anonData, error: anonError } = await supabase.auth.signInAnonymously();

      if (!anonError && anonData?.user) {
        user = anonData.user;
      } else {
        // Fallback: Create a mock user via the admin API
        console.log("Supabase anonymous sign-in failed, triggering admin user fallback:", anonError?.message);

        const randomId = Math.random().toString(36).substring(2, 10);
        const guestEmail = `guest_${randomId}@parakhiq.com`;
        const guestPassword = `GuestPass_${randomId}_123!`;

        const { data: createdUserData, error: createError } = await adminSupabase.auth.admin.createUser({
          email: guestEmail,
          password: guestPassword,
          email_confirm: true,
          user_metadata: { is_anonymous: true }
        });

        if (createError) {
          return NextResponse.json({ error: `Guest session creation failed: ${createError.message}` }, { status: 400 });
        }

        // Now sign them in via server client to set session cookies
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: guestEmail,
          password: guestPassword,
        });

        if (signInError) {
          return NextResponse.json({ error: `Guest session login failed: ${signInError.message}` }, { status: 400 });
        }

        user = signInData.user;
      }

      if (user) {
        // 1. Create user preferences
        await adminSupabase.from("user_preferences").upsert({
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
