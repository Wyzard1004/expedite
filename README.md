# Expedite: AI-Powered Smart Review System

An intelligent hotel review platform that eliminates stale data and reduces reviewer fatigue through dynamic, AI-driven feedback collection. The system identifies missing or outdated property information and asks guests targeted follow-up questions via intuitive text or conversational voice interfaces.

## 🎯 Project Overview

### What It Solves

Traditional review systems suffer from two critical problems:

1. **Stale Data**: Hotel amenities change (pools close, WiFi upgrades), but reviews remain outdated and contradictory
2. **Reviewer Fatigue**: Long, static forms discourage guests from providing valuable feedback

**Expedite** solves both by:
- Using AI to identify what information is missing or outdated (Data Gaps)
- Asking guests 1-2 highly targeted follow-up questions
- Processing feedback asynchronously with embeddings, categorization, and summaries
- Detecting discrepancies between reviews and official data
- Providing semantic search for future guests

### Status: ✅ PHASES 1-3.3 COMPLETE

- ✅ Core infrastructure (Next.js, Neon PostgreSQL, pgvector)
- ✅ Hotel API and review endpoints
- ✅ Data Gap Engine (identifies stale/missing data)
- ✅ Text & Voice review submission with Magic Enhance
- ✅ Async background processing (categorization, embeddings, summaries)
- ✅ Voice TTS integration (ElevenLabs)
- ✅ AI semantic search across reviews
- ✅ Host dashboard for property managers

## 🏗️ Architecture & Tech Stack

### Frontend
- **React 19** with Next.js 16 (App Router)
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **Real-time voice recording** (MediaRecorder API)

### Backend
- **Next.js API Routes** for RESTful endpoints
- **PostgreSQL (Neon)** with pgvector for AI embeddings
- **Redis + Bull** for async job queue processing
- **OpenAI** for embeddings and text generation
- **ElevenLabs** for voice synthesis (TTS)

### Key Libraries
- `openai` - GPT-4o-mini, embeddings, Whisper STT
- `pg` - PostgreSQL driver
- `redis` - Job queue backing store
- `csv-parse` - Data import pipeline
- `dotenv` - Environment configuration

## 📁 Project Structure

```
expedite/
├── app/
│   ├── api/                      # Backend API endpoints
│   │   ├── hotels/              # Hotel data endpoints
│   │   ├── reviews/             # Review submission & enhancement
│   │   ├── voice/               # Voice transcription & TTS responses
│   │   └── admin/               # Admin dashboard APIs
│   ├── components/              # React UI components
│   │   ├── TextReviewForm.tsx
│   │   ├── VoiceReviewUI.tsx
│   │   ├── MagicEnhanceButton.tsx
│   │   ├── FollowUpQuestion.tsx
│   │   ├── SemanticSearchUI.tsx
│   │   └── ...
│   ├── hotels/                  # Hotel page routes
│   ├── admin/                   # Admin dashboard UI
│   └── layout.tsx, globals.css
├── lib/                         # Core business logic
│   ├── db.ts                    # PostgreSQL connection
│   ├── dataGapEngine.ts         # Identifies stale/missing data
│   ├── queue.ts                 # Redis job queue setup
│   ├── embeddings.ts            # Vector embedding utilities
│   ├── discrepancies.ts         # Anomaly detection
│   ├── tts.ts                   # ElevenLabs TTS wrapper
│   ├── voiceRecorder.ts         # Client-side audio recording
│   └── jobs/                    # Background job handlers
│       ├── categorySummarizer.ts
│       └── embeddingProcessor.ts
├── db/
│   ├── schema.sql               # Database schema
│   ├── seed.ts                  # Database seeding script
│   ├── clear.ts                 # Database cleanup
│   └── migrations/              # Schema migrations
├── scripts/
│   ├── generate-embeddings.ts   # One-time embedding generation
│   ├── repair-reviews.ts        # Data repair utilities
│   └── check-db.ts              # Database health check
├── data/
│   ├── Reviews_PROC.csv         # Sample review data
│   └── Description_PROC.csv     # Hotel descriptions
└── docs/                        # Phase documentation
    ├── PHASE_*.md               # Detailed phase completions
    └── TEST_RESULTS_*.md        # Test coverage reports
```

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+ and npm/yarn
- **Neon** PostgreSQL database account
- **OpenAI** API key (GPT-4o-mini, embeddings, Whisper)
- **ElevenLabs** API key (optional, for voice TTS)
- **Redis** instance (local or remote)

