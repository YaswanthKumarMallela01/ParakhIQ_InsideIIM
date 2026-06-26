export interface DigestEmailHolding {
  company: string;
  ticker: string;
  amountInvested: number;
  predictionRange: string;
  sentimentScore: number;
  guidance: "hold" | "reconsider" | "reduce";
}

export function getDigestEmailHtml(
  userName: string,
  holdings: DigestEmailHolding[],
  appUrl: string
) {
  const holdingsRows = holdings
    .map((h) => {
      let badgeColor = "#10b981"; // Emerald
      let badgeText = "HOLD / ACCUMULATE";
      if (h.guidance === "reconsider") {
        badgeColor = "#f59e0b"; // Amber/Orange
        badgeText = "RECONSIDER / NEUTRAL";
      } else if (h.guidance === "reduce") {
        badgeColor = "#f43f5e"; // Serious Coral
        badgeText = "REDUCE / SELL";
      }

      const sentimentDirection =
        h.sentimentScore > 0.2
          ? "Bullish"
          : h.sentimentScore < -0.2
          ? "Bearish"
          : "Neutral";
      const sentimentColor =
        h.sentimentScore > 0.2
          ? "#10b981"
          : h.sentimentScore < -0.2
          ? "#f43f5e"
          : "#a1a1aa";

      return `
        <div style="background-color: #1a1a2e; border: 1px solid #3c4a42; border-radius: 4px; padding: 16px; margin-bottom: 16px; font-family: 'Inter', sans-serif;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; flex-wrap: wrap;">
            <div>
              <h3 style="margin: 0; color: #e5e1e4; font-size: 16px; font-family: 'Hanken Grotesk', sans-serif;">${h.company}</h3>
              <code style="color: #6366f1; font-family: 'JetBrains Mono', monospace; font-size: 12px;">${h.ticker}</code>
            </div>
            <span style="background-color: ${badgeColor}22; color: ${badgeColor}; border: 1px solid ${badgeColor}; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; font-family: 'JetBrains Mono', monospace; letter-spacing: 0.05em; display: inline-block;">
              ${badgeText}
            </span>
          </div>

          <table style="width: 100%; border-collapse: collapse; margin-top: 12px;">
            <tr>
              <td style="color: #a1a1aa; font-size: 11px; font-family: 'JetBrains Mono', monospace; text-transform: uppercase; padding-bottom: 4px;">Invested Amount</td>
              <td style="color: #a1a1aa; font-size: 11px; font-family: 'JetBrains Mono', monospace; text-transform: uppercase; padding-bottom: 4px; text-align: right;">1Y Prediction Range</td>
            </tr>
            <tr>
              <td style="color: #e5e1e4; font-family: 'JetBrains Mono', monospace; font-size: 16px; font-weight: bold;">₹${Number(h.amountInvested).toLocaleString("en-IN")}</td>
              <td style="color: #4edea3; font-family: 'JetBrains Mono', monospace; font-size: 16px; font-weight: bold; text-align: right;">${h.predictionRange}</td>
            </tr>
          </table>

          <div style="margin-top: 14px; padding-top: 12px; border-top: 1px solid #27272a; font-size: 12px; color: #a1a1aa;">
            Sentiment Score: 
            <strong style="color: ${sentimentColor}; font-family: 'JetBrains Mono', monospace;">
              ${h.sentimentScore > 0 ? "+" : ""}${h.sentimentScore} (${sentimentDirection})
            </strong>
          </div>
        </div>
      `;
    })
    .join("");

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>ParakhIQ Daily Digest</title>
      </head>
      <body style="background-color: #131315; color: #e5e1e4; margin: 0; padding: 20px; font-family: 'Inter', sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #0e0e10; border: 1px solid #27272a; border-radius: 8px; padding: 24px;">
          
          <!-- Header -->
          <div style="border-bottom: 1px solid #27272a; padding-bottom: 16px; margin-bottom: 24px; text-align: center;">
            <h1 style="color: #10b981; margin: 0; font-family: 'Hanken Grotesk', sans-serif; font-size: 24px; letter-spacing: 0.05em; font-weight: 700;">
              PARAKHIQ TERMINAL
            </h1>
            <p style="color: #a1a1aa; margin: 4px 0 0 0; font-size: 12px; font-family: 'JetBrains Mono', monospace; text-transform: uppercase;">
              Daily Portfolio Digest & Analysis
            </p>
          </div>

          <!-- Body -->
          <p style="color: #e5e1e4; font-size: 14px;">Hello,</p>
          <p style="color: #e5e1e4; font-size: 14px; line-height: 1.5;">
            Here is your scheduled morning portfolio update from the ParakhIQ investment agent. Below is the active directional guidance for your holdings, re-calculated using our 1-year extrapolation engine and recent news sentiment analysis:
          </p>

          <div style="margin-top: 24px; margin-bottom: 24px;">
            ${holdingsRows}
          </div>

          <div style="text-align: center; margin-top: 30px; margin-bottom: 30px;">
            <a href="${appUrl}/portfolio" style="background-color: #10b981; color: #002113; text-decoration: none; padding: 12px 24px; border-radius: 4px; font-weight: bold; font-family: 'JetBrains Mono', monospace; font-size: 13px; display: inline-block;">
              OPEN PORTFOLIO TERMINAL
            </a>
          </div>

          <!-- Footer -->
          <div style="border-top: 1px solid #27272a; padding-top: 16px; margin-top: 30px; color: #71717a; font-size: 11px; text-align: center; font-family: 'Inter', sans-serif;">
            <p style="margin: 0 0 8px 0;">
              This digest was sent automatically. You can toggle off daily emails instantly in your 
              <a href="${appUrl}/settings" style="color: #6366f1; text-decoration: none;">Account Settings</a>.
            </p>
            <p style="margin: 0; font-weight: bold; color: #a1a1aa;">
              Disclaimer: ParakhIQ is an AI research tool, not financial advice. Past performance is no guarantee of future returns.
            </p>
          </div>

        </div>
      </body>
    </html>
  `;
}
