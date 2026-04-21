import type { QuickReply, QuickReplyItem } from "@line/bot-sdk";

type Option = readonly [label: string, text: string];

export const MODE_SELECTION_OPTIONS: Option[] = [
  ["🏥 衛教單張", "衛教"],
  ["💬 醫療翻譯", "chat"],
];

export const COMMON_LANGUAGES: Option[] = [
  ["🇹🇼 中文(繁體)", "中文(繁體)"],
  ["🇹🇼 台語", "台語"],
  ["🇬🇧 英文", "英文"],
  ["🇯🇵 日文", "日文"],
  ["🇰🇷 韓文", "韓文"],
  ["🇹🇭 泰文", "泰文"],
  ["🇻🇳 越南文", "越南文"],
  ["🇮🇩 印尼文", "印尼文"],
  ["🇪🇸 西班牙文", "西班牙文"],
  ["🇫🇷 法文", "法文"],
];

export const EDU_LANGUAGES: Option[] = COMMON_LANGUAGES.filter(
  ([, t]) => t !== "台語",
);

export const COMMON_DISEASES: Option[] = [
  ["糖尿病", "糖尿病"],
  ["高血壓", "高血壓"],
  ["心臟病", "心臟病"],
  ["氣喘", "氣喘"],
  ["過敏", "過敏"],
  ["流感", "流感"],
  ["COVID-19", "COVID-19"],
  ["腎臟病", "腎臟病"],
];

export const EDU_ACTIONS: Option[] = [
  ["✏️ 修改", "modify"],
  ["🌐 翻譯", "translate"],
  ["📧 寄送", "mail"],
  ["🆕 新對話", "new"],
];

export const EDU_ACTIONS_NO_MODIFY: Option[] = [
  ["🌐 翻譯", "translate"],
  ["📧 寄送", "mail"],
  ["🆕 新對話", "new"],
];

export const TTS_OPTIONS: Option[] = [
  ["🔊 朗讀", "朗讀"],
  ["🆕 新對話", "new"],
];

export const CHAT_TTS_OPTIONS: Option[] = [
  ["🔊 朗讀", "朗讀"],
  ["💬 繼續翻譯", "繼續翻譯"],
  ["🆕 新對話", "new"],
];

export const CHAT_CONTINUE_OPTIONS: Option[] = [
  ["💬 繼續翻譯", "繼續翻譯"],
  ["🆕 新對話", "new"],
];

export const START_OPTIONS: Option[] = [["🆕 開始", "new"]];

export function buildQuickReply(options: readonly Option[]): QuickReply {
  const items: QuickReplyItem[] = options.slice(0, 13).map(([label, text]) => ({
    type: "action",
    action: { type: "message", label, text },
  }));
  return { items };
}
