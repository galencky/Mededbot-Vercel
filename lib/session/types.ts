export interface Reference {
  title: string;
  url: string;
}

export interface Session {
  started?: boolean;
  user_id?: string;
  mode?: "edu" | "chat" | null;

  // education
  zh_output?: string;
  translated_output?: string;
  translated?: boolean;
  awaiting_modify?: boolean;
  awaiting_translate_language?: boolean;
  awaiting_email?: boolean;
  last_topic?: string;
  last_translation_lang?: string;
  just_translated?: boolean;
  references?: Reference[];
  email_r2_url?: string;
  show_taigi_credit?: boolean;

  // chat
  chat_target_lang?: string;
  awaiting_chat_language?: boolean;

  // tts
  tts_audio_url?: string;
  tts_audio_dur?: number;
}

export function emptySession(): Session {
  return {};
}
