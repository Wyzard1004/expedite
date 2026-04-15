import { NextRequest, NextResponse } from 'next/server';

const apiKey = process.env.OPENAI_API_KEY;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;

    if (!audioFile) {
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      );
    }

    // Convert file to blob for OpenAI API
    const audioBuffer = await audioFile.arrayBuffer();

    // Use OpenAI Whisper API to transcribe
    const transcribeFormData = new FormData();
    transcribeFormData.append('file', new Blob([audioBuffer], { type: audioFile.type }), 'audio.webm');
    transcribeFormData.append('model', 'whisper-1');
    transcribeFormData.append('language', 'en');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: transcribeFormData,
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Whisper API error:', errorData);
      throw new Error(`Whisper API error: ${response.statusText}`);
    }

    const data: any = await response.json();

    return NextResponse.json({
      text: data.text || '',
      language: data.language || 'en',
      duration: audioFile.size, // Approximate
    });
  } catch (error) {
    console.error('Error transcribing audio:', error);
    return NextResponse.json(
      {
        error: 'Failed to transcribe audio',
        text: '', // Return empty so voice review can continue
      },
      { status: 500 }
    );
  }
}
