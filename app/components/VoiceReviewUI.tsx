'use client';

import { useState, useEffect } from 'react';
import MicrophoneButton from './MicrophoneButton';
import { VoiceRecorder } from '@/lib/voiceRecorder';

interface VoiceReviewUIProps {
  hotelId: number;
  hotelName?: string; // Deprecated - use hotelId for display
  dataGaps: Array<{ category_id: number; category_name: string }>;
  onClose: () => void;
  onSubmitSuccess?: () => void;
}

export default function VoiceReviewUI({
  hotelId,
  hotelName,
  dataGaps,
  onClose,
  onSubmitSuccess,
}: VoiceReviewUIProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [enhancedTranscript, setEnhancedTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recorderRef, setRecorderRef] = useState<VoiceRecorder | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [conversationActive, setConversationActive] = useState(false);
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [previousTranscript, setPreviousTranscript] = useState('');
  const [isAppendingMode, setIsAppendingMode] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [skipAiResponse, setSkipAiResponse] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  // Check if voice recording is supported
  const isSupported = VoiceRecorder.isSupported();

  // Initialize recorder
  useEffect(() => {
    if (!isSupported) return;

    const recorder = new VoiceRecorder({
      onDataAvailable: async (audioBlob) => {
        setRecordedBlob(audioBlob);
        // Auto-transcribe
        await transcribeAudio(audioBlob);
      },
      onError: (err) => {
        setError(err);
        setIsRecording(false);
      },
    });

    setRecorderRef(recorder);
  }, [isSupported]);

  // Recording timer
  useEffect(() => {
    if (!isRecording) {
      setRecordingTime(0);
      return;
    }

    const interval = setInterval(() => {
      setRecordingTime((prev) => {
        if (prev >= 300) {
          // 5 minute limit
          handleStopRecording();
          setError('Maximum recording time (5 minutes) reached');
          return 300;
        }
        return prev + 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isRecording]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStartRecording = async (append: boolean = false) => {
    try {
      setError(null);
      
      // If appending, preserve the current transcript
      if (append && transcript) {
        setPreviousTranscript(transcript);
        setIsAppendingMode(true);
        // Clear only the current input, not the full transcript
        // The full transcript will be preserved in previousTranscript
      } else {
        setTranscript('');
        setRecordedBlob(null);
        setIsAppendingMode(false);
        // Reset conversation history only when starting a new review (not appending)
        if (!append) {
          setConversationHistory([]);
        }
      }
      
      if (recorderRef) {
        await recorderRef.startRecording();
        setIsRecording(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start recording');
    }
  };

  const handleStopRecording = () => {
    if (recorderRef) {
      const blob = recorderRef.stopRecording();
      setIsRecording(false);
      // Blob is passed to onDataAvailable callback
    }
  };

  const handleCancelRecording = () => {
    if (recorderRef) {
      recorderRef.cancelRecording();
      setIsRecording(false);
      
      // If canceling during append, restore previous transcript
      if (isAppendingMode && previousTranscript) {
        setTranscript(previousTranscript);
      } else {
        setTranscript('');
      }
      
      setRecordedBlob(null);
      setIsAppendingMode(false);
      setPreviousTranscript('');
      setError(null);
    }
  };

  const handleEnhanceTranscript = async () => {
    if (!transcript.trim()) {
      setError('Please transcribe something first');
      return;
    }

    try {
      setEnhancing(true);
      setError(null);

      const response = await fetch('/api/reviews/enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: transcript }),
      });

      if (!response.ok) {
        throw new Error('Failed to enhance transcript');
      }

      const data = await response.json();
      setEnhancedTranscript(data.enhanced_text);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enhancement failed');
    } finally {
      setEnhancing(false);
    }
  };

  const handleUseEnhanced = () => {
    setTranscript(enhancedTranscript);
    setEnhancedTranscript('');
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    try {
      setTranscribing(true);
      setError(null);

      const formData = new FormData();
      formData.append('audio', audioBlob, 'audio.webm');

      const response = await fetch('/api/voice/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to transcribe audio');
      }

      const data = await response.json();
      const newText = data.text || '';
      
      // Check append mode BEFORE clearing state
      const wasAppending = isAppendingMode;
      const previousText = previousTranscript;
      
      // Combine transcript carefully
      if (wasAppending && previousText) {
        // Append mode: combine previous + new text, with space separator
        setTranscript(`${previousText} ${newText}`);
      } else {
        // Normal mode: just use new text
        setTranscript(newText);
      }
      
      // Always clear append state after transcription
      setIsAppendingMode(false);
      setPreviousTranscript('');
      
      // Auto-trigger AI response after transcription (if not appending and not skipping)
      if (!wasAppending && !skipAiResponse && dataGaps.length > 0 && !conversationActive) {
        // Auto-trigger AI response with the new transcript
        const updatedHistory = [
          ...conversationHistory,
          { role: 'user' as const, content: newText },
        ];
        
        await triggerAiResponse(newText, updatedHistory);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transcription failed');
      setIsAppendingMode(false);
    } finally {
      setTranscribing(false);
    }
  };

  const triggerAiResponse = async (userText: string, history: Array<{ role: 'user' | 'assistant'; content: string }>) => {
    try {
      setAiLoading(true);
      const gapNames = dataGaps.map((gap) => gap.category_name);
      
      const responseRes = await fetch('/api/voice/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context: `Hotel ${hotelId}`,
          gaps_targets: gapNames,
          user_text: userText,
          conversation_history: history,
        }),
      });

      if (responseRes.ok) {
        const responseData = await responseRes.json();
        setAiResponse(responseData.response);
        setAudioUrl(responseData.audio_url);
        setConversationActive(responseData.should_ask_more);
        
        // Update conversation history with bot response
        setConversationHistory([
          ...history,
          { role: 'assistant', content: responseData.response },
        ]);

        // Play audio if available
        if (responseData.audio_url) {
          playAudio(responseData.audio_url);
        }
      }
    } catch (err) {
      console.error('Failed to get AI response:', err);
      // Don't show error - this is non-blocking
    } finally {
      setAiLoading(false);
    }
  };

  const handleSubmitVoiceReview = async () => {
    try {
      setSubmitting(true);
      setError(null);

      if (!transcript.trim()) {
        setError('Please record something first');
        return;
      }

      // If conversation is active and we have an AI response, this is a "Continue" action
      if (conversationActive && aiResponse) {
        // Reset for next turn
        setAiResponse(null);
        setAudioUrl(null);
        
        // Continue conversation - will need another recording
        return;
      }

      // If no AI response yet and conversation should be active, trigger it first
      if (!conversationActive && !aiResponse && dataGaps.length > 0 && !skipAiResponse) {
        const updatedHistory = [
          ...conversationHistory,
          { role: 'user' as const, content: transcript },
        ];
        
        await triggerAiResponse(transcript, updatedHistory);
        return;
      }

      // Submit final review
      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hotel_id: hotelId,
          review_text: transcript,
          tags: [],
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit review');
      }

      setSuccess(true);
      setTimeout(() => {
        onSubmitSuccess?.();
        onClose();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  const playAudio = (audioUrl: string) => {
    try {
      setIsPlayingAudio(true);
      const audio = new Audio(audioUrl);
      audio.addEventListener('ended', () => {
        setIsPlayingAudio(false);
      });
      audio.addEventListener('error', () => {
        setIsPlayingAudio(false);
        console.error('Audio playback failed');
      });
      audio.play().catch((err) => {
        console.error('Failed to play audio:', err);
        setIsPlayingAudio(false);
      });
    } catch (err) {
      console.error('Error playing audio:', err);
      setIsPlayingAudio(false);
    }
  };

  if (!isSupported) {
    return (
      <div className="p-6 text-center">
        <div className="text-6xl mb-4">⚠️</div>
        <h3 className="text-xl font-bold text-slate-900 mb-2">Voice Not Supported</h3>
        <p className="text-slate-600 mb-4">
          Your browser doesn't support voice recording. Please use a modern browser like Chrome, Edge, or Firefox.
        </p>
        <button
          onClick={onClose}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
        >
          Back to Text Review
        </button>
      </div>
    );
  }

  if (success) {
    return (
      <div className="p-6 text-center">
        <div className="text-4xl mb-3">✅</div>
        <h3 className="text-xl font-bold text-slate-900 mb-2">Thank you for your voice review!</h3>
        <p className="text-slate-600">Your feedback helps us improve Hotel {hotelId}</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Ideas to Cover */}
      {dataGaps.length > 0 && (
        <div className="bg-blue-50 p-4 rounded border-l-4 border-blue-500">
          <p className="text-sm font-semibold text-blue-900 mb-2">💡 Ideas to Cover:</p>
          <div className="flex flex-wrap gap-2">
            {dataGaps.map((gap) => (
              <span
                key={gap.category_id}
                className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded"
              >
                {gap.category_name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Microphone Button */}
      {!conversationActive && !aiResponse && !transcript ? (
        <MicrophoneButton
          onRecordingStart={() => handleStartRecording(false)}
          onRecordingStop={handleStopRecording}
          onRecordingCancel={handleCancelRecording}
          isRecording={isRecording}
          error={error}
        />
      ) : null}

      {/* Append Mode Button (during conversation with existing transcript) - MOVED BELOW AI RESPONSE */}
      {null}{/* Removed from here */}

      {/* Appending Mode Indicator */}
      {isRecording && isAppendingMode && previousTranscript && (
        <div className="bg-amber-50 p-4 rounded border-l-4 border-amber-500 space-y-3">
          <p className="text-xs font-semibold text-amber-900 mb-2">🎙️ Recording appended message...</p>
          <p className="text-xs text-amber-800 italic mb-2">Previous message:</p>
          <p className="text-sm text-amber-900 bg-white p-2 rounded border border-amber-200 max-h-24 overflow-y-auto">
            {previousTranscript}
          </p>
          <button
            onClick={handleStopRecording}
            className="w-full px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded transition-colors"
          >
            ✓ End Append & Transcribe
          </button>
        </div>
      )}

      {/* Recording Time Display */}
      {isRecording && (
        <div className="text-center">
          <p className="text-lg font-semibold text-slate-700">
            Recording: {formatTime(recordingTime)}
            {isAppendingMode && ' (appending)'}
          </p>
        </div>
      )}

      {/* Transcription Display */}
      {(transcribing || transcript) && (
        <div className="bg-green-50 p-4 rounded border-l-4 border-green-500">
          <p className="text-sm font-semibold text-green-900 mb-2">
            {transcribing ? '⏳ Transcribing...' : '✓ Transcribed:'}
          </p>
          <p className="text-sm text-green-800">
            {transcript || 'Processing your audio...'}
          </p>
        </div>
      )}

      {/* Magic Enhance Button */}
      {transcript && !enhancedTranscript && (
        <button
          onClick={handleEnhanceTranscript}
          disabled={enhancing || submitting || isRecording}
          className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm hover:shadow"
        >
          {enhancing ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Enhancing your transcript...
            </>
          ) : (
            <>
              ✨ Magic Enhance
            </>
          )}
        </button>
      )}

      {/* Enhanced Transcript Preview */}
      {enhancedTranscript && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded border-l-4 border-green-500 space-y-3">
          <p className="text-xs font-semibold text-green-900">✨ Enhanced Transcript:</p>
          <p className="text-sm text-green-800 bg-white p-3 rounded border border-green-200">{enhancedTranscript}</p>
          <button
            onClick={handleUseEnhanced}
            className="w-full px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded transition-colors flex items-center justify-center gap-2"
          >
            ✓ Use Enhanced Version
          </button>
        </div>
      )}

      {/* Loading AI Response */}
      {aiLoading && (
        <div className="bg-blue-50 p-4 rounded border-l-4 border-blue-500 flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-semibold text-blue-900">Getting AI response...</p>
        </div>
      )}

      {/* AI Response with TTS Audio */}
      {aiResponse && (
        <div className="bg-purple-50 p-4 rounded border-l-4 border-purple-500 space-y-4">
          <p className="text-sm font-semibold text-purple-900 mb-2">🤖 AI Response:</p>
          <p className="text-sm text-purple-800">{aiResponse}</p>

          {/* Audio Player */}
          {audioUrl && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => playAudio(audioUrl)}
                disabled={isPlayingAudio}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPlayingAudio ? '🔊 Playing...' : '🔊 Play Audio'}
              </button>
              <p className="text-xs text-purple-600">Powered by ElevenLabs</p>
            </div>
          )}

          {/* Mic Append Button - below AI response */}
          {conversationActive && !isRecording && (
            <div className="border-t border-purple-200 pt-4 mt-4">
              <p className="text-sm font-semibold text-purple-900 mb-3">Want to add more to your response?</p>
              <button
                onClick={() => handleStartRecording(true)}
                disabled={submitting || isPlayingAudio}
                className="w-full px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm hover:shadow"
              >
                🎤 Add More
              </button>
            </div>
          )}

          {/* Skip AI Response Option */}
          {!conversationActive && !isRecording && (
            <div className="border-t border-purple-200 pt-4 mt-4">
              <p className="text-xs text-purple-700 mb-2">Not what you were looking for?</p>
              <button
                onClick={() => {
                  setAiResponse(null);
                  setSkipAiResponse(true);
                }}
                className="w-full px-3 py-2 text-purple-600 hover:bg-purple-100 text-sm font-medium rounded transition-colors"
              >
                Skip AI response & submit review
              </button>
            </div>
          )}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 p-3 rounded border-l-4 border-red-500">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4">
        <button
          onClick={onClose}
          disabled={submitting || isRecording || isPlayingAudio || aiLoading}
          className="flex-1 px-4 py-2 border border-slate-300 hover:border-slate-400 text-slate-700 font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        {transcript && !conversationActive && (
          <button
            onClick={handleSubmitVoiceReview}
            disabled={submitting || !transcript.trim() || isPlayingAudio || aiLoading}
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting || aiLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {aiLoading ? 'Getting response...' : 'Submitting...'}
              </>
            ) : (
              <>
                ✓ Submit Review
              </>
            )}
          </button>
        )}
        {conversationActive && !isRecording && (
          <button
            onClick={handleSubmitVoiceReview}
            disabled={submitting || isPlayingAudio}
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                ✓ Submit Final Review
              </>
            )}
          </button>
        )}
      </div>

      {/* Info Text */}
      <p className="text-xs text-slate-500 text-center">
        Your voice review will be automatically transcribed and categorized using AI.
      </p>
    </div>
  );
}
