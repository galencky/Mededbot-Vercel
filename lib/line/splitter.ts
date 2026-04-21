import {
  MAX_TOTAL_CHARS,
  SAFE_CHARS_PER_BUBBLE,
  TRUNCATION_NOTICE,
} from "./limits";

export function splitLongText(
  text: string,
  prefix: string,
  maxBubbles: number,
  charBudget: number = MAX_TOTAL_CHARS,
): string[] {
  if (!text) return [];

  const available = Math.max(1, SAFE_CHARS_PER_BUBBLE - prefix.length);
  const totalBudget = Math.min(charBudget, maxBubbles * available);

  let working = text;
  let truncated = false;
  if (working.length > totalBudget) {
    working = working.slice(0, totalBudget);
    truncated = true;
  }

  if (working.length + prefix.length <= SAFE_CHARS_PER_BUBBLE) {
    const only = prefix + working + (truncated ? TRUNCATION_NOTICE : "");
    return [only];
  }

  const chunks: string[] = [];
  let remaining = working;
  for (let i = 0; i < maxBubbles && remaining.length > 0; i++) {
    const isLast = i === maxBubbles - 1;
    const prefixFor = i === 0 ? prefix : "";
    const budget = SAFE_CHARS_PER_BUBBLE - prefixFor.length;

    if (remaining.length <= budget) {
      chunks.push(prefixFor + remaining);
      remaining = "";
      break;
    }

    let cut = findBreak(remaining, budget);
    if (cut < budget / 2) cut = budget;
    chunks.push(prefixFor + remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).replace(/^\s+/, "");

    if (isLast && remaining.length > 0) {
      truncated = true;
    }
  }

  if (truncated && chunks.length > 0) {
    chunks[chunks.length - 1] += TRUNCATION_NOTICE;
  }
  return chunks;
}

function findBreak(s: string, limit: number): number {
  const slice = s.slice(0, limit);
  const candidates = [
    slice.lastIndexOf("\n\n"),
    slice.lastIndexOf("。"),
    slice.lastIndexOf("\n"),
    slice.lastIndexOf("，"),
    slice.lastIndexOf(". "),
    slice.lastIndexOf(" "),
  ];
  const best = Math.max(...candidates);
  return best > 0 ? best + 1 : limit;
}
