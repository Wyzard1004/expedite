Hackathon Implementation Schedule

Product Description

AI-Powered Smart Review System is a dynamic feedback platform designed to eliminate stale hotel data and reduce reviewer fatigue. Instead of forcing guests through long, static forms, the system intelligently identifies missing or outdated property information (the "Data Gaps") and dynamically asks guests 1-2 highly targeted questions via a low-friction text or conversational voice interface. Once collected, the system uses AI to categorize the feedback, summarize sentiments for future guests, and flag property managers about potential changes in their amenities.

Day 1: Tuesday - Foundation & Infrastructure

Focus: Get the environment running, database schemas set, and basic UI skeletons up.

Phase 1: Infrastructure & DB Setup (Morning)

Phase 1.1: Initialize Next.js project (App Router or Pages, your preference) with Tailwind CSS. Set up the GitHub repo.

Phase 1.2: Set up the Neon serverless Postgres database.

Create a free account/project on Neon.tech.

Open the Neon SQL editor and run CREATE EXTENSION vector; to enable pgvector for AI search.

Copy the database connection string and add it to your Next.js .env file.

Phase 1.3: Design and create Postgres schemas.

Tables needed: hotels, reviews, categories, amenity_flags.

Include a vector column in the reviews table for embeddings.

Phase 1.4: Seed the database with mock Expedia data (1-2 hotels, some existing reviews, and deliberately missing/stale categories to trigger the Gap Engine). Connect Next.js to the DB using pg or an ORM like Prisma/Drizzle.

Phase 2: Core API & "Data Gap Engine" (Afternoon/Evening)

Phase 2.1: Create backend API route to fetch a hotel and its existing reviews/categories.

Phase 2.2: Implement the Data Gap Engine logic. Write the SQL query/function that identifies the top 2 missing or stale categories for a given hotel.

Phase 2.3: Build the basic Frontend UI for the "Hotel Page" (Displaying hotel name, amenities, and a button to "Leave a Review").

Day 2: Wednesday - AI Features & The Review Flow

Focus: Implementing the core Hackathon prompt requirements—low-friction reviews and smart questioning.

Phase 3: Text Review & Magic Enhance (Morning)

Phase 3.1: Build the Text Review UI modal/page. Include the "Ideas to Cover" section powered by the Data Gap Engine from Phase 2.2.

Phase 3.2: Integrate OpenAI API (gpt-4o-mini). Implement the "Magic Enhance" button logic (takes raw notes -> formats nicely).

Phase 3.3: Implement the prompt injection: Based on the enhanced text, if a gap wasn't covered, have the LLM generate 1-2 smart follow-up questions.

Phase 3.4: Add the One-Click Tag UI (e.g., "Was the gym open? 

$$Yes/No$$

") as a fallback for the lowest possible friction.

Phase 4: Voice Review & Async Processing (Afternoon/Evening)

Phase 4.1: Build the Voice UI (a simple microphone button with recording state). Use browser MediaRecorder API to capture audio chunks.

Phase 4.2: Connect STT and TTS. Send audio to Next.js -> OpenAI Whisper -> send text to GPT-4o-mini for conversation -> send response to ElevenLabs TTS -> play audio on frontend.

Phase 4.3: The Processing Pipeline: When a review (text or voice) is finally submitted, write the API route that:

Categorizes the review (JSON output).

Generates an embedding (text-embedding-3-small) and saves it.

Updates the background Category Summary (with recency bias mitigation).

Day 3: Thursday - "Wow" Factors, Polish & Pitch Prep

Focus: Tying it together for the B2B side, semantic search, and ensuring it can be submitted.

Phase 5: Search & Host Dashboard (Morning)

Phase 5.1: Implement AI Semantic Search. Create an API route that takes a search string, embeds it, and runs the pgvector cosine similarity query. Connect this to a search bar on the UI.

Phase 5.2: Build the Discrepancy Detection logic. (If review says "no pool" but DB says "has pool", insert into amenity_flags).

Phase 5.3: Build the Host Dashboard UI. A simple page fetching from amenity_flags showing Hotel Managers what data might be stale based on user reviews.

Phase 6: Deployment & Submission (Afternoon/Night)

Phase 6.1: Deployment Prep: Since you are using a cloud-hosted Neon database, deployment will be seamless. Ensure your Neon connection string (DATABASE_URL) and API keys (OpenAI, ElevenLabs) are added as environment variables in your deployment platform.

Phase 6.2: Deploy Next.js frontend to Vercel (recommended for Next.js). Test the live link extensively to ensure the database connection works in production.

Phase 6.3: UI Polish. Add the Micro-Incentive banners ("Earn 50 pts"). Ensure Tailwind animations are smooth.