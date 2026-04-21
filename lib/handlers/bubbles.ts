import type { Message as LineMessage } from "@line/bot-sdk";
import type { Session } from "../session/types";
import type { HandlerReply } from "./reply";
import {
  audioMessage,
  enforceLineLimits,
  referencesFlex,
  taigiCreditFlex,
  textMessage,
  truncateForLine,
} from "../line/messages";
import { splitLongText } from "../line/splitter";
import { calculateBubbleBudget, MAX_TOTAL_CHARS } from "../line/limits";

export function buildResponseBubbles(
  session: Session,
  result: HandlerReply,
): LineMessage[] {
  const bubbles: LineMessage[] = [];
  const showTaigiCredit = session.show_taigi_credit === true;

  if (session.tts_audio_url && showTaigiCredit) {
    bubbles.push(taigiCreditFlex());
    bubbles.push(audioMessage(session.tts_audio_url, session.tts_audio_dur ?? 0));
    delete session.tts_audio_url;
    delete session.tts_audio_dur;
    delete session.show_taigi_credit;
  } else if (session.tts_audio_url) {
    bubbles.push(audioMessage(session.tts_audio_url, session.tts_audio_dur ?? 0));
    delete session.tts_audio_url;
    delete session.tts_audio_dur;
  } else if (session.mode === "edu" && result.geminiCalled) {
    const zhContent = session.zh_output ?? "";
    const translatedContent = session.translated_output ?? "";
    const justTranslated = session.just_translated === true;
    if (justTranslated) delete session.just_translated;

    let used = result.text.length;
    const refs = session.references ?? [];
    if (refs.length) used += refs.length * 200;
    const remainingBudget = Math.max(500, MAX_TOTAL_CHARS - used - 200);

    const hasAudio = false;
    const hasRefs = refs.length > 0;
    const availableBubbles = calculateBubbleBudget({
      hasReferences: hasRefs,
      hasAudio,
      hasTaigiCredit: false,
    });

    if (justTranslated && translatedContent) {
      for (const chunk of splitLongText(
        translatedContent,
        "🌐 譯文：\n",
        availableBubbles,
        remainingBudget,
      )) {
        bubbles.push(textMessage(chunk));
      }
    } else if (zhContent && !justTranslated) {
      for (const chunk of splitLongText(
        zhContent,
        "📄 原文：\n",
        availableBubbles,
        remainingBudget,
      )) {
        bubbles.push(textMessage(chunk));
      }
    }
  }

  if (session.mode === "edu" && result.geminiCalled) {
    const refs = session.references ?? [];
    const flex = referencesFlex(refs);
    if (flex) bubbles.push(flex);
  }

  const main = textMessage(truncateForLine(result.text), result.quickReply);
  bubbles.push(main);

  return enforceLineLimits(bubbles);
}
