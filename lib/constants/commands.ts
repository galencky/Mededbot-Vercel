export const newCommands = new Set(["new", "開始"]);
export const eduCommands = new Set(["ed", "education", "衛教"]);
export const chatCommands = new Set(["chat", "聊天"]);
export const modifyCommands = new Set(["modify", "修改"]);
export const translateCommands = new Set(["translate", "翻譯", "trans"]);
export const mailCommands = new Set(["mail", "寄送"]);
export const speakCommands = new Set(["speak", "朗讀"]);

export const TAIGI_LANGS = new Set(["台語", "臺語", "taiwanese", "taigi"]);

export function isTaigi(lang: string | undefined | null): boolean {
  return !!lang && TAIGI_LANGS.has(lang.toLowerCase());
}
