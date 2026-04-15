import { NextRequest, NextResponse } from 'next/server';

const apiKey = process.env.OPENAI_API_KEY;
const elevenLabsKey = process.env.ELEVENLABS_API_KEY;

interface VoiceResponseRequest {
  context: string; // Hotel context
  gaps_targets: string[]; // Gaps to ask about
  user_text: string; // What user said
}

/**
 * Generate a conversational AI response for voice review
 * This endpoint is called after transcription to generate a follow-up question
 * In Phase 2.5+, responses can be fed to ElevenLabs TTS for audio playback
 */
export async function POST(request: NextRequest) {
  try {
    const body: VoiceResponseRequest = await request.json();
    const { context, gaps_targets, user_text } = body;

    if (!user_text || gaps_targets.length === 0) {
      return NextResponse.json({
        response: 'Thank you for sharing! Your review has been recorded.',
        should_ask_more: false,
      });
    }

    // Use GPT-4o-mini to generate a conversational response
    const prompt = `You are a friendly hotel review assistant having a conversation with a guest about their stay. Keep responses very brief (1-2 sentences).

Hotel context: ${context}
Topics the guest has covered: ${user_text}
Topics that need coverage: ${gaps_targets.join(', ')}

Generate a brief, friendly follow-up question about one of the topics they haven't covered yet. If they've covered most topics, thank them instead.

Response (keep it natural and conversational):`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 100,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data: any = await response.json();
    const botResponse = data.choices?.[0]?.message?.content || 'Thank you for your feedback!';

    return NextResponse.json({
      response: botResponse,
      should_ask_more: !botResponse.toLowerCase().includes('thank'),
      // In Phase 2.5+, can pass response to ElevenLabs TTS here
      // audio_url: await generateAudioResponse(botResponse),
    });
  } catch (error) {
    console.error('Error generating voice response:', error);
    return NextResponse.json(
      {
        response: 'Thank you for your review!',
        should_ask_more: false,
      },
      { status: 500 }
    );
  }
}
