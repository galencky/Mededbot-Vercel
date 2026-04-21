export const MAX_BUBBLE_COUNT = 5;
export const MAX_CONTENT_BUBBLES = 3;
export const MAX_TOTAL_CHARS = 5000;
export const MAX_CHARS_PER_BUBBLE = 2000;
export const SAFE_CHARS_PER_BUBBLE = 1950;

export const TRUNCATION_NOTICE =
  "\n\n⚠️ 內容因超過 LINE 限制已截斷\n請使用寄送功能寄至電子郵件觀看全文";

export function calculateBubbleBudget(opts: {
  hasReferences?: boolean;
  hasAudio?: boolean;
  hasTaigiCredit?: boolean;
}): number {
  const used =
    1 +
    (opts.hasReferences ? 1 : 0) +
    (opts.hasAudio ? 1 : 0) +
    (opts.hasTaigiCredit ? 1 : 0);
  const available = MAX_BUBBLE_COUNT - used;
  return Math.max(1, Math.min(available, MAX_CONTENT_BUBBLES));
}
