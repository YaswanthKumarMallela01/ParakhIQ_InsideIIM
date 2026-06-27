import { Annotation } from "@langchain/langgraph";

export interface PricePoint {
  date: string;
  close: number;
}

export interface NewsArticle {
  title: string;
  url: string;
  content: string;
}

export interface Source {
  title: string;
  url: string;
  snippet: string;
  used_for: string;
}

export interface Fundamentals {
  peRatio: string | number;
  peSectorRatio: string | number;
  marketCap: string | number;
  fiftyTwoWeekHigh: string | number;
  fiftyTwoWeekLow: string | number;
  promoterHolding: string | number;
  promoterHoldingChange: string | number;
  debtToEquity: string | number;
  currentPrice?: string | number;
  currencySymbol?: string;
}

export interface ChallengeRound {
  loopIndex: number;
  evidence: string;
  reviewResult: string;
}

export interface FinalMemo {
  verdict: "Invest" | "Pass";
  confidence: number;
  ticker: string;
  companyName: string;
  investorProfile: string;
  summary: string;
  thesisPoints: string[];
  keyRisks: string[];
  kpis: {
    peRatio: string;
    peSectorRatio: string;
    marketCap: string;
    fiftyTwoWeekHigh: string;
    fiftyTwoWeekLow: string;
    promoterHolding: string;
    debtToEquity: string;
    currentPrice?: string;
  };
  killCriteria: string[];
  priceData: PricePoint[];
}

export const AgentState = Annotation.Root({
  companyName: Annotation<string>(),
  investorProfile: Annotation<"conservative" | "aggressive">(),
  ticker: Annotation<string>(),
  tickerFallback: Annotation<string>(),
  exchange: Annotation<string>(),
  priceHistory: Annotation<PricePoint[]>({
    reducer: (x, y) => y ?? x,
    default: () => [],
  }),
  fundamentals: Annotation<Fundamentals>({
    reducer: (x, y) => ({ ...x, ...y }),
    default: () => ({
      peRatio: "unavailable",
      peSectorRatio: "unavailable",
      marketCap: "unavailable",
      fiftyTwoWeekHigh: "unavailable",
      fiftyTwoWeekLow: "unavailable",
      promoterHolding: "unavailable",
      promoterHoldingChange: "unavailable",
      debtToEquity: "unavailable",
    }),
  }),
  newsArticles: Annotation<NewsArticle[]>({
    reducer: (x, y) => y ?? x,
    default: () => [],
  }),
  sources: Annotation<Source[]>({
    reducer: (x, y) => x.concat(y ?? []),
    default: () => [],
  }),
  sectorContext: Annotation<string>(),
  thesis: Annotation<string>(),
  challengeEvidence: Annotation<string>(),
  challengeHistory: Annotation<ChallengeRound[]>({
    reducer: (x, y) => x.concat(y ?? []),
    default: () => [],
  }),
  loopCount: Annotation<number>({
    reducer: (x, y) => y ?? x,
    default: () => 0,
  }),
  hasMaterialEvidence: Annotation<boolean>({
    reducer: (x, y) => y ?? x,
    default: () => false,
  }),
  verdict: Annotation<"Invest" | "Pass">(),
  confidence: Annotation<number>(),
  reasoning: Annotation<string>(),
  killCriteria: Annotation<string[]>({
    reducer: (x, y) => y ?? x,
    default: () => [],
  }),
  memo: Annotation<FinalMemo>(),
  
  // execution logging trace
  logs: Annotation<string[]>({
    reducer: (x, y) => x.concat(y ?? []),
    default: () => [],
  }),
});
