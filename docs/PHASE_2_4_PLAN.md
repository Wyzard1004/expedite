# Phase 2.4 Implementation Plan: Text & Voice Review System

## Overview

Phase 2.4 implements the complete review collection system with both text and voice interfaces, AI-powered enhancement, smart follow-up questions, and backend processing pipeline.

## Architecture

```
User Flow:
1. User clicks "Leave a Review" on hotel page
2. Review Modal opens with two paths:
   
   PATH A: Text Review
   ├─ Type initial notes into text area
   ├─ Click "Magic Enhance" → GPT-4o-mini polishes text
   ├─ Smart follow-up question appears (if gaps not covered)
   ├─ One-click tag UI for quick responses
   └─ Submit → Backend API processes review
   
   PATH B: Voice Review
   ├─ Click microphone icon → start recording
   ├─ Speak naturally about stay
   ├─ Click stop → Whisper STT converts to text
   ├─ GPT-4o-mini generates conversational response
   ├─ ElevenLabs TTS speaks back questions
   └─ Voice conversation continues or submit

3. Backend Processing (Parallel):
   ├─ Categorization → extract categories via LLM
   ├─ Vectorization → create embeddings (pgvector)
   └─ Database update → save review + metadata
```

## Implementation Phases

### Phase 2.4.1: Text Review UI & Components

**Files to Create:**
- `app/components/ReviewModal.tsx` - Main modal container
- `app/components/TextReviewForm.tsx` - Text input form
- `app/components/MagicEnhanceButton.tsx` - Enhancement button with loading state
- `app/components/FollowUpQuestion.tsx` - Smart question display
- `app/components/OneClickTags.tsx` - Binary/multi-choice tag UI
- `app/components/ReviewPreview.tsx` - Review preview before submit

**Features:**
- Modal overlay that opens from hotel page
- Text area for initial notes
- "Magic Enhance" button with spinner
- Follow-up question section (shown conditionally)
- One-click tag buttons for quick responses
- Preview of enhanced text before submit
- Loading states and error handling
- Form validation

### Phase 2.4.2: Voice Review UI & Components

**Files to Create:**
- `app/components/VoiceReviewUI.tsx` - Voice tab content
- `app/components/MicrophoneButton.tsx` - Record button with states
- `app/components/TranscriptDisplay.tsx` - Show recognized text
- `app/components/VoiceConversation.tsx` - AI response display
- `lib/voiceRecorder.ts` - MediaRecorder API wrapper

**Features:**
- Tab interface: Text vs Voice
- Microphone button with recording indicator
- Real-time transcription display
- Conversation state management
- Audio playback for TTS responses
- Error handling for mic permissions
- Preview before submit

### Phase 2.4.3: Backend API & Processing

**Files to Create:**
- `app/api/reviews/route.ts` - Create review endpoint
- `lib/reviewProcessor.ts` - Review categorization logic
- `lib/categorizeReview.ts` - LLM categorization function
- `lib/generateFollowUp.ts` - Generate smart questions
- `lib/generateEnhanced.ts` - Magic Enhance implementation

**Endpoints:**
```
POST /api/reviews
├─ Input: { hotel_id, review_text, source: 'text'|'voice', tags: [] }
├─ Process: Categorize, vectorize, store
└─ Output: { success, review_id, categories }

POST /api/reviews/enhance
├─ Input: { text }
├─ Process: GPT-4o-mini polish
└─ Output: { enhanced_text }

POST /api/reviews/followup
├─ Input: { hotel_id, initial_text }
├─ Process: Detect gaps, generate questions
└─ Output: { question, gaps_mentioned, gaps_missing }

POST /api/voice/transcribe
├─ Input: FormData with audio blob
├─ Process: Send to Whisper API
└─ Output: { text }

POST /api/voice/respond
├─ Input: { context, gaps_targets, user_text }
├─ Process: GPT-4o-mini conversational response
└─ Output: { response_text, should_ask_more }
```

### Phase 2.4.4: Data Model Updates

