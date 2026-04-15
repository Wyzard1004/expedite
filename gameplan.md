Hackathon Implementation Schedule

Product Description

AI-Powered Smart Review System is a dynamic feedback platform designed to eliminate stale hotel data and reduce reviewer fatigue. Instead of forcing guests through long, static forms, the system intelligently identifies missing or outdated property information (the "Data Gaps") and dynamically asks guests 1-2 highly targeted questions via a low-friction text or conversational voice interface. Once collected, the system uses AI to categorize the feedback, summarize sentiments for future guests, and flag property managers about potential changes in their amenities.

## STATUS: PHASES 1-2.4 COMPLETE ✅

**Completed Milestones:**
- ✅ Phase 1 (Infrastructure & DB Setup) - Next.js + Neon + pgvector
- ✅ Phase 2.1 (Hotel API) - Backend routes for fetching hotels/reviews
- ✅ Phase 2.2 (Data Gap Engine) - SQL logic identifying stale data
- ✅ Phase 2.3 (Hotel Page UI) - Frontend displaying hotel details
- ✅ Phase 2.4 (Text & Voice Reviews) - Dual-mode review submission with Magic Enhance, follow-ups, Whisper STT

**Current Progress:** 8 React components, 6 API endpoints, full review pipeline (text + voice), 0 build errors

---

## Day 1: Tuesday - Foundation & Infrastructure [COMPLETED]

Focus: Get the environment running, database schemas set, and basic UI skeletons up.

Phase 1: Infrastructure & DB Setup (Morning) [✅ COMPLETE]

Phase 1.1: Initialize Next.js project (App Router or Pages, your preference) with Tailwind CSS. Set up the GitHub repo.

Phase 1.2: Set up the Neon serverless Postgres database.

Create a free account/project on Neon.tech.

Open the Neon SQL editor and run CREATE EXTENSION vector; to enable pgvector for AI search.

Copy the database connection string and add it to your Next.js .env file.

Phase 1.3: Design and create Postgres schemas.

Tables needed: hotels, reviews, categories, amenity_flags.

Include a vector column in the reviews table for embeddings.

Phase 1.4: Seed the database with mock Expedia data (1-2 hotels, some existing reviews, and deliberately missing/stale categories to trigger the Gap Engine). Connect Next.js to the DB using pg or an ORM like Prisma/Drizzle.

Phase 2: Core API & "Data Gap Engine" (Afternoon/Evening) [✅ COMPLETE]

Phase 2.1: Create backend API route to fetch a hotel and its existing reviews/categories. [✅ COMPLETE]

Phase 2.2: Implement the Data Gap Engine logic. Write the SQL query/function that identifies the top 2 missing or stale categories for a given hotel. [✅ COMPLETE]

Phase 2.3: Build the basic Frontend UI for the "Hotel Page" (Displaying hotel name, amenities, and a button to "Leave a Review"). [✅ COMPLETE]

Phase 2.4: Text & Voice Review System (Async Integration) [✅ COMPLETE]
- TextReviewForm with Magic Enhance (GPT-4o-mini text polishing)
- Smart follow-up questions powered by Data Gap Engine
- One-click tag UI for responsive feedback
- VoiceReviewUI with MediaRecorder API and Whisper STT
- Review submission pipeline with categorization & embeddings
- Full test coverage and production-ready code

---

## Day 2: Wednesday - AI Features & The Review Flow [IN PROGRESS]

Focus: Async background processing, advanced voice features, and search optimization.

Phase 2.5: Async Processing & Category Summarization [🔄 CURRENT PHASE]

Phase 2.5: Async Processing & Category Summarization [🔄 CURRENT PHASE]

Focus: Background job processing for review categorization and intelligent summaries.

Phase 2.5.1: Set up Bull job queue with Redis for background processing.
- Install Bull, Bull-board, and Redis integration
- Create job queue for review categorization tasks
- Set up dashboard UI at /admin/jobs for monitoring

Phase 2.5.2: Implement Async Summarizer for categories.
- After each new review, queue a job to update category summaries
- Generate 1-sentence summary per category (e.g., "Great gym with modern equipment")
- Implement recency bias (weight recent reviews 2x higher than older ones)
- Store summaries in categories table in summary_text column

Phase 2.5.3: Batch background embedding processing.
- Instead of synchronous embedding on review submit, queue async jobs
- Process review embeddings in batch (5 at a time) for efficiency
- Free up request/response cycle for faster user feedback

---

## Day 3: Thursday - Advanced Features & Deployment

Focus: Voice TTS, semantic search, host dashboard, and production deployment.

Phase 2.6: Advanced Voice Features & ElevenLabs TTS (Upcoming)

Phase 2.6.1: Integrate ElevenLabs TTS for voice responses.
- Complete /api/voice/respond endpoint with actual TTS generation
- Send AI-generated responses to ElevenLabs API for synthesis
- Stream audio back to frontend for playback

Phase 2.6.2: Conversational voice interactions.
- Support multi-turn voice exchanges (guest records → AI responds → guest can continue)
- Context awareness for follow-up questions

---

Phase 3.0: Host Dashboard & Discrepancy Detection (Upcoming)

Phase 3.1: Build Discrepancy Detector logic.
- Compare review text sentiment about amenities vs. current DB state
- Flag when guest says "no pool" but database claims "has pool"
- Insert flagged discrepancies into amenity_flags table

Phase 3.2: Build Host Dashboard UI.
- Create /admin/dashboard for property managers
- Display flagged data issues, summary counts per category
- Allow managers to update amenities in bulk

---

Phase 3.3: AI Semantic Search (Upcoming)

Phase 3.3.1: Implement semantic search endpoint.
- Accept search query, embed it with text-embedding-3-small
- Run pgvector cosine similarity against stored embeddings
- Return ranked reviews matching semantic intent

Phase 3.3.2: Connect search to UI.
- Add search bar to hotel pages for filtering reviews
- Show similarity scores and highlighted matches

---

Phase 4.0: Deployment & Polish (Upcoming)

Phase 4.1: Production deployment.
- Vercel deployment with DATABASE_URL, OPENAI_API_KEY, ELEVENLABS_API_KEY
- Test full pipeline in production environment

Phase 4.2: UI Polish and micro-incentives.
- Add "Earn 50 pts" banners for review incentives
- Smooth Tailwind animations
- Mobile responsive refinements