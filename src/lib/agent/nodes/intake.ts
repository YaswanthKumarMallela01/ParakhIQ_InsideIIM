import { AgentState } from "../state";

export async function intakeNode(state: typeof AgentState.State) {
  const companyName = state.companyName;
  const investorProfile = state.investorProfile || "aggressive";
  
  const logMsg = `Parsed company: ${companyName}. Profile: ${investorProfile.toUpperCase()} / ${
    investorProfile === "conservative" ? "LONG-HORIZON" : "SHORT-HORIZON"
  }`;
  
  return {
    companyName,
    investorProfile,
    logs: [logMsg],
  };
}
