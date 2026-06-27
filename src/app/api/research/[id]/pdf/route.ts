import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export async function GET(
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
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !run) {
      return NextResponse.json({ error: "Research not found" }, { status: 404 });
    }

    const { company_name, ticker, verdict, confidence, memo, sources } = run;

    // Generate PDF
    const doc = new jsPDF();
    
    // Helper colors
    const primary = [16, 185, 129] as [number, number, number]; // #10b981
    const textDark = [19, 19, 21] as [number, number, number];
    const textLight = [100, 100, 100] as [number, number, number];

    doc.setFont("helvetica", "bold");
    doc.setFontSize(24);
    doc.setTextColor(...textDark);
    doc.text("ParakhIQ Investment Memo", 14, 20);

    doc.setFontSize(14);
    doc.setTextColor(...textLight);
    doc.text(`${company_name || ticker} (${ticker})`, 14, 28);
    
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date(run.created_at).toLocaleDateString()}`, 14, 34);

    // Verdict box
    doc.setFillColor(verdict === "Invest" ? 220 : 240, verdict === "Invest" ? 250 : 240, verdict === "Invest" ? 230 : 240);
    doc.rect(14, 40, 182, 25, "F");
    
    doc.setFontSize(12);
    doc.setTextColor(verdict === "Invest" ? primary[0] : 100, verdict === "Invest" ? primary[1] : 100, verdict === "Invest" ? primary[2] : 100);
    doc.text(`VERDICT: ${verdict.toUpperCase()} (Confidence: ${confidence}%)`, 20, 50);
    
    doc.setFontSize(10);
    doc.setTextColor(50, 50, 50);
    const summaryLines = doc.splitTextToSize(memo.summary || memo.reasoning || "", 170);
    doc.text(summaryLines, 20, 58);

    let currentY = 75;

    // KPIs Table
    const kpis = memo.kpis || {};
    const tableBody = Object.entries(kpis).map(([k, v]) => [
      k.replace(/([A-Z])/g, ' $1').trim().toUpperCase(),
      v as string
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [["Metric", "Value"]],
      body: tableBody,
      theme: "striped",
      headStyles: { fillColor: [40, 40, 40] },
      margin: { left: 14, right: 14 },
    });

    currentY = (doc as any).lastAutoTable.finalY + 15;

    // Thesis
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...textDark);
    doc.text("Investment Thesis", 14, currentY);
    currentY += 8;
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const thesisPoints = memo.thesisPoints || [];
    thesisPoints.forEach((point: string) => {
      const lines = doc.splitTextToSize(`• ${point}`, 182);
      if (currentY + lines.length * 5 > 280) {
        doc.addPage();
        currentY = 20;
      }
      doc.text(lines, 14, currentY);
      currentY += lines.length * 5 + 3;
    });

    currentY += 10;

    // Risks
    if (currentY > 250) {
      doc.addPage();
      currentY = 20;
    }
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...textDark);
    doc.text("Key Risks", 14, currentY);
    currentY += 8;
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const keyRisks = memo.keyRisks || [];
    keyRisks.forEach((risk: string) => {
      const lines = doc.splitTextToSize(`• ${risk}`, 182);
      if (currentY + lines.length * 5 > 280) {
        doc.addPage();
        currentY = 20;
      }
      doc.text(lines, 14, currentY);
      currentY += lines.length * 5 + 3;
    });

    currentY += 10;

    // Kill Criteria
    if (currentY > 250) {
      doc.addPage();
      currentY = 20;
    }
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...textDark);
    doc.text("Kill Criteria", 14, currentY);
    currentY += 8;
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const killCriteria = memo.killCriteria || [];
    killCriteria.forEach((criteria: string) => {
      const lines = doc.splitTextToSize(`[ ] ${criteria}`, 182);
      if (currentY + lines.length * 5 > 280) {
        doc.addPage();
        currentY = 20;
      }
      doc.text(lines, 14, currentY);
      currentY += lines.length * 5 + 3;
    });

    // Output PDF
    const pdfBytes = doc.output("arraybuffer");

    return new Response(pdfBytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="ParakhIQ_${ticker}_Memo.pdf"`,
      },
    });

  } catch (error: any) {
    console.error("Error generating PDF:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
