import { NextRequest, NextResponse } from 'next/server';

const apiKey = process.env.OPENAI_API_KEY;

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();

    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { error: 'Review text is required' },
        { status: 400 }
      );
    }

    // Use GPT-4o-mini to enhance/polish the review
    const response = await fetch('https://api.openai.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': apiKey || '',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 500,
        messages: [
          {
            role: 'user',
            content: `You are a helpful assistant that polishes and enhances user reviews. Take the following rough review notes and transform them into a well-written, coherent review paragraph. Keep it natural and conversational, but more polished than the original.

Original notes: "${text}"

Provide only the enhanced review text, no explanations.`,
          },
        ],
      }),
    });

    // Actually use OpenAI REST API instead
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 500,
        messages: [
          {
            role: 'user',
            content: `You are a helpful assistant that polishes and enhances user reviews. Take the following rough review notes and transform them into a well-written, coherent review paragraph. Keep it natural and conversational, but more polished than the original.

Original notes: "${text}"

Provide only the enhanced review text, no explanations.`,
          },
        ],
      }),
    });

    if (!openaiResponse.ok) {
      throw new Error(`OpenAI API error: ${openaiResponse.statusText}`);
    }

    const data: any = await openaiResponse.json();
    const enhancedText =
      data.choices?.[0]?.message?.content || text;

    return NextResponse.json({
      original_text: text,
      enhanced_text: enhancedText,
    });
  } catch (error) {
    console.error('Error enhancing review:', error);
    return NextResponse.json(
      { error: 'Failed to enhance review' },
      { status: 500 }
    );
  }
}
