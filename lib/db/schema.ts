import { pgTable, serial, text, timestamp, boolean, varchar } from "drizzle-orm/pg-core";

export const chatLogs = pgTable("chat_logs", {
  id: serial("id").primaryKey(),
  timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow().notNull(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  message: text("message"),
  reply: text("reply"),
  actionType: varchar("action_type", { length: 100 }),
  geminiCall: boolean("gemini_call").default(false),
  geminiOutputUrl: text("gemini_output_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const ttsLogs = pgTable("tts_logs", {
  id: serial("id").primaryKey(),
  timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow().notNull(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  text: text("text"),
  audioFilename: varchar("audio_filename", { length: 255 }),
  audioUrl: text("audio_url"),
  driveLink: text("drive_link"),
  status: varchar("status", { length: 50 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const voicemailLogs = pgTable("voicemail_logs", {
  id: serial("id").primaryKey(),
  timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow().notNull(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  audioFilename: varchar("audio_filename", { length: 255 }),
  transcription: text("transcription"),
  translation: text("translation"),
  driveLink: text("drive_link"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type ChatLog = typeof chatLogs.$inferSelect;
export type NewChatLog = typeof chatLogs.$inferInsert;
export type NewTtsLog = typeof ttsLogs.$inferInsert;
export type NewVoicemailLog = typeof voicemailLogs.$inferInsert;
