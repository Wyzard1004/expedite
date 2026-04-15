/**
 * ElevenLabs Text-to-Speech Utility
 * Converts text responses to audio using ElevenLabs API
 */

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'pNInz6obpgDQGcFmaJgB'; // Default: Adam

if (!ELEVENLABS_API_KEY) {
  console.warn(
    '⚠️  ELEVENLABS_API_KEY not set. Voice TTS will be disabled. Add it to .env.local'
  );
}

/**
 * Generate audio from text using ElevenLabs
 * Returns base64-encoded audio data or null if API unavailable
 */
export async function generateAudioResponse(text: string): Promise<string | null> {
  if (!ELEVENLABS_API_KEY) {
    console.warn('[TTS] ElevenLabs API key not configured');
    return null;
  }

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          text: text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      }
    );

    if (!response.ok) {
      console.error(`[TTS] ElevenLabs error: ${response.statusText}`);
      return null;
    }

    // Get audio data as ArrayBuffer
    const audioBuffer = await response.arrayBuffer();

    // Convert to base64 for transmission
    const base64Audio = Buffer.from(audioBuffer).toString('base64');
    return `data:audio/mpeg;base64,${base64Audio}`;
  } catch (error) {
    console.error('[TTS] Failed to generate audio:', error);
    return null;
  }
}

/**
 * List available voices from ElevenLabs
 * Useful for debugging/configuration
 */
export async function listAvailableVoices(): Promise<
  { voice_id: string; name: string }[] | null
> {
  if (!ELEVENLABS_API_KEY) {
    return null;
  }

  try {
    const response = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.voices?.map((v: any) => ({ voice_id: v.voice_id, name: v.name })) || [];
  } catch (error) {
    console.error('[TTS] Failed to list voices:', error);
    return null;
  }
}
