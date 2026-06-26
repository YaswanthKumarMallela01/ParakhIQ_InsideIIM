import React from "react";

interface StepperStep {
  id: string;
  num: string;
  title: string;
  desc: string;
}

interface ReasoningStepperProps {
  currentNode: string;
  logs: string[];
}

export function ReasoningStepper({ currentNode, logs }: ReasoningStepperProps) {
  const steps: StepperStep[] = [
    { id: "intake", num: "01", title: "INTAKE", desc: "Process company request and investor profile" },
    { id: "resolve_ticker", num: "02", title: "RESOLVE TICKER", desc: "Lookup NSE/BSE and global tickers" },
    { id: "gather_data", num: "03", title: "GATHER DATA", desc: "Fetch historical prices, fundamentals, and recent news" },
    { id: "build_thesis", num: "04", title: "BUILD THESIS", desc: "Draft primary qualitative growth drivers" },
    { id: "challenge_thesis", num: "05", title: "CHALLENGE THESIS", desc: "Deliberately search for bearish risks and disconfirming data" },
    { id: "revise_or_proceed", num: "06", title: "REVISE OR PROCEED", desc: "Incorporate risks or proceed to final synthesis" },
    { id: "synthesize_verdict", num: "07", title: "SYNTHESIZE VERDICT", desc: "Compute final Invest/Pass call & establish kill criteria" },
    { id: "write_memo", num: "08", title: "WRITE MEMO", desc: "Assemble analytical terminal report" },
  ];

  // Helper to determine status of a step
  const getStepStatus = (stepId: string) => {
    const currentIndex = steps.findIndex((s) => s.id === currentNode);
    const stepIndex = steps.findIndex((s) => s.id === stepId);

    if (currentNode === "done") return "completed";
    if (currentIndex === -1) return "pending";
    if (stepIndex < currentIndex) return "completed";
    if (stepIndex === currentIndex) return "active";
    return "pending";
  };

  return (
    <div className="flex flex-col gap-6 font-sans">
      <div className="flex items-center justify-between border-b border-outline-variant pb-3 mb-2">
        <span className="text-xs font-mono font-bold text-on-surface-variant tracking-widest uppercase">
          Agent Reasoning Trace
        </span>
        <span className="text-xs font-mono text-primary animate-pulse">
          {currentNode === "done" ? "✓ ANALYSIS COMPLETE" : "• AGENT PROCESSING"}
        </span>
      </div>

      <div className="relative pl-8 border-l border-outline-variant space-y-8">
        {steps.map((step) => {
          const status = getStepStatus(step.id);
          
          let circleColor = "border-outline-variant bg-surface-container-low text-on-surface-variant";
          let textColor = "text-on-surface-variant";
          let titleColor = "text-on-surface-variant";

          if (status === "completed") {
            circleColor = "border-primary bg-primary/10 text-primary";
            textColor = "text-on-surface-variant";
            titleColor = "text-on-surface font-semibold";
          } else if (status === "active") {
            circleColor = "border-secondary bg-secondary/15 text-secondary animate-pulse";
            textColor = "text-on-surface";
            titleColor = "text-secondary font-bold";
          }

          // Filter logs that mention this node to render contextual info
          const nodeLogs = logs.filter((log) => {
            const stepPrefix = step.title.toLowerCase();
            return (
              log.toLowerCase().includes(step.id) ||
              log.toLowerCase().includes(stepPrefix) ||
              (step.id === "intake" && log.toLowerCase().includes("parsed")) ||
              (step.id === "resolve_ticker" && log.toLowerCase().includes("resolved")) ||
              (step.id === "gather_data" && log.toLowerCase().includes("fetched")) ||
              (step.id === "build_thesis" && log.toLowerCase().includes("thesis")) ||
              (step.id === "challenge_thesis" && log.toLowerCase().includes("challenge")) ||
              (step.id === "synthesize_verdict" && log.toLowerCase().includes("verdict"))
            );
          });

          return (
            <div key={step.id} className="relative group">
              {/* Stepper Dot */}
              <div
                className={`absolute -left-[45px] top-0.5 w-8 h-8 rounded-full border flex items-center justify-center font-mono text-xs font-bold transition-all ${circleColor}`}
              >
                {step.num}
              </div>

              {/* Step Content */}
              <div>
                <h4 className={`text-xs tracking-wider font-mono ${titleColor}`}>
                  {step.title}
                </h4>
                <p className={`text-xs mt-1 leading-relaxed ${textColor}`}>
                  {step.desc}
                </p>

                {/* Real-time Logs under active/completed node */}
                {nodeLogs.length > 0 && (status === "active" || status === "completed") && (
                  <div className="mt-3 p-3 bg-surface-container-lowest border border-outline-variant rounded font-mono text-[11px] text-primary/95 space-y-1 max-h-40 overflow-y-auto">
                    {nodeLogs.map((log, index) => (
                      <div key={index} className="leading-5">
                        <span className="text-secondary select-none">&gt;&nbsp;</span>
                        {log}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