### Installation & Setup

1. **Clone and install dependencies:**
   ```bash
   git clone <repo-url>
   cd expedite
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env.local
   ```
   
   Configure the following in `.env.local`:
   ```env
   # Database
   DATABASE_URL=postgresql://user:password@host/dbname
   
   # AI APIs
   OPENAI_API_KEY=sk-...
   ELEVENLABS_API_KEY=xi-...
   ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM  # Default voice
   
   # Redis (for job queue)
   REDIS_URL=redis://localhost:6379
   
   # Optional
   NEXT_PUBLIC_API_URL=http://localhost:3000
   ```

3. **Initialize the database:**
   ```bash
   # Create tables and schema
   npm run seed
   
   # Or clear and reseed
   npm run clear
   ```

4. **Start development server:**
   ```bash
   npm run dev
   ```
   
   Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build & Production

```bash
# Build for production
npm run build

# Start production server
npm start

# Deploy to Vercel
vercel deploy --prod
```

## 🔌 API Endpoints

### Hotels
- `GET /api/hotels` - List all hotels
- `GET /api/hotels/[id]` - Get hotel details with reviews
- `GET /api/hotels/[id]/gaps` - Get data gaps for a hotel
- `GET /api/hotels/[id]/search` - Semantic search across reviews

### Reviews
- `POST /api/reviews` - Submit text review
- `POST /api/reviews/enhance` - Magic Enhance (AI text polishing)
- `POST /api/reviews/ratings` - Add star ratings to reviews

### Voice
- `POST /api/voice/transcribe` - Convert audio to text (Whisper)
- `POST /api/voice/respond` - Generate AI response and TTS audio

### Admin
- `GET /api/admin/queue` - Job queue status
- `GET /api/admin/discrepancies` - Flagged data issues
- `POST /api/admin/discrepancies` - Mark discrepancies as resolved

## 🗄️ Database Schema

### Key Tables

**hotels**
```sql
id (pk) | name | description | amenities | created_at | updated_at
```

**reviews**
```sql
id (pk) | hotel_id | text | rating | categories | embedding (pgvector) | 
summary_override | created_at | updated_at
```

**categories**
```sql
id (pk) | hotel_id | name | review_count | summary_text | 
recency_bias_weight | updated_at
```

**amenity_flags**
```sql
id (pk) | hotel_id | amenity_name | flagged_status | source_review_id | 
flagged_by | created_at | resolved_at
```

## 🦾 Core Features Explained

### 1. Data Gap Engine (`lib/dataGapEngine.ts`)

Identifies missing or stale information:
- Queries reviews by category age
- Ranks gaps by importance (recency, frequency)
- Dynamically injects targeted follow-up questions
- Triggers micro-incentive prompts

**Example:** "Haven't had a gym review in 8 months → Prompt guest about gym"

### 2. Magic Enhance (`MagicEnhanceButton.tsx`)

Polishes rough guest notes into professional reviews using GPT-4o-mini:
- Input: "pool cold weather bad"
- Output: "The pool temperature was uncomfortable during cooler weather, making it unsuitable for swimming."

### 3. Async Review Processing (`lib/jobs/`)

After submission, background jobs handle:
- **Categorization**: Tags reviews with amenities/themes
- **Embeddings**: Converts text to vectors for semantic search
- **Summarization**: Generates recency-weighted category summaries
- **Discrepancy Detection**: Flags contradictions with official data

### 4. Voice Interface (`components/VoiceReviewUI.tsx`)