**Database Changes:**
```sql
-- Add to reviews table (if not exists)
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS source VARCHAR(10); -- 'text' or 'voice'
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS enhanced_text TEXT;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS ai_generated_categories JSONB;

-- Create embeddings table if needed for vector storage
CREATE TABLE IF NOT EXISTS review_embeddings (
  id BIGSERIAL PRIMARY KEY,
  review_id BIGINT REFERENCES reviews(id) ON DELETE CASCADE,
  embedding vector(1536),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Dependencies & Environment

### Required Environment Variables:
```
DATABASE_URL=... (already have)
OPENAI_API_KEY=... (already have)
ELEVENLABS_API_KEY=sk_... (need to add)
ELEVENLABS_VOICE_ID=21m... (optional, default voice)
```

### New NPM Packages:
```bash
npm install \
  openai \              # For Whisper, GPT, embeddings
  wavesurfer.js \       # Audio visualization (optional)
  usehooks-ts          # useAsync, useMediaQuery hooks
```

## UI/UX Design

### Modal Layout:
```
┌─────────────────────────────────────────┐
│  Leave a Review for [Hotel Name]    [X] │
├─────────────────────────────────────────┤
│  [📝 Text]  [🎤 Voice]                  │
├─────────────────────────────────────────┤
│                                         │
│  [TEXT TAB CONTENT]                     │
│  ┌──────────────────────────────────┐   │
│  │ Tell us about your stay...       │   │
│  │                                  │   │
│  │                                  │   │
│  └──────────────────────────────────┘   │
│                                         │
│  💡 Ideas to Cover:                     │
│  • Breakfast • WiFi Speed • Pool        │
│                                         │
│  [Magic Enhance ✨] [Preview] [Submit] │
│                                         │
└─────────────────────────────────────────┘
```

### Voice Tab:
```
┌─────────────────────────────────────────┐
│  [🎤] RECORDING                     [⏹]  │
│  0:45 seconds                            │
│                                         │
│  "I stayed for 3 nights and the..."    │
│                                         │
│  ──────────────────────────────────── │
│  AI: "Thanks! Was the breakfast good?"  │
│  [😊 Yes]  [👎 No]  [Skip]              │
│                                         │
│  [Submit] [Preview]                     │
│                                         │
└─────────────────────────────────────────┘
```

## Key Features

### 1. Magic Enhance (Text Polish)
```typescript
// Input: "gym was closed pool cold stayed 3 nights"
// Output: "Unfortunately, the gym was closed during my stay and the pool was quite cold. However, I was satisfied with the 3-night stay overall."

Input → Check for gaps → Call GPT-4o-mini → Polish text → Display
```

### 2. Smart Follow-Up Questions
```typescript
// Data Gap Engine identifies:
// - Breakfast: 0 reviews
// - WiFi: 1 review (stale)
// - Parking: covered

// If user text doesn't mention Breakfast:
// Question: "I noticed you didn't mention breakfast. Did you try the complimentary breakfast?"
// Options: [Yes, great] [Yes, but...] [No] [Skip]
```

### 3. One-Click Tags
```typescript
// Binary example:
[Yes, it was great]  [No, poor quality]

