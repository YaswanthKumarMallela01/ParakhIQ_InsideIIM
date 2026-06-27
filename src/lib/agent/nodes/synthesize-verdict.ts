import { z } from "zod";
import { AgentState } from "../state";
import { callLlmStructured } from "../llm";

const verdictSchema = z.object({
  verdict: z.enum(["Invest", "Pass"]).describe("The investment recommendation: Invest or Pass"),
  confidence: z.number().min(0).max(100).describe("The confidence score, from 0 to 100"),
  reasoning: z.string().describe("Detailed narrative reasoning behind the decision. Ensure it is specifically tailored to the investor's risk profile and horizon."),
  killCriteria: z.array(z.string()).min(3).max(5).describe("3-5 highly specific, measurable future trigger events or data points that would immediately invalidate/reverse this call (e.g., 'debt/equity ratio exceeds 0.7', 'promoter shareholding drops below 48%', etc.)")
});

const cleanText = (text: string) => {
  return text
    .replace(/\*\*+/g, "")
    .replace(/\*+/g, "")
    .replace(/#+/g, "")
    .replace(/`/g, "")
    .trim();
};

export async function synthesizeVerdictNode(state: typeof AgentState.State) {
  const logs: string[] = [];
  logs.push(`Synthesizing final verdict and drafting kill criteria based on thesis and challenge history...`);

  const challengeRoundsText = state.challengeHistory
    .map((c) => `Loop ${c.loopIndex + 1}:\n- Bearish Evidence: ${c.evidence}\n- Review: ${c.reviewResult}`)
    .join("\n\n");

  const formattedFundamentals = JSON.stringify(state.fundamentals, null, 2);

  const systemPrompt = `You are the Investment Committee Chair at ParakhIQ. Your job is to make the final Invest/Pass call. You must weigh the final thesis against all disconfirming evidence surfaced during the challenge loops, and tailor the verdict specifically to the investor's profile.`;

  const userPrompt = `
COMPANY: ${state.companyName} (${state.ticker})
INVESTOR PROFILE: ${state.investorProfile.toUpperCase()} (Conservative = long-horizon, focus on valuation/safety; Aggressive = short-horizon, focus on momentum/catalysts)

--- FUNDAMENTALS ---
${formattedFundamentals}

--- FINAL INVESTMENT THESIS ---
${state.thesis}

--- CHALLENGE & REVISION HISTORY ---
${challengeRoundsText || "No revisions made."}

Your task:
1. Make an Invest or Pass call.
2. Determine a confidence score (0-100%).
3. Write profile-centric reasoning.
   - For CONSERVATIVE: focus on balance sheet strength, debt levels, cash flow safety, and valuation multiples.
   - For AGGRESSIVE: focus on growth catalysts, business expansion, market share, and revenue momentum.
4. Establish 3-5 explicit "kill criteria" — specific, numerical future data points (ratios, promoter actions, revenue/margin thresholds) that would trigger a reversal of this call.

Return your decision in the structured output format.
`;

  try {
    const result = await callLlmStructured(systemPrompt, userPrompt, verdictSchema, 0.2);

    const verdict = result.data.verdict;
    const confidence = result.data.confidence;
    const reasoning = cleanText(result.data.reasoning);
    const killCriteria = (result.data.killCriteria || []).map(cleanText);

    return {
      verdict,
      confidence,
      reasoning,
      killCriteria,
      logs: logs.concat([
        `Synthesized verdict: ${verdict.toUpperCase()} (Confidence: ${confidence}%) via ${result.source}`,
      ]),
    };
  } catch (error: any) {
    logs.push(`Error in synthesize_verdict: ${error.message || error}`);
    return {
      verdict: "Pass" as const,
      confidence: 50,
      reasoning: "Failed to synthesize final verdict due to model error.",
      killCriteria: [
        "Consolidated debt/equity exceeds 1.5",
        "Promoter shareholding falls below 40%",
        "Quarterly net profit growth turns negative",
      ],
      logs,
    };
  }
}
