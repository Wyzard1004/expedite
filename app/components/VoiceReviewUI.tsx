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
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recorderRef, setRecorderRef] = useState<VoiceRecorder | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [transcribing, setTranscribing] = useState(false);

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

  const handleStartRecording = async () => {
    try {
      setError(null);
      setTranscript('');
      setRecordedBlob(null);
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
      setTranscript('');
      setRecordedBlob(null);
      setError(null);
    }
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
      setTranscript(data.text || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transcription failed');
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

      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hotel_id: hotelId,
          review_text: transcript,
          source: 'voice',
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
      <MicrophoneButton
        onRecordingStart={handleStartRecording}
        onRecordingStop={handleStopRecording}
        onRecordingCancel={handleCancelRecording}
        isRecording={isRecording}
        error={error}
      />

      {/* Recording Time Display */}
      {isRecording && (
        <div className="text-center">
          <p className="text-lg font-semibold text-slate-700">
            Recording: {formatTime(recordingTime)}
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
          disabled={submitting || isRecording}
          className="flex-1 px-4 py-2 border border-slate-300 hover:border-slate-400 text-slate-700 font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        {transcript && (
          <button
            onClick={handleSubmitVoiceReview}
            disabled={submitting || !transcript.trim()}
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Submitting...
              </>
            ) : (
              <>✓ Submit Voice Review</>
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
