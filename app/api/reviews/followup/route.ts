import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { findDataGaps } from '@/lib/dataGapEngine';

const apiKey = process.env.OPENAI_API_KEY;

async function generateQuestion(
  mentionedGaps: string[],
  missingGaps: string[]
): Promise<string> {
  const targetGaps = missingGaps.slice(0, 2);

  const followUpPrompt = `You are a hotel review assistant. The user just wrote a review about their hotel stay. They mentioned: ${mentionedGaps.length > 0 ? mentionedGaps.join(', ') : 'various aspects'}.

They did NOT mention: ${targetGaps.join(', ')}.

Create a single natural, conversational follow-up question asking about ONE of the missing aspects. Ask in a friendly, non-intrusive way. For example:
- "Did you get a chance to check out the gym?"
- "How was the WiFi during your stay?"
- "Were you able to enjoy the pool area?"

Generate only the question, nothing else.`;

  try {
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
            content: followUpPrompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data: any = await response.json();
    return data.choices?.[0]?.message?.content || 'Thank you for your review!';
  } catch (error) {
    console.error('Error generating question:', error);
    return 'Thank you for your review!';
  }
}

export async function POST(request: NextRequest) {
  try {
    const { hotel_id, initial_text, enhanced_text } = await request.json();

    if (!hotel_id || !enhanced_text) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get data gaps for this hotel
    const gaps = await findDataGaps(hotel_id, 3); // Get top 3 gaps

    if (gaps.length === 0) {
      return NextResponse.json({
        question: 'Thank you for your detailed review!',
        gaps_mentioned: [],
        gaps_missing: [],
      });
    }

    // Check which gaps are mentioned in the review text
    const reviewText = (enhanced_text || initial_text).toLowerCase();
    const mentionedGaps: string[] = [];
    const missingGaps: string[] = [];

    for (const gap of gaps) {
      const gapName = gap.category_name.toLowerCase();
      if (
        reviewText.includes(gapName) ||
        reviewText.includes(gapName.split(' ')[0])
      ) {
        mentionedGaps.push(gap.category_name);
      } else {
        missingGaps.push(gap.category_name);
      }
    }

    // If all gaps are mentioned, no follow-up needed
    if (missingGaps.length === 0) {
      return NextResponse.json({
        question: 'Great review! You covered everything well.',
        gaps_mentioned: mentionedGaps,
        gaps_missing: [],
      });
    }

    // Generate a natural follow-up question
    const question = await generateQuestion(mentionedGaps, missingGaps);

    return NextResponse.json({
      question,
      gaps_mentioned: mentionedGaps,
      gaps_missing: missingGaps,
    });
  } catch (error) {
    console.error('Error generating follow-up question:', error);
    return NextResponse.json(
      { error: 'Failed to generate follow-up question' },
      { status: 500 }
    );
  }
}
