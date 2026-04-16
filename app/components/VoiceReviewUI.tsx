'use client';

import { useState, useEffect } from 'react';
import MicrophoneButton from './MicrophoneButton';
import { VoiceRecorder } from '@/lib/voiceRecorder';

interface VoiceReviewUIProps {
  hotelId: number;
  hotelName: string;
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
      
      // If appending, preserve the previous transcript
      if (append && conversationActive && transcript) {
        setPreviousTranscript(transcript);
        setIsAppendingMode(true);
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
      
      // If in append mode, combine with previous transcript
      if (isAppendingMode && previousTranscript) {
        setTranscript(`${previousTranscript} ${newText}`);
      } else {
        setTranscript(newText);
      }
      
      setIsAppendingMode(false);
      setPreviousTranscript('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transcription failed');
      setIsAppendingMode(false);
    } finally {
      setTranscribing(false);
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

      // Get AI response with TTS
      if (!conversationActive && dataGaps.length > 0) {
        const gapNames = dataGaps.map((gap) => gap.category_name);
        
        // Add user message to conversation history
        const updatedHistory = [
          ...conversationHistory,
          { role: 'user' as const, content: transcript },
        ];
        
        const responseRes = await fetch('/api/voice/respond', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            context: `Hotel: ${hotelName}`,
            gaps_targets: gapNames,
            user_text: transcript,
            conversation_history: updatedHistory,
          }),
        });

        if (responseRes.ok) {
          const responseData = await responseRes.json();
          setAiResponse(responseData.response);
          setAudioUrl(responseData.audio_url);
          setConversationActive(responseData.should_ask_more);
          
          // Update conversation history with bot response
          setConversationHistory([
            ...updatedHistory,
            { role: 'assistant', content: responseData.response },
          ]);

          // Play audio if available
          if (responseData.audio_url) {
            playAudio(responseData.audio_url);
          }
          return;
        }
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
        <p className="text-slate-600">Your feedback helps us improve {hotelName}</p>
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
      {!conversationActive || !transcript ? (
        <MicrophoneButton
          onRecordingStart={() => handleStartRecording(false)}
          onRecordingStop={handleStopRecording}
          onRecordingCancel={handleCancelRecording}
          isRecording={isRecording}
          error={error}
        />
      ) : null}

      {/* Append Mode Button (during conversation with existing transcript) */}
      {conversationActive && transcript && !isRecording && (
        <div className="bg-blue-50 p-4 rounded border-l-4 border-blue-500 space-y-3">
          <p className="text-sm font-semibold text-blue-900">Want to add more to your response?</p>
          <button
            onClick={() => handleStartRecording(true)}
            disabled={submitting || isPlayingAudio}
            className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm hover:shadow"
          >
            Mic Append More
          </button>
        </div>
      )}

      {/* Appending Mode Indicator */}
      {isRecording && isAppendingMode && previousTranscript && (
        <div className="bg-amber-50 p-4 rounded border-l-4 border-amber-500 space-y-3">
          <p className="text-xs font-semibold text-amber-900 mb-2">Appending mode</p>
          <p className="text-xs text-amber-800 italic mb-2">Previous message:</p>
          <p className="text-sm text-amber-900 bg-white p-2 rounded border border-amber-200">
            {previousTranscript}
          </p>
          <button
            onClick={handleStopRecording}
            className="w-full px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded transition-colors"
          >
            End Append
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

      {/* AI Response with TTS Audio */}
      {aiResponse && (
        <div className="bg-purple-50 p-4 rounded border-l-4 border-purple-500">
          <p className="text-sm font-semibold text-purple-900 mb-2">🤖 AI Response:</p>
          <p className="text-sm text-purple-800 mb-3">{aiResponse}</p>

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
          disabled={submitting || isRecording || isPlayingAudio}
          className="flex-1 px-4 py-2 border border-slate-300 hover:border-slate-400 text-slate-700 font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        {transcript && (
          <button
            onClick={handleSubmitVoiceReview}
            disabled={submitting || !transcript.trim() || isPlayingAudio}
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {conversationActive ? 'Getting Response...' : 'Submitting...'}
              </>
            ) : (
              <>
                {conversationActive ? '→ Continue' : '✓ Submit Voice Review'}
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