Multi-turn conversational review collection:
1. Guest speaks → Whisper STT converts to text
2. AI analyzes for data gaps
3. GPT-4o-mini generates targeted follow-up
4. ElevenLabs TTS speaks response
5. Guest can continue conversation

### 5. Semantic Search (`components/SemanticSearchUI.tsx`)

Natural language search using embeddings:
- Query: "Is the breakfast good?"
- Uses pgvector cosine similarity to find relevant reviews
- Returns ranked results with similarity scores

## 📊 Development Workflow

### Run Tests

```bash
# (Test suite to be implemented)
npm run test
```

### Database Operations

```bash
# Check database health
npm run check-db

# Generate embeddings for existing reviews
npm run generate-embeddings

# Repair review data
npm run repair-reviews
```

### Linting

```bash
npm run lint
```

## 🚀 Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Connect repo to Vercel dashboard
3. Set environment variables in Settings → Environment Variables
4. Deploy automatically on every push

### Self-Hosted

1. Build: `npm run build`
2. Set environment variables
3. Start: `npm start`
4. Configure Redis and PostgreSQL access from production server

## 📚 Documentation

Phase-by-phase implementation details:

- [PHASE_3_3_COMPLETE.md](docs/PHASE_3_3_COMPLETE.md) - Semantic Search implementation
- [PHASE_3_0_COMPLETE.md](docs/PHASE_3_0_COMPLETE.md) - Host Dashboard & Discrepancy Detection
- [PHASE_2_6_COMPLETE.md](docs/PHASE_2_6_COMPLETE.md) - Voice TTS & Conversational Features
- [PHASE_2_5_COMPLETE.md](docs/PHASE_2_5_COMPLETE.md) - Async Job Queue & Summarization
- [features.md](features.md) - Complete feature architecture diagram

## 🔍 Key Design Decisions

1. **pgvector for embeddings**: Direct PostgreSQL integration avoids external vector DB
2. **Async job processing**: Redis + Bull handles background tasks without blocking requests
3. **Recency-weighted summaries**: Recent reviews carry more weight to avoid stale consensus
4. **Voice-first design**: Audio interface reduces friction vs. long text forms
5. **Semantic over keyword search**: Embedding-based search finds meaning, not just exact matches

## 🛣️ Roadmap

### Phase 4: Final Polish
- [ ] Micro-incentive point system UI
- [ ] Mobile-first responsive refinements
- [ ] Advanced analytics for hotel managers
- [ ] Batch review import from external sources

### Future Enhancements
- [ ] Multi-language support
- [ ] Real-time collaborative review moderation
- [ ] Competitive benchmarking (compare vs. similar hotels)
- [ ] Guest loyalty dashboard

## 🤝 Contributing

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Make changes and test locally
3. Run linter: `npm run lint`
4. Push and create a pull request

## 📝 Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | Neon PostgreSQL connection string |
| `OPENAI_API_KEY` | ✅ | OpenAI API key for GPT, embeddings, Whisper |
| `REDIS_URL` | ✅ | Redis connection string for job queue |
| `ELEVENLABS_API_KEY` | ⚠️ | Required for voice TTS (optional for text-only) |
| `ELEVENLABS_VOICE_ID` | ⚠️ | Voice ID for TTS (defaults to Bella) |
| `NEXT_PUBLIC_API_URL` | ❌ | Frontend API base URL |

## 🐛 Troubleshooting

### Redis Connection Error
```
Error: connect ECONNREFUSED 127.0.0.1:6379
```
Ensure Redis is running: `redis-cli ping` should return `PONG`

### Embeddings Generation Slow
Batch processing happens asynchronously. Check job queue status at `/admin/queue`

### Voice Transcription Not Working
Verify `OPENAI_API_KEY` is set and has Whisper API access

### Database Migration Issues
```bash
npm run clear  # Reset database
npm run seed   # Reseed with sample data
```

## 📄 License

MIT License - feel free to use this project as a foundation.

---

**Built with ❤️ for smarter hotel reviews and happier guests.**
