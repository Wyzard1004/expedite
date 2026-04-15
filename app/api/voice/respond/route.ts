import { NextRequest, NextResponse } from 'next/server';
import { generateAudioResponse } from '@/lib/tts';

const apiKey = process.env.OPENAI_API_KEY;

interface VoiceResponseRequest {
  context: string; // Hotel context
  gaps_targets: string[]; // Gaps to ask about
  user_text: string; // What user said
}

interface VoiceResponseData {
  response: string;
  should_ask_more: boolean;
  audio_url?: string | null;
}

/**
 * Generate a conversational AI response for voice review
 * This endpoint is called after transcription to generate a follow-up question
 * Responses are synthesized to audio using ElevenLabs TTS
 */
export async function POST(request: NextRequest): Promise<NextResponse<VoiceResponseData>> {
  try {
    const body: VoiceResponseRequest = await request.json();
    const { context, gaps_targets, user_text } = body;

    if (!user_text || gaps_targets.length === 0) {
      // No gaps to ask about - generate closing response
      const audioUrl = await generateAudioResponse(
        'Thank you for sharing! Your review has been recorded.'
      );

      return NextResponse.json({
        response: 'Thank you for sharing! Your review has been recorded.',
        should_ask_more: false,
        audio_url: audioUrl,
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

    // Generate audio response asynchronously
    // Don't await - return response quickly, audio will be available separately
    const shouldAskMore = !botResponse.toLowerCase().includes('thank');

    // Try to generate audio, but don't block response if it fails
    const audioUrl = await generateAudioResponse(botResponse).catch((error) => {
      console.warn('[API] TTS generation failed:', error);
      return null;
    });

    return NextResponse.json({
      response: botResponse,
      should_ask_more: shouldAskMore,
      audio_url: audioUrl,
    });
  } catch (error) {
    console.error('Error generating voice response:', error);
    return NextResponse.json(
      {
        response: 'Thank you for your review!',
        should_ask_more: false,
        audio_url: null,
      },
      { status: 500 }
    );
  }
}
