import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { nanoid } from "nanoid";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createSupabaseServer();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const adminSupabase = createSupabaseAdmin();

    const { data: run, error: fetchError } = await adminSupabase
      .from("research_history")
      .select("share_slug, is_public")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !run) {
      return NextResponse.json({ error: "Research not found" }, { status: 404 });
    }

    let slug = run.share_slug;

    if (!slug) {
      slug = nanoid(10);
      const { error: updateError } = await adminSupabase
        .from("research_history")
        .update({ share_slug: slug, is_public: true })
        .eq("id", id);

      if (updateError) {
        return NextResponse.json({ error: "Failed to create share link" }, { status: 500 });
      }
    } else if (!run.is_public) {
      await adminSupabase
        .from("research_history")
        .update({ is_public: true })
        .eq("id", id);
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    return NextResponse.json({ slug, url: `${appUrl}/share/${slug}` });

  } catch (error: any) {
    console.error("Error in share:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
