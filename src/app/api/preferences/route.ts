import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createSupabaseServer();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    let { data: prefs, error: prefsError } = await supabase
      .from("user_preferences")
      .select("email_digest_enabled")
      .eq("user_id", user.id)
      .maybeSingle();

    if (prefsError) {
      return NextResponse.json({ error: prefsError.message }, { status: 500 });
    }

    // If no preferences record exists, create one with default true
    if (!prefs) {
      const { data: newPrefs, error: createError } = await supabase
        .from("user_preferences")
        .insert({
          user_id: user.id,
          email_digest_enabled: true,
        })
        .select("email_digest_enabled")
        .single();

      if (createError) {
        return NextResponse.json({ error: createError.message }, { status: 500 });
      }
      prefs = newPrefs;
    }

    return NextResponse.json(prefs);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || error }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const supabase = await createSupabaseServer();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { email_digest_enabled } = await request.json();

    if (typeof email_digest_enabled !== "boolean") {
      return NextResponse.json({ error: "Invalid preference format" }, { status: 400 });
    }

    const { data: updatedPrefs, error: updateError } = await supabase
      .from("user_preferences")
      .upsert({
        user_id: user.id,
        email_digest_enabled,
      })
      .select("email_digest_enabled")
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json(updatedPrefs);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || error }, { status: 500 });
  }
}
