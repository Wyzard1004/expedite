import { NextRequest, NextResponse } from 'next/server';
import { generateAudioResponse } from '@/lib/tts';

const apiKey = process.env.OPENAI_API_KEY;

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface VoiceResponseRequest {
  context: string; // Hotel context
  gaps_targets: string[]; // Gaps to ask about
  user_text: string; // What user said
  conversation_history?: ConversationMessage[]; // Full conversation history
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
    const { context, gaps_targets, user_text, conversation_history = [] } = body;

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

    // Build conversation context
    const fullConversation = conversation_history.map((msg) => `${msg.role === 'user' ? 'Guest' : 'You'}: ${msg.content}`).join('\n');
    
    // Identify which gaps might relate to what they've said
    const mentionedTopicsLower = user_text.toLowerCase();
    const relatedGaps = gaps_targets.filter((gap) => {
      const gapLower = gap.toLowerCase();
      // Check if gap relates to keywords in their response
      return (
        mentionedTopicsLower.includes(gapLower.split(' ')[0]) ||
        (gapLower.includes('breakfast') && mentionedTopicsLower.includes('eat')) ||
        (gapLower.includes('wifi') && mentionedTopicsLower.includes('internet')) ||
        (gapLower.includes('room') && mentionedTopicsLower.includes('bedroom')) ||
        (gapLower.includes('staff') && mentionedTopicsLower.includes('service'))
      );
    });

    // Use GPT-4o-mini to generate a conversational response
    const prompt = `You are a warm, friendly hotel review assistant having a conversation with a guest about their stay. 
Your goal is to:
1. Acknowledge and show genuine interest in what they said
2. Ask a natural follow-up question about their comment
3. If they mention something, gently ask about related topics they haven't mentioned
4. Only when you've covered most topics, wrap up the conversation

Keep responses very brief (1-2 sentences, max). Sound like a real person, not a checklist.
${fullConversation ? `\nConversation so far:\n${fullConversation}\n` : ''}
Hotel context: ${context}
Guest's latest message: "${user_text}"
Topics we haven't discussed yet: ${gaps_targets.join(', ')}
Topics possibly related to what they mentioned: ${relatedGaps.length > 0 ? relatedGaps.join(', ') : 'none yet'}

Generate a brief, warm follow-up response. If they seem satisfied with their answer, ask about one related gap naturally. 
Don't ask about multiple topics at once. Don't read from a list. Sound conversational.

Response:`;

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
