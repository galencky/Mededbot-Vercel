# MedEdBot - Multilingual Medical Education LINE Bot

[![Python](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-green.svg)](https://fastapi.tiangolo.com/)
[![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?logo=docker&logoColor=white)](https://www.docker.com/)
[![LINE](https://img.shields.io/badge/LINE-Messaging_API-00C300.svg)](https://developers.line.biz/en/services/messaging-api/)
[![Gemini](https://img.shields.io/badge/Google-Gemini_2.5-4285F4.svg)](https://ai.google.dev/)

A bilingual medical education and communication bot for LINE, powered by Google Gemini 2.5 Flash AI. Designed to bridge language barriers in healthcare settings and provide accurate, accessible patient education materials.

---

## Table of Contents

- [Features](#features)
- [System Architecture](#system-architecture)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Usage Guide](#usage-guide)
- [API Endpoints](#api-endpoints)
- [Database Schema](#database-schema)
- [Security Features](#security-features)
- [Monitoring & Troubleshooting](#monitoring--troubleshooting)
- [Contributing](#contributing)

---

## Features

### Education Mode (衛教模式)
Generate comprehensive, medically accurate patient education materials with:
- **AI-Powered Content**: Structured health education sheets via Gemini 2.5 Flash
- **Web Search Grounding**: Automatically includes credible medical references
- **Multi-language Translation**: Support for 10+ languages including Taiwanese
- **Content Modification**: Fine-tune generated content with specific instructions
- **Email Delivery**: Send materials directly to patients with MX validation
- **Text-to-Speech**: Natural voice output for accessibility

### Medical Chat Mode (醫療翻譯模式)
Real-time doctor-patient communication translation:
- **Medical Term Simplification**: Converts jargon to patient-friendly language
- **Bidirectional Translation**: Supports all major languages
- **Voice Message Support**: Transcribe and translate spoken input
- **Taiwanese Language**: Dedicated NYCU Taigi TTS for authentic pronunciation

### Voice Features
- **Speech-to-Text (STT)**: Transcribe voice messages via Gemini
- **Text-to-Speech (TTS)**: Generate natural audio for any content
- **Taiwanese TTS**: Powered by NYCU iVoice research service
- **Multiple Voices**: Support for various voice profiles

---

## System Architecture

### High-Level Overview

```mermaid
flowchart TB
    subgraph Users["Users"]
        LINE_USER[("LINE User")]
    end

    subgraph LINE_Platform["LINE Platform"]
        LINE_API[LINE Messaging API]
    end

    subgraph Application["FastAPI Application"]
        direction TB
        WEBHOOK["/webhook"]
        HANDLERS[Message Handlers]
        SERVICES[AI Services]
    end

    subgraph External_Services["External Services"]
        GEMINI[Google Gemini 2.5 Flash]
        NYCU[NYCU Taigi TTS]
        GMAIL[Gmail SMTP]
    end

    subgraph Storage["Storage Layer"]
        NEON[(Neon PostgreSQL)]
        R2[(Cloudflare R2)]
    end

    LINE_USER <-->|Messages| LINE_API
    LINE_API <-->|Webhook| WEBHOOK
    WEBHOOK --> HANDLERS
    HANDLERS --> SERVICES
    SERVICES <--> GEMINI
    SERVICES <--> NYCU
    HANDLERS --> GMAIL
    HANDLERS --> NEON
    SERVICES --> R2
```

### Request Flow

```mermaid
sequenceDiagram
    participant U as LINE User
    participant L as LINE Platform
    participant W as Webhook Handler
    participant S as Session Manager
    participant H as Logic Handler
    participant G as Gemini Service
    participant D as Database

    U->>L: Send message
    L->>W: POST /webhook
    W->>S: get_user_session(user_id)
    S-->>W: session dict
    W->>H: handle_user_message()

    alt Education Mode
        H->>G: call_zh(topic)
        G-->>H: Generated content + references
    else Chat Mode
        H->>G: plainify() + translate()
        G-->>H: Translated content
    end

    H-->>W: (reply, gemini_called, quick_reply)
    W->>D: log_chat_to_db()
    W->>L: reply_message()
    L->>U: Display response
```

### Component Interaction

```mermaid
flowchart LR
    subgraph Handlers
        SM[session_manager]
        LH[logic_handler]
        LINE[line_handler]
        MC[medchat_handler]
        MAIL[mail_handler]
    end

    subgraph Services
        GS[gemini_service]
        TTS[tts_service]
        STT[stt_service]
        TAIGI[taigi_service]
    end

    subgraph Utils
        DB[database]
        LOG[logging]
        R2[r2_service]
        VAL[validators]
        RL[rate_limiter]
        CB[circuit_breaker]
    end

    LINE --> SM
    LINE --> LH
    LINE --> MC
    LH --> GS
    LH --> TTS
    LH --> MAIL
    MC --> GS
    MC --> TAIGI
    GS --> RL
    GS --> CB
    TTS --> R2
    LOG --> DB
    LOG --> R2
```

---

## Project Structure

```
mededbot/
├── main.py                    # FastAPI application entry point
│
├── handlers/                  # Message processing logic
│   ├── session_manager.py     # Thread-safe user session management
│   ├── logic_handler.py       # Main message routing and processing
│   ├── line_handler.py        # LINE-specific message handling
│   ├── medchat_handler.py     # Medical chat translation
│   └── mail_handler.py        # Email sending with R2 logging
│
├── routes/                    # API endpoints
│   └── webhook.py             # LINE webhook handler
│
├── services/                  # External service integrations
│   ├── gemini_service.py      # Google Gemini 2.5 Flash API
│   ├── prompt_config.py       # AI system prompts
│   ├── tts_service.py         # Text-to-Speech via Gemini
│   ├── stt_service.py         # Speech-to-Text transcription
│   └── taigi_service.py       # Taiwanese TTS via NYCU
│
├── models/                    # Pydantic data models
│   ├── session.py             # User session schema
│   └── email_log.py           # Email logging model
│
├── utils/                     # Utility functions
│   ├── database.py            # PostgreSQL async/sync operations
│   ├── logging.py             # Async logging to DB and R2
│   ├── r2_service.py          # Cloudflare R2 storage
│   ├── email_service.py       # Gmail SMTP client
│   ├── validators.py          # Input validation & sanitization
│   ├── message_splitter.py    # LINE message length handling
│   ├── rate_limiter.py        # Token bucket rate limiting
│   ├── circuit_breaker.py     # Service resilience pattern
│   ├── storage_config.py      # Storage backend detection
│   ├── memory_storage.py      # In-memory file storage
│   ├── language_utils.py      # Language normalization
│   ├── command_sets.py        # Command keywords
│   └── quick_reply_templates.py
│
├── documents/                 # Documentation
│   ├── README.md              # This file
│   ├── DEPLOYMENT.md          # Deployment guide
│   ├── COMPREHENSIVE_FUNCTION_REFERENCE.md
│   └── ARCHITECTURE_ANALYSIS.md
│
├── scripts/                   # Utility scripts
│   └── init_db.py             # Database initialization
│
├── Dockerfile                 # Production container
├── docker-compose.yml         # Docker Compose config
├── requirements.txt           # Python dependencies
├── runtime.txt                # Python version (3.11.9)
└── render.yaml                # Render.com deployment
```

---

## Prerequisites

| Requirement | Purpose |
|-------------|---------|
| Python 3.11+ | Runtime environment |
| PostgreSQL | Database (Neon DB recommended) |
| LINE Developer Account | Messaging API access |
| Google Cloud Account | Gemini API access |
| Cloudflare R2 | File storage (optional) |
| Gmail Account | Email sending (optional) |

---

## Quick Start

### 1. Clone Repository

```bash
git clone https://github.com/yourusername/mededbot.git
cd mededbot
```

### 2. Environment Setup

```bash
cp .env.template .env
# Edit .env with your credentials
```

### 3. Required Environment Variables

```env
# === Required ===

# LINE Bot Credentials
LINE_CHANNEL_ACCESS_TOKEN=your_line_channel_access_token
LINE_CHANNEL_SECRET=your_line_channel_secret

# Google Gemini AI
GOOGLE_API_KEY=your_google_api_key

# Database (PostgreSQL)
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# === Optional ===

# Cloudflare R2 Storage
R2_ENDPOINT_URL=https://account-id.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET_NAME=mededbot

# Email Service
GMAIL_ADDRESS=your_email@gmail.com
GMAIL_APP_PASSWORD=your_app_password

# Deployment
PORT=8080
STORAGE_BACKEND=MEMORY  # LOCAL, R2, or MEMORY
```

### 4. Docker Deployment (Recommended)

```bash
# Build and start
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

### 5. Local Development

```bash
# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Initialize database
python scripts/init_db.py

# Run development server
uvicorn main:app --host 0.0.0.0 --port 10001 --reload
```

---

## Configuration

### Storage Backends

The application supports three storage modes:

```mermaid
flowchart TD
    START[Detect Environment] --> ENV{STORAGE_BACKEND set?}
    ENV -->|Yes| USE[Use specified backend]
    ENV -->|No| DETECT{Cloud platform?}
    DETECT -->|Render/Heroku/Railway| MEMORY[MEMORY mode]
    DETECT -->|No| R2{R2 configured?}
    R2 -->|Yes| R2_MODE[R2 mode]
    R2 -->|No| LOCAL[LOCAL mode]
```

| Mode | Use Case | Persistence |
|------|----------|-------------|
| `MEMORY` | Serverless/cloud deployments | Ephemeral (lost on restart) |
| `R2` | Cloud with R2 storage | Persistent to Cloudflare R2 |
| `LOCAL` | Self-hosted servers | Persistent to local disk |

### Rate Limits

| Service | Limit | Window |
|---------|-------|--------|
| Gemini API | 30 requests | 60 seconds |
| TTS Service | 20 requests | 60 seconds |
| Taigi Service | 30 requests | 60 seconds |

### Timeouts

| Operation | Timeout |
|-----------|---------|
| LINE Webhook | 48 seconds |
| Gemini API | 45 seconds |
| Circuit Breaker Recovery | 60 seconds |

---

## Usage Guide

### Conversation Flow

```mermaid
stateDiagram-v2
    [*] --> Start: Send any message
    Start --> ModeSelect: "開始" or "new"

    ModeSelect --> Education: Select "衛教"
    ModeSelect --> Chat: Select "聊天"

    state Education {
        [*] --> TopicInput: Enter health topic
        TopicInput --> Generated: AI generates content
        Generated --> Actions: Choose action
        Actions --> Modify: "修改"
        Actions --> Translate: "翻譯"
        Actions --> Email: "寄送"
        Actions --> Speak: "朗讀"
        Actions --> New: "新對話"
        Modify --> Generated
        Translate --> Translated
        Translated --> Actions
        Email --> Sent
        Speak --> AudioPlayed
    }

    state Chat {
        [*] --> LangSelect: Select target language
        LangSelect --> Input: Enter medical text
        Input --> Plainified: AI simplifies
        Plainified --> TranslatedChat: Translate to target
        TranslatedChat --> ChatActions
        ChatActions --> Speak2: "朗讀"
        ChatActions --> Continue: "繼續翻譯"
        ChatActions --> New2: "新對話"
    }
```

### Commands Reference

| Command | Aliases | Mode | Description |
|---------|---------|------|-------------|
| Start | `new`, `開始` | Any | Begin new conversation |
| Education | `ed`, `衛教` | Mode Select | Enter education mode |
| Chat | `聊天` | Mode Select | Enter chat mode |
| Modify | `修改`, `modify` | Education | Modify generated content |
| Translate | `翻譯`, `trans` | Education | Translate to new language |
| Email | `寄送`, `mail` | Education | Send via email |
| Speak | `朗讀`, `speak` | Any | Generate TTS audio |

### Supported Languages

| Language | Code | TTS Support |
|----------|------|-------------|
| 英文 (English) | en | Gemini TTS |
| 日文 (Japanese) | ja | Gemini TTS |
| 韓文 (Korean) | ko | Gemini TTS |
| 泰文 (Thai) | th | Gemini TTS |
| 越南文 (Vietnamese) | vi | Gemini TTS |
| 印尼文 (Indonesian) | id | Gemini TTS |
| 台語 (Taiwanese) | - | NYCU Taigi TTS |
| 西班牙文 (Spanish) | es | Gemini TTS |
| 法文 (French) | fr | Gemini TTS |
| 德文 (German) | de | Gemini TTS |

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Service information |
| `/health` | GET | Health check with DB status |
| `/ping` | GET, HEAD | Simple uptime check |
| `/webhook` | POST | LINE webhook handler |
| `/chat` | POST | Test endpoint for chat |
| `/audio/{filename}` | GET | Serve TTS audio (memory mode) |
| `/static/{filename}` | GET | Serve TTS audio (disk mode) |

### Health Check Response

```json
{
  "status": "healthy",
  "timestamp": "2026-01-25T10:30:00.000Z"
}
```

---

## Database Schema

```mermaid
erDiagram
    ChatLog {
        int id PK
        datetime timestamp
        string user_id
        text message
        text reply
        string action_type
        boolean gemini_call
        string gemini_output_url
        datetime created_at
    }

    TTSLog {
        int id PK
        datetime timestamp
        string user_id
        text text
        string audio_filename
        string audio_url
        string drive_link
        string status
        datetime created_at
    }

    VoicemailLog {
        int id PK
        datetime timestamp
        string user_id
        string audio_filename
        text transcription
        text translation
        string drive_link
        datetime created_at
    }
```

---

## Security Features

### Input Validation
- LINE user ID format verification (U + 32 hex chars)
- Path traversal prevention via `create_safe_path()`
- Email format validation with MX record checking
- Text sanitization removing null bytes and control characters
- File size limits (10MB for audio)

### Authentication
- LINE webhook signature verification
- Gmail app password authentication
- R2 access key authentication

### Resilience
- Circuit breaker pattern for Gemini API (5 failures = 60s cooldown)
- Rate limiting per user for all AI services
- Automatic session cleanup (24-hour expiry)
- Graceful degradation when services are unavailable

### Data Privacy
- No storage of raw medical information
- Session data cleared after 24 hours
- Audio files deleted after processing
- Logs stored in secure R2 bucket

---

## Monitoring & Troubleshooting

### Health Check

```bash
curl https://your-domain.com/health
```

### Common Issues

| Issue | Possible Cause | Solution |
|-------|----------------|----------|
| 502 Bad Gateway | Gemini timeout | Check API key, increase timeout |
| Empty responses | Circuit breaker open | Wait 60s for recovery |
| TTS not working | Storage misconfigured | Check STORAGE_BACKEND setting |
| Email fails | MX check failed | Verify recipient domain |
| Session lost | 24-hour expiry | Start new conversation |

### Circuit Breaker States

```mermaid
stateDiagram-v2
    [*] --> CLOSED: Normal operation
    CLOSED --> OPEN: 5 consecutive failures
    OPEN --> HALF_OPEN: After 60 seconds
    HALF_OPEN --> CLOSED: Success
    HALF_OPEN --> OPEN: Failure
```

### Log Monitoring

```bash
# Docker logs
docker-compose logs -f mededbot

# Filter for errors
docker-compose logs -f | grep -E "(ERROR|TIMEOUT|CIRCUIT)"
```

---

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Code Style
- Follow PEP 8 guidelines
- Use type hints where possible
- Add docstrings to functions
- Validate all user inputs

---

## Acknowledgments

- [Google Gemini AI](https://ai.google.dev/) - Language model and TTS
- [LINE Corporation](https://developers.line.biz/) - Messaging platform
- [NYCU iVoice](http://tts001.ivoice.tw/) - Taiwanese TTS service
- [FastAPI](https://fastapi.tiangolo.com/) - Web framework
- [Neon](https://neon.tech/) - Serverless PostgreSQL
- [Cloudflare R2](https://www.cloudflare.com/r2/) - Object storage

---

## License

This project is licensed under the MIT License - see the LICENSE file for details.

---

## Disclaimer

This bot is designed for educational purposes and should not replace professional medical consultation. Always verify medical information with qualified healthcare providers. AI-generated content may contain errors and should be reviewed by medical professionals before clinical use.

---

## Support

- **Documentation**: See `documents/COMPREHENSIVE_FUNCTION_REFERENCE.md` for detailed function reference
- **Issues**: [GitHub Issues](https://github.com/yourusername/mededbot/issues)
