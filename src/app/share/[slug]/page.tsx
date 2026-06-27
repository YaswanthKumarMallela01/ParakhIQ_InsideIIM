import { notFound } from "next/navigation";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function SharedAnalysisPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const adminSupabase = createSupabaseAdmin();

  const { data: run, error } = await adminSupabase
    .from("research_history")
    .select("*")
    .eq("share_slug", slug)
    .eq("is_public", true)
    .single();

  if (error || !run) {
    notFound();
  }

  const { company_name, ticker, verdict, confidence, memo, sources } = run;

  return (
    <div className="flex flex-col min-h-screen bg-background text-on-surface p-4 md:p-8 terminal-grid">
      <div className="max-w-4xl mx-auto w-full">
        {/* Header */}
        <div className="mb-8 border-b border-surface-container-high pb-6">
          <div className="flex justify-between items-start mb-2">
            <div>
              <h1 className="text-2xl font-bold font-hanken text-on-surface">
                {company_name || ticker}
              </h1>
              <div className="text-sm text-on-surface-variant font-mono mt-1 flex items-center gap-2">
                <span className="px-1.5 py-0.5 bg-surface-container rounded border border-surface-container-highest">
                  {ticker}
                </span>
                <span>•</span>
                <span>{new Date(run.created_at).toLocaleDateString()}</span>
              </div>
            </div>
            
            <div className={`px-4 py-2 rounded border font-mono font-bold flex flex-col items-center ${
              verdict === "Invest" 
                ? "bg-primary/10 border-primary/30 text-primary" 
                : "bg-surface-container border-surface-container-highest text-on-surface-variant"
            }`}>
              <span className="text-sm opacity-80 mb-1">VERDICT</span>
              <span className="text-xl tracking-wider">{verdict.toUpperCase()}</span>
            </div>
          </div>
        </div>

        {/* Confidence & Reasoning */}
        <div className="mb-8 p-5 rounded-md border border-surface-container-highest bg-surface-container-low">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-mono text-sm text-on-surface-variant tracking-wider">AI CONFIDENCE SCORE</h3>
            <div className="font-mono font-bold text-lg">{confidence}%</div>
          </div>
          
          <div className="w-full h-1.5 bg-surface-container-highest rounded-full mb-4 overflow-hidden">
            <div 
              className={`h-full ${verdict === "Invest" ? "bg-primary" : "bg-on-surface-variant"}`}
              style={{ width: `${confidence}%` }}
            />
          </div>
          
          <p className="text-sm leading-relaxed text-on-surface/90">
            {memo.summary || memo.reasoning}
          </p>
        </div>

        {/* KPIs Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {Object.entries(memo.kpis || {}).map(([key, value]: [string, any]) => (
            <div key={key} className="p-4 rounded border border-surface-container-high bg-surface-container">
              <div className="text-xs text-on-surface-variant font-mono mb-1 tracking-wider uppercase">
                {key.replace(/([A-Z])/g, ' $1').trim()}
              </div>
              <div className="font-bold text-lg">{value}</div>
            </div>
          ))}
        </div>

        {/* Thesis & Risks */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div>
            <h3 className="font-mono text-sm text-on-surface-variant tracking-wider mb-4 border-b border-surface-container-high pb-2">
              INVESTMENT THESIS
            </h3>
            <ul className="space-y-3">
              {(memo.thesisPoints || []).map((point: string, i: number) => (
                <li key={i} className="flex gap-3 text-sm text-on-surface/90">
                  <span className="text-primary mt-0.5">▸</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
          
          <div>
            <h3 className="font-mono text-sm text-on-surface-variant tracking-wider mb-4 border-b border-surface-container-high pb-2">
              KEY RISKS
            </h3>
            <ul className="space-y-3">
              {(memo.keyRisks || []).map((risk: string, i: number) => (
                <li key={i} className="flex gap-3 text-sm text-on-surface/90">
                  <span className="text-error mt-0.5">▸</span>
                  <span>{risk}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Kill Criteria */}
        <div className="mb-8 p-5 rounded-md border border-error/20 bg-error/5">
          <h3 className="font-mono text-sm text-error tracking-wider mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-error inline-block" />
            EXPLICIT KILL CRITERIA
          </h3>
          <ul className="space-y-2">
            {(memo.killCriteria || []).map((criteria: string, i: number) => (
              <li key={i} className="text-sm text-on-surface/90 font-mono">
                [ ] {criteria}
              </li>
            ))}
          </ul>
        </div>
        
        {/* Sources */}
        {sources && sources.length > 0 && (
          <div className="mb-12">
            <h3 className="font-mono text-sm text-on-surface-variant tracking-wider mb-4 border-b border-surface-container-high pb-2">
              EVIDENCE SOURCES
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {sources.map((src: any, i: number) => (
                <a 
                  key={i} 
                  href={src.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="p-3 rounded border border-surface-container-high bg-surface-container hover:bg-surface-container-highest transition-colors flex flex-col gap-2"
                >
                  <div className="flex items-center gap-2 truncate">
                    <img 
                      src={`https://www.google.com/s2/favicons?domain=${new URL(src.url).hostname}&sz=32`} 
                      alt="" 
                      className="w-4 h-4"
                    />
                    <span className="text-sm font-semibold truncate">{src.title}</span>
                  </div>
                  <div className="text-xs text-on-surface-variant line-clamp-2">
                    {src.snippet}
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="pt-8 border-t border-surface-container-high text-center">
          <p className="text-on-surface-variant text-sm mb-4">
            Generated by ParakhIQ — AI equity research terminal. Not financial advice.
          </p>
          <a 
            href="/"
            className="inline-block px-6 py-2 rounded bg-primary text-on-primary font-bold hover:bg-primary/90 transition-colors"
          >
            Try ParakhIQ Terminal
          </a>
        </div>
      </div>
    </div>
  );
}