// Multi-choice example:
[Very helpful] [Decent] [Not helpful]
```

### 4. Voice Processing Flow
```
Audio → Whisper STT → Text Transcript
Context (hotel, gaps) + Transcript → GPT-4o-mini
Response → ElevenLabs TTS → Play Audio
User continues speaking or submits
```

## Implementation Order

1. ✏️ **Text Review Frontend** (2.4.1)
   - ReviewModal component
   - TextReviewForm
   - MagicEnhanceButton
   - FollowUpQuestion
   - OneClickTags

2. 🔌 **Backend Text Processing** (2.4.3 - Text APIs)
   - POST /api/reviews/enhance endpoint
   - POST /api/reviews/followup endpoint
   - POST /api/reviews endpoint

3. 🎤 **Voice Review Frontend** (2.4.2)
   - VoiceReviewUI component
   - MicrophoneButton
   - TranscriptDisplay
   - VoiceConversation

4. 🔌 **Backend Voice Processing** (2.4.3 - Voice APIs)
   - POST /api/voice/transcribe endpoint
   - POST /api/voice/respond endpoint
   - ElevenLabs integration

5. 🗄️ **Database & Storage** (2.4.4)
   - Update schema
   - Create embeddings table
   - Migration script

6. ✅ **Testing & Documentation** (2.4.5)
   - Unit tests for each component
   - Integration tests
   - Voice recording mock tests
   - Comprehensive test plan document

## Testing Strategy

### Unit Tests:
- MagicEnhanceButton: Click → API call → loading state → display
- FollowUpQuestion: Render when gaps exist, hide when none
- OneClickTags: Click tag → state update → submission
- MicrophoneButton: Permission request → recording state → stop

### Integration Tests:
- Start text review → Enhance → Follow-up → Submit
- Start voice review → Record → Transcribe → Response → Submit
- Modal open/close on hotel page
- Data persists in database

### API Tests:
- POST /api/reviews/enhance with various text lengths
- POST /api/reviews/followup detects gaps correctly
- POST /api/reviews validates required fields
- POST /api/voice/transcribe handles audio format
- Error scenarios (API failure, missing fields, etc.)

### Edge Cases:
- Very long reviews (>2000 chars)
- No microphone permission
- Voice cutoff mid-sentence
- Network timeout during processing
- Empty initial text for enhance
- User cancels voice recording

## Success Criteria

✅ Text review flow works end-to-end
✅ Magic Enhance produces polished text
✅ Follow-up questions appear when relevant
✅ One-click tags submit correctly
✅ Voice recording captures audio
✅ Whisper transcription accurate
✅ ElevenLabs TTS responds naturally
✅ Reviews saved to database
✅ Categories extracted and stored
✅ Modal opens/closes smoothly
✅ Error handling graceful
✅ All tests passing
✅ Comprehensive documentation

## Files to Create (Summary)

### Components (6 files):
- ReviewModal.tsx
- TextReviewForm.tsx
- MagicEnhanceButton.tsx
- FollowUpQuestion.tsx
- OneClickTags.tsx
- VoiceReviewUI.tsx
- MicrophoneButton.tsx
- TranscriptDisplay.tsx (optional, preview)

### Library Files (4 files):
- lib/reviewProcessor.ts
- lib/categorizeReview.ts
- lib/generateFollowUp.ts
- lib/generateEnhanced.ts
- lib/voiceRecorder.ts

### API Routes (4 files):
- app/api/reviews/route.ts
- app/api/reviews/enhance/route.ts
- app/api/reviews/followup/route.ts
- app/api/voice/transcribe/route.ts
- app/api/voice/respond/route.ts

### Documentation (1 file):
- docs/TESTING_PHASE_2_4.md
- docs/PHASE_2_4_SUMMARY.md

### Database (1 file):
- db/migrations/2.4-update-reviews.sql

## Known Limitations (Phase 2.4)

1. No image support in reviews (Phase 3.0+)
2. No review editing after submission
3. Voice TTS only in English
4. No review approval workflow
5. No profanity filtering (Phase 2.5+)
6. No sentiment analysis display

## Next Steps After Phase 2.4

- Phase 2.5: Async summarization and embeddings
- Phase 2.6: Category summary generation
- Phase 3.0: Discrepancy detection & flagging
- Phase 3.1: Host dashboard
- Phase 3.2: Semantic search

---

## Quick Start Checklist

- [ ] Read this entire plan
- [ ] Add ELEVENLABS_API_KEY to .env.local
- [ ] Create ReviewModal.tsx component
- [ ] Create TextReviewForm.tsx component
- [ ] Implement MagicEnhanceButton.tsx
- [ ] Create API endpoints for text
- [ ] Test text flow end-to-end
- [ ] Create voice components
- [ ] Implement voice API endpoints
- [ ] Integrate with hotel page
- [ ] Create test plan
- [ ] Final testing and bug fixes
