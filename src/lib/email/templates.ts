export interface DigestEmailHolding {
  company: string;
  ticker: string;
  purchasePrice: number;
  currentPrice: number;
  gainLoss: number;
  gainLossPercent: number;
  amountInvested: number;
  guidance: string;
  predictionRange: string;
  priceHistory: { date: string; close: number }[];
  currencySymbol?: string;
}

function generateSvgSparkline(prices: number[], currencySymbol?: string): string {
  if (!prices || prices.length < 2) {
    return `
      <div style="margin-top: 14px; margin-bottom: 14px; background-color: #131315; border: 1px solid #27272a; border-radius: 4px; padding: 16px; text-align: center; font-family: monospace; font-size: 10px; color: #71717a;">
        [ 1Y PRICE TREND LINE CHART UNAVAILABLE ]
      </div>
    `;
  }

  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const width = 300;
  const height = 70;
  const paddingX = 12;
  const paddingY = 12;

  const points = prices
    .map((p, idx) => {
      const x = (idx / (prices.length - 1)) * (width - paddingX * 2) + paddingX;
      const y = height - ((p - min) / range) * (height - paddingY * 2) - paddingY;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const isBullish = prices[prices.length - 1] >= prices[0];
  const strokeColor = isBullish ? "#10b981" : "#f43f5e";

  return `
    <div style="margin-top: 14px; margin-bottom: 14px; background-color: #131315; border: 1px solid #27272a; border-radius: 6px; padding: 12px;">
      <div style="font-family: monospace; font-size: 9px; color: #71717a; text-transform: uppercase; margin-bottom: 8px; display: flex; justify-content: space-between;">
        <span>1Y Price Trend (Weekly Closing)</span>
        <span style="color: ${strokeColor}; font-weight: bold;">${isBullish ? "▲ BULLISH" : "▼ BEARISH"}</span>
      </div>
      <svg viewBox="0 0 ${width} ${height}" style="width: 100%; height: auto; display: block;">
        <!-- Grid horizontal lines -->
        <line x1="${paddingX}" y1="${paddingY}" x2="${width - paddingX}" y2="${paddingY}" stroke="#222225" stroke-dasharray="2 2" stroke-width="1" />
        <line x1="${paddingX}" y1="${height - paddingY}" x2="${width - paddingX}" y2="${height - paddingY}" stroke="#222225" stroke-dasharray="2 2" stroke-width="1" />
        <!-- Trend line -->
        <polyline fill="none" stroke="${strokeColor}" stroke-width="2" points="${points}" />
      </svg>
      <table style="width: 100%; margin-top: 6px; font-family: monospace; font-size: 8px; color: #71717a;">
        <tr>
          <td>52W LOW: ${currencySymbol || "₹"}${min.toFixed(2)}</td>
          <td style="text-align: right;">52W HIGH: ${currencySymbol || "₹"}${max.toFixed(2)}</td>
        </tr>
      </table>
    </div>
  `;
}

export function getDigestEmailHtml(
  userName: string,
  userEmail: string,
  holdings: DigestEmailHolding[],
  appUrl: string
) {
  const holdingsRows = holdings
    .map((h) => {
      const curr = h.currencySymbol || "₹";
      const locale = curr === "$" ? "en-US" : "en-IN";
      let badgeColor = "#10b981"; // Emerald
      let badgeText = "HOLD / ACCUMULATE";
      const guidanceClean = h.guidance.toLowerCase();
      if (guidanceClean.includes("reconsider") || guidanceClean.includes("neutral")) {
        badgeColor = "#f59e0b"; // Amber/Orange
        badgeText = "RECONSIDER / NEUTRAL";
      } else if (guidanceClean.includes("reduce") || guidanceClean.includes("sell")) {
        badgeColor = "#f43f5e"; // Coral/Red
        badgeText = "REDUCE / SELL";
      }

      const isGain = h.gainLoss >= 0;
      const gainColor = isGain ? "#10b981" : "#f43f5e";

      const sparklineHtml = generateSvgSparkline(h.priceHistory.map(p => p.close), curr);

      return `
        <div style="background-color: #1a1a2e; border: 1px solid #3c4a42; border-radius: 6px; padding: 18px; margin-bottom: 20px; font-family: sans-serif;">
          <!-- Header -->
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
            <div>
              <h3 style="margin: 0; color: #e5e1e4; font-size: 15px; font-weight: bold;">${h.company}</h3>
              <code style="color: #6366f1; font-family: monospace; font-size: 11px;">${h.ticker}</code>
            </div>
            <span style="background-color: ${badgeColor}15; color: ${badgeColor}; border: 1px solid ${badgeColor}30; padding: 4px 8px; border-radius: 4px; font-size: 10px; font-weight: bold; font-family: monospace; letter-spacing: 0.05em; display: inline-block;">
              ${badgeText}
            </span>
          </div>

          <!-- Price Trend Line Chart -->
          ${sparklineHtml}

          <!-- Financial Table with explaining 'i' tooltips -->
          <table style="width: 100%; border-collapse: collapse; margin-top: 12px; font-family: monospace; font-size: 11px;">
            <tr style="color: #71717a; text-transform: uppercase;">
              <td style="padding-bottom: 6px;">
                Invested Price <span style="color: #6366f1; font-weight: bold; cursor: help;" title="The price of the stock on the day it was added.">[i]</span>
              </td>
              <td style="padding-bottom: 6px; text-align: center;">
                Price Today <span style="color: #6366f1; font-weight: bold; cursor: help;" title="The latest regular market price.">[i]</span>
              </td>
              <td style="padding-bottom: 6px; text-align: right;">
                Gain / Loss <span style="color: #6366f1; font-weight: bold; cursor: help;" title="Total return on investment.">[i]</span>
              </td>
            </tr>
            <tr style="color: #e5e1e4; font-size: 13px; font-weight: bold;">
              <td style="padding-bottom: 12px;">${curr}${h.purchasePrice.toLocaleString(locale)}</td>
              <td style="padding-bottom: 12px; text-align: center; color: #10b981;">${curr}${h.currentPrice.toLocaleString(locale)}</td>
              <td style="padding-bottom: 12px; text-align: right; color: ${gainColor};">
                ${isGain ? "+" : ""}${curr}${h.gainLoss.toLocaleString(locale)} (${isGain ? "+" : ""}${h.gainLossPercent}%)
              </td>
            </tr>
            <tr style="color: #71717a; text-transform: uppercase; border-top: 1px solid #222225; padding-top: 6px;">
              <td style="padding-top: 6px; padding-bottom: 4px;">
                Tracked Amount <span style="color: #6366f1; font-weight: bold; cursor: help;" title={`Total intended investment in ${curr === "$" ? "Dollars" : "Rupees"}.`}>[i]</span>
              </td>
              <td style="padding-top: 6px; padding-bottom: 4px; text-align: right;" colspan="2">
                1Y Prediction Range <span style="color: #6366f1; font-weight: bold; cursor: help;" title="Forecasted target return range based on sentiment and trend.">[i]</span>
              </td>
            </tr>
            <tr style="color: #e5e1e4; font-size: 13px; font-weight: bold;">
              <td>${curr}${h.amountInvested.toLocaleString(locale)}</td>
              <td style="text-align: right; color: #4edea3;" colspan="2">${h.predictionRange}</td>
            </tr>
          </table>
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
      <body style="background-color: #131315; color: #e5e1e4; margin: 0; padding: 20px; font-family: sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #0e0e10; border: 1px solid #27272a; border-radius: 8px; padding: 24px;">
          
          <!-- Header -->
          <div style="border-bottom: 1px solid #27272a; padding-bottom: 16px; margin-bottom: 24px; text-align: center;">
            <h1 style="color: #10b981; margin: 0; font-family: sans-serif; font-size: 22px; letter-spacing: 0.05em; font-weight: 700; text-transform: uppercase;">
              PARAKHIQ TERMINAL
            </h1>
            <p style="color: #a1a1aa; margin: 4px 0 0 0; font-size: 11px; font-family: monospace; text-transform: uppercase;">
              Daily Portfolio Digest & Live Returns
            </p>
          </div>

          <!-- Body -->
          <p style="color: #e5e1e4; font-size: 13px; font-family: monospace;">Hello ${userName},</p>
          <p style="color: #bbcabf; font-size: 13px; line-height: 1.5; font-family: monospace;">
            Here is your scheduled morning portfolio update from the ParakhIQ investment agent. Below is the active directional guidance for your holdings, re-calculated using our 1-year extrapolation engine and recent news sentiment analysis:
          </p>

          <div style="margin-top: 24px; margin-bottom: 24px;">
            ${holdingsRows}
          </div>

          <!-- Action Buttons -->
          <table style="width: 100%; margin-top: 30px; margin-bottom: 30px;">
            <tr>
              <td style="text-align: center; padding: 8px;">
                <a href="${appUrl}/portfolio" style="background-color: #10b981; color: #002113; text-decoration: none; padding: 12px 24px; border-radius: 4px; font-weight: bold; font-family: monospace; font-size: 12px; display: inline-block; border: 1px solid #10b981;">
                  OPEN PORTFOLIO TERMINAL
                </a>
              </td>
            </tr>
            <tr>
              <td style="text-align: center; padding: 8px;">
                <a href="${appUrl}/api/preferences/unsubscribe?email=${userEmail}" style="background-color: #f43f5e15; color: #f43f5e; text-decoration: none; padding: 10px 20px; border-radius: 4px; font-weight: bold; font-family: monospace; font-size: 11px; display: inline-block; border: 1px solid #f43f5e30;">
                  TURN OFF DAILY EMAIL DIGEST
                </a>
              </td>
            </tr>
          </table>

          <!-- Footer -->
          <div style="border-top: 1px solid #27272a; padding-top: 16px; margin-top: 30px; color: #71717a; font-size: 10px; text-align: center; font-family: monospace; line-height: 1.4;">
            <p style="margin: 0 0 8px 0;">
              This digest was sent automatically. You can toggle your settings panel at any time.
            </p>
            <p style="margin: 0; color: #86948a;">
              Disclaimer: ParakhIQ is an AI research tool, not financial advice. Past performance is no guarantee of future returns.
            </p>
          </div>

        </div>
      </body>
    </html>
  `;
}
