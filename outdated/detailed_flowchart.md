# Mededbot Detailed System Flowchart & Debug Guide

This document provides detailed diagrams of how each script and function interact, including input/output data formats. Use this as a reference for debugging system failures.

---

## Table of Contents
1. [System Overview](#system-overview)
2. [Entry Points & Request Flow](#entry-points--request-flow)
3. [Text Message Processing](#text-message-processing)
4. [Audio Message Processing](#audio-message-processing)
5. [Education Mode Flow](#education-mode-flow)
6. [Medical Chat Mode Flow](#medical-chat-mode-flow)
7. [TTS Generation Flow](#tts-generation-flow)
8. [Email Sending Flow](#email-sending-flow)
9. [Database & Logging Flow](#database--logging-flow)
10. [External API Interactions](#external-api-interactions)
11. [Error Handling & Recovery](#error-handling--recovery)
12. [Debug Checklist by Symptom](#debug-checklist-by-symptom)

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              MEDEDBOT SYSTEM                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────┐     ┌──────────────┐     ┌─────────────────────────────────┐  │
│  │   LINE   │────▶│   FastAPI    │────▶│         HANDLERS                │  │
│  │  Users   │     │   (main.py)  │     │  ┌─────────────────────────┐    │  │
│  └──────────┘     └──────┬───────┘     │  │ line_handler.py         │    │  │
│                          │             │  │ logic_handler.py        │    │  │
│                          │             │  │ medchat_handler.py      │    │  │
│                          ▼             │  │ mail_handler.py         │    │  │
│                   ┌──────────────┐     │  │ session_manager.py      │    │  │
│                   │   webhook.py │     │  └─────────────────────────┘    │  │
│                   └──────────────┘     └─────────────────────────────────┘  │
│                                                       │                      │
│                                                       ▼                      │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                           SERVICES                                     │  │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐        │  │
│  │  │ gemini_service  │  │  tts_service    │  │ taigi_service   │        │  │
│  │  │ (AI generation) │  │  (Gemini TTS)   │  │ (NYCU Taigi)    │        │  │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘        │  │
│  │  ┌─────────────────┐                                                   │  │
│  │  │  stt_service    │                                                   │  │
│  │  │  (transcribe)   │                                                   │  │
│  │  └─────────────────┘                                                   │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                        │                                     │
│                                        ▼                                     │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                           UTILITIES                                    │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │  │
│  │  │  database   │  │  logging    │  │ r2_service  │  │email_service│   │  │
│  │  │ (PostgreSQL)│  │ (async log) │  │ (R2 upload) │  │ (Gmail SMTP)│   │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘   │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Entry Points & Request Flow

### 1. Application Startup (main.py)

```
┌─────────────────────────────────────────────────────────────────┐
│                    APPLICATION STARTUP                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  uvicorn main:app                                                │
│         │                                                        │
│         ▼                                                        │
│  ┌─────────────────────────────────────┐                        │
│  │  lifespan(app) [async context mgr]  │                        │
│  │  Location: main.py:54-83            │                        │
│  └──────────────┬──────────────────────┘                        │
│                 │                                                │
│         ┌───────┴───────┐                                       │
│         ▼               ▼                                       │
│  ┌─────────────┐  ┌──────────────────────┐                     │
│  │ Start       │  │ Test DB connection   │                     │
│  │ cleanup     │  │ get_async_db_engine()│                     │
│  │ task        │  │ database.py:60-85    │                     │
│  └─────────────┘  └──────────────────────┘                     │
│                                                                  │
│  On Shutdown:                                                    │
│  - Cancel cleanup task                                           │
│  - cleanup_expired_sessions()                                    │
│  - memory_storage.clear_all()                                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2. Webhook Request Flow (routes/webhook.py)

```
LINE Platform
     │
     │ POST /webhook
     │ Headers: x-line-signature
     │ Body: JSON event data
     ▼
┌─────────────────────────────────────────────────────────────────┐
│  webhook(request, x_line_signature)                              │
│  Location: routes/webhook.py:14-54                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Timeout wrapper: 48 seconds max                              │
│     asyncio.wait_for(handle_request(), timeout=48.0)             │
│                                                                  │
│  2. Read request body                                            │
│     body = await request.body()                                  │
│                                                                  │
│  3. Validate LINE signature                                      │
│     handler.handle(body_str, x_line_signature)                   │
│     ↓                                                            │
│     WebhookHandler validates HMAC-SHA256                         │
│                                                                  │
│  4. Route by message type:                                       │
│     ┌─────────────────┬─────────────────────────────────────┐   │
│     │ Message Type    │ Handler Function                     │   │
│     ├─────────────────┼─────────────────────────────────────┤   │
│     │ TextMessage     │ handle_line_message()               │   │
│     │ AudioMessage    │ handle_audio_message()              │   │
│     │ StickerMessage  │ fallback_handler() [ignored]        │   │
│     │ ImageMessage    │ fallback_handler() [ignored]        │   │
│     └─────────────────┴─────────────────────────────────────┘   │
│                                                                  │
│  5. ALWAYS return "OK" to prevent LINE retries                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

ERROR HANDLING:
- TimeoutError → Return "OK", log timeout
- ValueError (invalid signature) → Return "OK", log warning
- Any Exception → Return "OK", log full traceback
```

---

## Text Message Processing

### Complete Text Message Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        TEXT MESSAGE PROCESSING                               │
└─────────────────────────────────────────────────────────────────────────────┘

LINE TextMessage Event
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  handle_line_message(event)                                      │
│  Location: handlers/line_handler.py:34-111                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  INPUT:                                                          │
│    event.source.user_id: str (e.g., "U1234567890abcdef...")     │
│    event.message.text: str (user's message)                      │
│    event.reply_token: str (for replying)                         │
│                                                                  │
│  PROCESS:                                                        │
│    1. session = get_user_session(user_id)                       │
│       └─▶ session_manager.py:17-27                              │
│           Returns: Dict (user session data)                      │
│                                                                  │
│    2. reply_text, gemini_called, quick_reply = handle_user_message()│
│       └─▶ logic_handler.py:31-88                                │
│           Returns: Tuple[str, bool, Optional[Dict]]              │
│                                                                  │
│    3. bubbles = create_message_bubbles(session, reply_text, ...)│
│       └─▶ line_handler.py:168-330                               │
│           Returns: List[SendMessage objects]                     │
│                                                                  │
│    4. line_bot_api.reply_message(event.reply_token, bubbles)    │
│                                                                  │
│    5. log_chat(user_id, input, reply, session, ...)             │
│       └─▶ logging.py:349-367                                    │
│                                                                  │
│  OUTPUT:                                                         │
│    LINE reply with message bubbles (max 5, max 5000 chars)       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### handle_user_message() - Main Dispatcher

```
┌─────────────────────────────────────────────────────────────────┐
│  handle_user_message(user_id, text, session)                     │
│  Location: handlers/logic_handler.py:31-88                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  INPUT:                                                          │
│    user_id: str                                                  │
│    text: str (user message)                                      │
│    session: Dict (mutable session object)                        │
│                                                                  │
│  DECISION TREE:                                                  │
│                                                                  │
│  text.lower() in new_commands? ──────────────────▶ handle_new_command()
│         │ NO                                                     │
│         ▼                                                        │
│  text.lower() in speak_commands? ────────────────▶ handle_speak_command()
│         │ NO                                                     │
│         ▼                                                        │
│  session["started"] == False? ───────────────────▶ "請點擊【開始】"
│         │ NO                                                     │
│         ▼                                                        │
│  session["mode"] == None? ─────▶ Mode Selection                  │
│         │                       ├─ "ed/edu" → mode="edu"         │
│         │                       └─ "chat"  → mode="chat"         │
│         │ NO                                                     │
│         ▼                                                        │
│  session["mode"] == "edu"? ──────────────────────▶ handle_education_mode()
│         │ NO                                                     │
│         ▼                                                        │
│  session["mode"] == "chat"? ─────────────────────▶ handle_medchat()
│                                                                  │
│  OUTPUT:                                                         │
│    Tuple[str, bool, Optional[Dict]]                              │
│    (reply_text, gemini_called, quick_reply_data)                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Session Data Structure

```
┌─────────────────────────────────────────────────────────────────┐
│                     SESSION DATA STRUCTURE                       │
│                  Location: session_manager.py                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  session: Dict = {                                               │
│      # Core State                                                │
│      "started": bool,           # User has started session       │
│      "mode": str|None,          # "edu" | "chat" | None          │
│      "user_id": str,            # LINE user ID                   │
│                                                                  │
│      # Education Mode                                            │
│      "zh_output": str,          # Generated Chinese content      │
│      "translated_output": str,  # Translated content             │
│      "last_topic": str,         # Topic (first 30 chars)         │
│      "last_translation_lang": str,  # Target language            │
│      "references": List[Dict],  # [{title, url}, ...]            │
│      "translated": bool,        # Has been translated            │
│      "just_translated": bool,   # Just completed translation     │
│                                                                  │
│      # Awaiting States                                           │
│      "awaiting_modify": bool,                                    │
│      "awaiting_translate_language": bool,                        │
│      "awaiting_email": bool,                                     │
│      "awaiting_chat_language": bool,                             │
│                                                                  │
│      # Chat Mode                                                 │
│      "chat_target_lang": str,   # Target language for chat       │
│                                                                  │
│      # TTS State                                                 │
│      "tts_audio_url": str,      # Generated audio URL            │
│      "tts_audio_dur": int,      # Duration in milliseconds       │
│      "show_taigi_credit": bool, # Show NYCU credit bubble        │
│                                                                  │
│      # Email                                                     │
│      "email_r2_url": str,       # R2 URL of email log            │
│  }                                                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Audio Message Processing

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        AUDIO MESSAGE PROCESSING                              │
└─────────────────────────────────────────────────────────────────────────────┘

LINE AudioMessage Event
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  handle_audio_message(event)                                     │
│  Location: handlers/line_handler.py:113-166                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  PREREQUISITE CHECK:                                             │
│    session["mode"] == "chat" AND session["chat_target_lang"]    │
│    If not met → _get_audio_rejection_response()                  │
│                                                                  │
│  PROCESS:                                                        │
│                                                                  │
│  1. Download audio from LINE                                     │
│     audio_content = line_bot_api.get_message_content(message_id)│
│                                                                  │
│  2. Save audio file temporarily                                  │
│     audio_path = save_audio_file(user_id, audio_content)         │
│     └─▶ line_handler.py:352-377                                 │
│         Saves to: voicemail/{user_id}_{timestamp}.m4a            │
│         Max size: 10MB                                           │
│                                                                  │
│  3. Transcribe audio                                             │
│     transcription = transcribe_audio_file(str(audio_path))       │
│     └─▶ stt_service.py:18-91                                    │
│         Uses: Gemini gemini-2.5-flash                            │
│         Returns: str (transcribed text)                          │
│                                                                  │
│  4. Delete temporary audio file                                  │
│     audio_path.unlink()                                          │
│                                                                  │
│  5. Process transcription as text                                │
│     reply, gemini_called, quick_reply = handle_medchat(...)      │
│     └─▶ medchat_handler.py:17-110                               │
│                                                                  │
│  6. Create and send response                                     │
│     Response includes: "🎤 語音訊息：\n{transcription}\n\n{reply}"│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Speech-to-Text Service

```
┌─────────────────────────────────────────────────────────────────┐
│  transcribe_audio_file(file_path)                                │
│  Location: services/stt_service.py:18-91                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  INPUT:                                                          │
│    file_path: str (path to audio file)                           │
│    Supported: M4A, AAC, MP3, WAV, OGG, FLAC, AIFF                │
│                                                                  │
│  PROCESS:                                                        │
│    1. Try file upload via Gemini Files API                       │
│       _client.files.upload(file=file_path)                       │
│                                                                  │
│    2. If MIME error, use inline data approach:                   │
│       - Read audio bytes                                         │
│       - Detect MIME type                                         │
│       - Create types.Part.from_bytes(data, mime_type)            │
│                                                                  │
│    3. Call Gemini for transcription                              │
│       Model: gemini-2.5-flash                                    │
│       Prompt: Transcription assistant instructions               │
│       Config: temperature=0.0, response_mime_type="text/plain"   │
│                                                                  │
│  OUTPUT:                                                         │
│    str (transcribed text, cleaned)                               │
│                                                                  │
│  ERRORS:                                                         │
│    RuntimeError("Failed to upload audio...")                     │
│    RuntimeError("Failed to get transcription...")                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Education Mode Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          EDUCATION MODE FLOW                                 │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  handle_education_mode(session, text, text_lower, user_id)       │
│  Location: handlers/logic_handler.py:152-210                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  STATE MACHINE:                                                  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                                                           │   │
│  │   awaiting_modify? ────────▶ handle_modify_response()    │   │
│  │         │ NO                                              │   │
│  │         ▼                                                 │   │
│  │   awaiting_translate_language? ─▶ handle_translate_response()│
│  │         │ NO                                              │   │
│  │         ▼                                                 │   │
│  │   awaiting_email? ─────────▶ handle_email_response()     │   │
│  │         │ NO                                              │   │
│  │         ▼                                                 │   │
│  │   text in modify_commands? ─▶ Set awaiting_modify=True   │   │
│  │         │ NO                                              │   │
│  │         ▼                                                 │   │
│  │   text in translate_commands? ▶ Set awaiting_translate=True│  │
│  │         │ NO                                              │   │
│  │         ▼                                                 │   │
│  │   text in mail_commands? ───▶ Set awaiting_email=True    │   │
│  │         │ NO                                              │   │
│  │         ▼                                                 │   │
│  │   zh_output not exists? ────▶ GENERATE NEW CONTENT       │   │
│  │         │                    ├─ call_zh(text)            │   │
│  │         │                    ├─ get_references()         │   │
│  │         │                    └─ Store in session         │   │
│  │         │ EXISTS                                          │   │
│  │         ▼                                                 │   │
│  │   Show action options                                     │   │
│  │                                                           │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Content Generation (call_zh)

```
┌─────────────────────────────────────────────────────────────────┐
│  call_zh(prompt, system_prompt=zh_prompt)                        │
│  Location: services/gemini_service.py:107-110                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  INPUT:                                                          │
│    prompt: str (user's health topic, e.g., "糖尿病 飲食控制")    │
│    system_prompt: str (from prompt_config.py)                    │
│                                                                  │
│  INTERNAL CALL:                                                  │
│    _call_genai(prompt, sys_prompt=system_prompt, temp=0.25)      │
│    └─▶ gemini_service.py:41-105                                 │
│                                                                  │
│  API CONFIGURATION:                                              │
│    Model: gemini-2.5-flash                                       │
│    Temperature: 0.25                                             │
│    Max tokens: 5000                                              │
│    Tools: Google Search (grounding)                              │
│    Timeout: 45 seconds                                           │
│    Retries: 2 (with 3s delay)                                    │
│                                                                  │
│  RATE LIMITING:                                                  │
│    @rate_limit(gemini_limiter, key_func=lambda: "global")        │
│    Limit: 30 requests/minute                                     │
│                                                                  │
│  CIRCUIT BREAKER:                                                │
│    gemini_circuit_breaker.call(api_call)                         │
│    Threshold: 5 failures → 60s recovery                          │
│                                                                  │
│  OUTPUT:                                                         │
│    str (Chinese health education content)                        │
│                                                                  │
│  SIDE EFFECTS:                                                   │
│    _last_response is stored for reference extraction             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Reference Extraction

```
┌─────────────────────────────────────────────────────────────────┐
│  get_references()                                                │
│  Location: services/gemini_service.py:133-170                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  READS FROM:                                                     │
│    _last_response (global, set by _call_genai)                   │
│                                                                  │
│  EXTRACTION PATH:                                                │
│    response.candidates[0]                                        │
│      └─ grounding_metadata                                       │
│          └─ search_entry_point                                   │
│              └─ rendered_content (HTML)                          │
│                  └─ Parse with BeautifulSoup                     │
│                      └─ Find all <a class="chip">                │
│                                                                  │
│  OUTPUT:                                                         │
│    List[Dict] = [                                                │
│        {"title": "Article Title", "url": "https://..."},         │
│        ...                                                       │
│    ]                                                             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Translation Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  handle_translate_response(session, language, user_id)           │
│  Location: handlers/logic_handler.py:248-287                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  INPUT:                                                          │
│    session: Dict (contains zh_output)                            │
│    language: str (target language, e.g., "English", "日文")      │
│                                                                  │
│  PROCESS:                                                        │
│    1. Normalize language input                                   │
│       language = normalize_language_input(language)              │
│       └─▶ language_utils.py                                     │
│                                                                  │
│    2. Block Taigi in edu mode                                    │
│       if language in ["台語", "臺語", "taiwanese", "taigi"]:     │
│           return error message                                   │
│                                                                  │
│    3. Call translation                                           │
│       translated = call_translate(session["zh_output"], language)│
│       └─▶ gemini_service.py:112-116                             │
│                                                                  │
│    4. Get and merge new references                               │
│       new_refs = get_references()                                │
│       Merge with existing, dedupe by URL                         │
│                                                                  │
│    5. Update session                                             │
│       session["translated_output"] = translated                  │
│       session["just_translated"] = True                          │
│                                                                  │
│  OUTPUT:                                                         │
│    ("🌐 翻譯完成...", True, quick_reply)                         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Medical Chat Mode Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          MEDICAL CHAT MODE FLOW                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  handle_medchat(user_id, raw, session)                           │
│  Location: handlers/medchat_handler.py:17-110                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  STATE MACHINE:                                                  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                                                            │  │
│  │  raw == "繼續翻譯"? ──────────▶ Clear TTS, return prompt   │  │
│  │         │ NO                                               │  │
│  │         ▼                                                  │  │
│  │  awaiting_chat_language? ─────▶ Process language selection │  │
│  │         │ NO                   └─ Validate with _looks_like_language()│
│  │         │                      └─ Set chat_target_lang     │  │
│  │         ▼                                                  │  │
│  │  chat_target_lang not set? ───▶ Set awaiting=True, ask     │  │
│  │         │ NO (language set)                                │  │
│  │         ▼                                                  │  │
│  │  PROCESS TRANSLATION:                                      │  │
│  │                                                            │  │
│  │  1. plain_zh = plainify(raw)                               │  │
│  │     └─▶ Simplify medical language to plain Chinese         │  │
│  │                                                            │  │
│  │  2. Check target language:                                 │  │
│  │     ├─ Taigi? → translated = translate_to_taigi(plain_zh)  │  │
│  │     │           └─▶ taigi_service.py:107-147              │  │
│  │     │                                                      │  │
│  │     └─ Other? → translated = confirm_translate(plain_zh, lang)│
│  │                 └─▶ gemini_service.py:125-131             │  │
│  │                                                            │  │
│  │  3. Store results in session:                              │  │
│  │     session["zh_output"] = plain_zh                        │  │
│  │     session["translated_output"] = translated              │  │
│  │                                                            │  │
│  │  4. Log to database                                        │  │
│  │     log_chat(user_id, raw, reply_text, session, ...)       │  │
│  │                                                            │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  OUTPUT:                                                         │
│    reply_text = "您是否想表達（{lang}）：\n{plain_zh}\n\n{translated}"│
│    Tuple[str, bool, Dict]                                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## TTS Generation Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          TTS GENERATION FLOW                                 │
└─────────────────────────────────────────────────────────────────────────────┘

User sends "speak" or "朗讀"
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  handle_speak_command(session, user_id)                          │
│  Location: handlers/logic_handler.py:101-145                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  VALIDATION:                                                     │
│    - mode != "edu" (edu mode doesn't support TTS)                │
│    - tts_audio_url not already exists                            │
│    - translated_output exists                                    │
│                                                                  │
│  PROCESS:                                                        │
│    Check last_translation_lang:                                  │
│                                                                  │
│    ┌────────────────────────────────────────────────────────┐   │
│    │                                                         │   │
│    │  IF Taigi ("台語", "臺語", "taiwanese", "taigi"):       │   │
│    │      url, duration = synthesize_taigi(zh_source, user_id)│  │
│    │      └─▶ taigi_service.py:149-237                      │   │
│    │      session["show_taigi_credit"] = True                │   │
│    │                                                         │   │
│    │  ELSE (other languages):                                │   │
│    │      url, duration = synthesize(tts_source, user_id)    │   │
│    │      └─▶ tts_service.py:36-162                         │   │
│    │                                                         │   │
│    └────────────────────────────────────────────────────────┘   │
│                                                                  │
│    Store in session:                                             │
│      session["tts_audio_url"] = url                              │
│      session["tts_audio_dur"] = duration                         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Gemini TTS Service

```
┌─────────────────────────────────────────────────────────────────┐
│  synthesize(text, user_id, voice_name="Kore")                    │
│  Location: services/tts_service.py:36-162                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  INPUT:                                                          │
│    text: str (max 5000 chars, truncated if longer)               │
│    user_id: str (sanitized)                                      │
│    voice_name: str (default "Kore")                              │
│                                                                  │
│  RATE LIMITING:                                                  │
│    @rate_limit(tts_limiter, key_func=user_id)                    │
│    Limit: 20 requests/minute per user                            │
│                                                                  │
│  API CALL:                                                       │
│    Model: gemini-2.5-flash-preview-tts                           │
│    Config:                                                       │
│      response_modalities=["AUDIO"]                               │
│      speech_config with voice_name                               │
│                                                                  │
│  STORAGE:                                                        │
│    IF TTS_USE_MEMORY:                                            │
│      - Convert PCM to WAV in memory                              │
│      - memory_storage.save(filename, wav_data, "audio/wav")      │
│      - URL: {BASE_URL}/audio/{filename}                          │
│    ELSE:                                                         │
│      - Save to disk: tts_audio/{user_id}_{timestamp}.wav         │
│      - URL: {BASE_URL}/static/{filename}                         │
│                                                                  │
│  BACKGROUND LOGGING:                                             │
│    log_tts_async(user_id, text, audio_path, url)                 │
│    └─▶ Uploads to R2 asynchronously                             │
│                                                                  │
│  OUTPUT:                                                         │
│    Tuple[str, int] = (audio_url, duration_ms)                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Taigi TTS Service

```
┌─────────────────────────────────────────────────────────────────┐
│  synthesize_taigi(text, user_id)                                 │
│  Location: services/taigi_service.py:149-237                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  INPUT:                                                          │
│    text: str (Chinese text)                                      │
│    user_id: str                                                  │
│                                                                  │
│  EXTERNAL API:                                                   │
│    Base: http://tts001.ivoice.tw:8804/                           │
│                                                                  │
│  PROCESS:                                                        │
│    1. Get TLPA romanization                                      │
│       tlpa = translate_to_taigi(text)                            │
│       └─ GET /html_taigi_zh_tw_py?text0={text}                  │
│       └─ Timeout: 20s                                           │
│                                                                  │
│    2. Generate audio from TLPA                                   │
│       wav_bytes = taigi_tts(tlpa=tlpa, ...)                      │
│       └─ GET /synthesize_TLPA?text1={tlpa}&gender=女聲&accent=強勢腔│
│       └─ Timeout: 60s                                           │
│                                                                  │
│    3. Save audio (memory or disk)                                │
│    4. Log asynchronously                                         │
│                                                                  │
│  OUTPUT:                                                         │
│    Tuple[str, int] = (audio_url, duration_ms)                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Email Sending Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          EMAIL SENDING FLOW                                  │
└─────────────────────────────────────────────────────────────────────────────┘

User enters email address
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  handle_email_response(session, email, user_id)                  │
│  Location: handlers/logic_handler.py:289-316                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Validate email format                                        │
│     validated_email = validate_email(email)                      │
│     └─▶ validators.py                                           │
│                                                                  │
│  2. Check MX record                                              │
│     dns.resolver.resolve(domain, "MX", lifetime=3)               │
│                                                                  │
│  3. Send email                                                   │
│     success, r2_url = send_last_txt_email(user_id, email, session)│
│     └─▶ mail_handler.py:6-83                                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  send_last_txt_email(user_id, to_email, session)                 │
│  Location: handlers/mail_handler.py:6-83                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Extract content from session                                 │
│     zh = session["zh_output"]                                    │
│     translated = session["translated_output"]                    │
│     references = session["references"]                           │
│                                                                  │
│  2. Compose email body                                           │
│     content = "📄 原文：\n{zh}\n\n🌐 譯文：\n{translated}{refs}"  │
│                                                                  │
│  3. Upload to R2 (for logging)                                   │
│     email_log = EmailLog.create(...)                             │
│     r2_service.upload_text_file(email_log_content, filename)     │
│     └─▶ r2_service.py                                           │
│                                                                  │
│  4. Send via Gmail SMTP                                          │
│     success = send_email(to_email, subject, content)             │
│     └─▶ email_service.py:40-60                                  │
│         SMTP: smtp.gmail.com:465 (SSL)                           │
│                                                                  │
│  OUTPUT:                                                         │
│    Tuple[bool, str] = (success, r2_url)                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Database & Logging Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          DATABASE & LOGGING FLOW                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  log_chat(user_id, message, reply, session, ...)                 │
│  Location: utils/logging.py:349-367                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  CONTEXT DETECTION:                                              │
│    try:                                                          │
│        loop = asyncio.get_running_loop()                         │
│        → ASYNC: Create task for _async_log_chat()                │
│    except RuntimeError:                                          │
│        → SYNC: Call log_chat_sync() in thread pool               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  _async_log_chat(user_id, message, reply, session, ...)          │
│  Location: utils/logging.py:20-64                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Upload Gemini log to R2 (if gemini_call="yes")               │
│     drive_url = await _upload_gemini_log_r2(user_id, session)    │
│     └─▶ Runs in _logging_executor (ThreadPool, 5 workers)       │
│                                                                  │
│  2. Log to PostgreSQL                                            │
│     await log_chat_to_db(user_id, message, reply, ...)           │
│     └─▶ database.py:153-189                                     │
│                                                                  │
│  DATABASE SCHEMA (ChatLog):                                      │
│    id, timestamp, user_id, message, reply,                       │
│    action_type, gemini_call, gemini_output_url, created_at       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  log_tts_async(user_id, text, audio_path, audio_url)             │
│  Location: utils/logging.py:295-325                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  FIRE-AND-FORGET:                                                │
│    Runs in _logging_executor (ThreadPool)                        │
│                                                                  │
│  PROCESS:                                                        │
│    1. Upload audio to R2                                         │
│       _upload_audio_file(audio_path, "TTS Upload")               │
│       └─▶ r2_service.upload_audio_file(...)                     │
│                                                                  │
│    2. Log to PostgreSQL                                          │
│       await log_tts_to_db(user_id, text, filename, ...)          │
│       └─▶ database.py:191-214                                   │
│                                                                  │
│  DATABASE SCHEMA (TTSLog):                                       │
│    id, timestamp, user_id, text, audio_filename,                 │
│    audio_url, drive_link, status, created_at                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## External API Interactions

### API Summary Table

| Service | Endpoint | Timeout | Rate Limit | Circuit Breaker |
|---------|----------|---------|------------|-----------------|
| Gemini AI | `gemini-2.5-flash` | 45s | 30/min | Yes (5 fail → 60s) |
| Gemini TTS | `gemini-2.5-flash-preview-tts` | default | 20/min/user | No |
| Gemini STT | `gemini-2.5-flash` | default | None | No |
| Taigi Translation | `tts001.ivoice.tw:8804/html_taigi_zh_tw_py` | 20s | 30/min | No |
| Taigi TTS | `tts001.ivoice.tw:8804/synthesize_TLPA` | 60s | 30/min | No |
| Gmail SMTP | `smtp.gmail.com:465` | default | None | No |
| Cloudflare R2 | S3-compatible | default | None | No |
| PostgreSQL (Neon) | Async/Sync | 30s pool | 5 connections | No |

---

## Error Handling & Recovery

### Error Propagation Path

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        ERROR PROPAGATION PATH                                │
└─────────────────────────────────────────────────────────────────────────────┘

External API Error
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  SERVICE LAYER (gemini_service, tts_service, etc.)               │
│  - Catch specific exceptions                                     │
│  - Retry with backoff (where configured)                         │
│  - Return user-friendly error message                            │
│    e.g., "⚠️ AI 服務暫時無法使用，請稍後再試。"                  │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  HANDLER LAYER (logic_handler, line_handler)                     │
│  - Catch ValueError, RuntimeError                                │
│  - Pass error message as reply_text                              │
│  - Continue normal flow (session preserved)                      │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  WEBHOOK LAYER (webhook.py)                                      │
│  - Catch ALL exceptions                                          │
│  - Log full traceback                                            │
│  - ALWAYS return "OK" to LINE                                    │
└─────────────────────────────────────────────────────────────────┘
```

### Error Messages by Source

| Source | Error Condition | User Message |
|--------|-----------------|--------------|
| Gemini | Timeout | "⚠️ AI 服務響應超時，請稍後再試。" |
| Gemini | Circuit breaker open | "⚠️ AI 服務暫時過載，請稍等片刻後再試。" |
| Gemini | Other API error | "⚠️ AI 服務暫時無法使用，請稍後再試。" |
| TTS | Empty response | ValueError raised |
| TTS | Empty text input | ValueError raised |
| Taigi | Translation timeout | "⚠️ 台語翻譯服務逾時，請稍後再試。" |
| Taigi | Connection error | "⚠️ 無法連接台語服務，請檢查網路連線。" |
| Email | Invalid format | "輸入的 email 格式不正確..." |
| Email | MX check fail | "無法驗證 {domain} 的郵件伺服器..." |
| Email | Send fail | "郵件寄送失敗。請檢查網路連線後再試一次。" |
| STT | Upload fail | RuntimeError raised |
| LINE | API error | "系統錯誤：訊息內容過長..." |
| General | Unhandled | "系統發生錯誤，請稍後再試。" |

---

## Debug Checklist by Symptom

### 1. Bot Not Responding

```
┌─────────────────────────────────────────────────────────────────┐
│  SYMPTOM: Bot receives messages but doesn't reply                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  CHECK ORDER:                                                    │
│                                                                  │
│  1. Webhook receiving requests?                                  │
│     └─ Check: Render logs for "[WEBHOOK]" messages               │
│     └─ File: routes/webhook.py:14-54                            │
│                                                                  │
│  2. Signature validation passing?                                │
│     └─ Check: Look for "Invalid signature" in logs               │
│     └─ Fix: Verify LINE_CHANNEL_SECRET env var                   │
│                                                                  │
│  3. Handler executing?                                           │
│     └─ Check: Look for "[LINE]" messages in logs                 │
│     └─ File: handlers/line_handler.py                           │
│                                                                  │
│  4. Session created?                                             │
│     └─ Check: session_manager.py get_user_session()              │
│     └─ Debug: Add print in get_user_session()                   │
│                                                                  │
│  5. Gemini API responding?                                       │
│     └─ Check: Look for "[GEMINI]" messages                       │
│     └─ Check: Circuit breaker state                              │
│     └─ File: services/gemini_service.py                         │
│                                                                  │
│  6. LINE API reply working?                                      │
│     └─ Check: Look for LineBotApiError                           │
│     └─ Fix: Verify LINE_CHANNEL_ACCESS_TOKEN                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2. TTS/Audio Not Working

```
┌─────────────────────────────────────────────────────────────────┐
│  SYMPTOM: "朗讀" command doesn't produce audio                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  CHECK ORDER:                                                    │
│                                                                  │
│  1. translated_output exists in session?                         │
│     └─ Required: User must have translated content first         │
│     └─ File: logic_handler.py:115-117                           │
│                                                                  │
│  2. TTS API call succeeding?                                     │
│     └─ Check: Look for "[TTS]" messages                          │
│     └─ File: services/tts_service.py                            │
│                                                                  │
│  3. Audio URL accessible?                                        │
│     └─ Check: BASE_URL environment variable                      │
│     └─ Memory mode: /audio/{filename}                           │
│     └─ Disk mode: /static/{filename}                            │
│                                                                  │
│  4. For Taigi:                                                   │
│     └─ Check: "[TAIGI]" messages                                 │
│     └─ Check: External service reachable                         │
│     └─ File: services/taigi_service.py                          │
│                                                                  │
│  5. Storage mode correct?                                        │
│     └─ Check: TTS_USE_MEMORY setting                             │
│     └─ Cloud deploy: Should be True                              │
│     └─ File: utils/storage_config.py                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 3. Email Not Sending

```
┌─────────────────────────────────────────────────────────────────┐
│  SYMPTOM: Email fails to send                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  CHECK ORDER:                                                    │
│                                                                  │
│  1. Email format valid?                                          │
│     └─ Error: "email 格式不正確"                                 │
│     └─ File: logic_handler.py:291-302                           │
│                                                                  │
│  2. MX record exists?                                            │
│     └─ Error: "無法驗證郵件伺服器"                               │
│     └─ Fix: Check if email domain is valid                       │
│                                                                  │
│  3. Gmail credentials correct?                                   │
│     └─ Check: GMAIL_ADDRESS, GMAIL_APP_PASSWORD                  │
│     └─ File: utils/email_service.py:14-15                       │
│                                                                  │
│  4. SMTP connection working?                                     │
│     └─ Error: "❌ Email connection failed"                       │
│     └─ Check: Network, port 465 access                           │
│     └─ File: utils/email_service.py:53-60                       │
│                                                                  │
│  5. Content exists?                                              │
│     └─ Error: returns (False, None)                              │
│     └─ Check: session["zh_output"] must exist                    │
│     └─ File: mail_handler.py:27-28                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 4. Database Errors

```
┌─────────────────────────────────────────────────────────────────┐
│  SYMPTOM: Database connection or logging failures                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  CHECK ORDER:                                                    │
│                                                                  │
│  1. DATABASE_URL correct?                                        │
│     └─ Format: postgresql://user:pass@host/db                    │
│     └─ File: utils/database.py:65-66                            │
│                                                                  │
│  2. SSL mode correct?                                            │
│     └─ Async: ?ssl=require                                       │
│     └─ Sync: ?sslmode=require                                    │
│                                                                  │
│  3. Connection pool exhausted?                                   │
│     └─ Default: pool_size=5, max_overflow=10                     │
│     └─ Error: "pool timeout"                                     │
│     └─ File: utils/database.py:79-80                            │
│                                                                  │
│  4. Async available?                                             │
│     └─ Check: ASYNC_AVAILABLE flag                               │
│     └─ Fallback: Sync mode used automatically                    │
│                                                                  │
│  5. Check log output                                             │
│     └─ Success: "[DB] Chat log saved..."                         │
│     └─ Failure: "[DB] Failed to log..."                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 5. Memory/Performance Issues

```
┌─────────────────────────────────────────────────────────────────┐
│  SYMPTOM: Server crashes, high memory, slow responses            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  CHECK ORDER:                                                    │
│                                                                  │
│  1. Session cleanup running?                                     │
│     └─ File: main.py:32-52 (periodic_cleanup)                   │
│     └─ Interval: Every 1 hour                                    │
│     └─ Check: "[CLEANUP]" messages                               │
│                                                                  │
│  2. Memory storage filling up?                                   │
│     └─ Check: memory_storage size                                │
│     └─ Cleanup: max_age_seconds=86400 (24h)                      │
│     └─ File: utils/memory_storage.py                            │
│                                                                  │
│  3. Thread pools bounded?                                        │
│     └─ Gemini: 4 workers (_executor)                             │
│     └─ Logging: 5 workers (_logging_executor)                    │
│     └─ R2: 3 workers (_r2_executor)                              │
│                                                                  │
│  4. Connection pools bounded?                                    │
│     └─ Database: pool_size=5, max_overflow=10                    │
│                                                                  │
│  5. Rate limiting working?                                       │
│     └─ Gemini: 30/min                                            │
│     └─ TTS: 20/min/user                                          │
│     └─ Taigi: 30/min                                             │
│                                                                  │
│  6. For 512MB RAM:                                               │
│     └─ Reduce pool sizes                                         │
│     └─ Reduce thread workers                                     │
│     └─ Reduce memory storage limits                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 6. LINE Message Limits

```
┌─────────────────────────────────────────────────────────────────┐
│  SYMPTOM: Message truncated or API error for long content        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  LIMITS:                                                         │
│    - Max bubbles: 5                                              │
│    - Max total chars: 5000                                       │
│    - Max chars per bubble: 2000                                  │
│    - File: utils/message_splitter.py:9-12                       │
│                                                                  │
│  CHECK ORDER:                                                    │
│                                                                  │
│  1. Check log for limit messages                                 │
│     └─ "[LINE] Message limits exceeded..."                       │
│     └─ File: line_handler.py:280-281                            │
│                                                                  │
│  2. Content being split correctly?                               │
│     └─ Check: split_long_text() output                           │
│     └─ File: utils/message_splitter.py                          │
│                                                                  │
│  3. Truncation notice showing?                                   │
│     └─ Expected: "⚠️ 內容因超過 LINE 限制已截斷"                 │
│     └─ Includes: "請使用寄送功能寄至電子郵件觀看全文"            │
│                                                                  │
│  4. References taking too much space?                            │
│     └─ Each ref ~150-200 chars                                   │
│     └─ Consider limiting number of refs                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Quick Reference: Key File Locations

| Component | File | Key Functions |
|-----------|------|---------------|
| Entry point | main.py | lifespan(), app routes |
| Webhook | routes/webhook.py | webhook() |
| Text handler | handlers/line_handler.py | handle_line_message(), create_message_bubbles() |
| Audio handler | handlers/line_handler.py | handle_audio_message(), save_audio_file() |
| Message dispatcher | handlers/logic_handler.py | handle_user_message(), handle_education_mode() |
| Chat handler | handlers/medchat_handler.py | handle_medchat() |
| Email handler | handlers/mail_handler.py | send_last_txt_email() |
| Session manager | handlers/session_manager.py | get_user_session(), cleanup_expired_sessions() |
| Gemini AI | services/gemini_service.py | call_zh(), call_translate(), get_references() |
| TTS | services/tts_service.py | synthesize() |
| Taigi | services/taigi_service.py | translate_to_taigi(), synthesize_taigi() |
| STT | services/stt_service.py | transcribe_audio_file() |
| Database | utils/database.py | log_chat_to_db(), log_tts_to_db() |
| Logging | utils/logging.py | log_chat(), log_tts_async() |
| R2 storage | utils/r2_service.py | upload_text_file(), upload_audio_file() |
| Email service | utils/email_service.py | send_email() |
| Message splitter | utils/message_splitter.py | split_long_text(), truncate_for_line() |
| Rate limiter | utils/rate_limiter.py | @rate_limit decorator |
| Circuit breaker | utils/circuit_breaker.py | gemini_circuit_breaker |

---

*Document generated for Mededbot debugging purposes. Last updated: 2025-01-24*
