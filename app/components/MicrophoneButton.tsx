'use client';

import { useState, useEffect } from 'react';

interface MicrophoneButtonProps {
  onRecordingStart: () => void;
  onRecordingStop: () => void;
  onRecordingCancel: () => void;
  isRecording: boolean;
  disabled?: boolean;
  hasPermission?: boolean;
  error?: string | null;
}

export default function MicrophoneButton({
  onRecordingStart,
  onRecordingStop,
  onRecordingCancel,
  isRecording,
  disabled = false,
  hasPermission = true,
  error,
}: MicrophoneButtonProps) {
  const [recordingTime, setRecordingTime] = useState(0);

  // Update recording timer
  useEffect(() => {
    if (!isRecording) {
      setRecordingTime(0);
      return;
    }

    const interval = setInterval(() => {
      setRecordingTime((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isRecording]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (error) {
    return (
      <div className="p-4 bg-red-50 rounded-lg border-l-4 border-red-500">
        <p className="text-sm text-red-800">
          <strong>Recording Error:</strong> {error}
        </p>
        <p className="text-xs text-red-700 mt-2">
          Please check your microphone permissions and try again.
        </p>
      </div>
    );
  }

  if (!hasPermission) {
    return (
      <div className="p-4 bg-amber-50 rounded-lg border-l-4 border-amber-500">
        <p className="text-sm text-amber-800">
          <strong>Microphone Access Required:</strong> Please allow this site to access your microphone to record voice reviews.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Main Recording Button */}
      <button
        onClick={isRecording ? onRecordingStop : onRecordingStart}
        disabled={disabled}
        className={`relative w-24 h-24 rounded-full flex items-center justify-center font-bold text-white text-xl transition-all transform active:scale-95 ${
          isRecording
            ? 'bg-red-500 hover:bg-red-600 shadow-lg pulse'
            : 'bg-blue-600 hover:bg-blue-700 shadow-md'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        <span className="text-3xl">{isRecording ? '⏹' : '🎤'}</span>
        {isRecording && (
          <span className="absolute top-2 right-2 w-3 h-3 bg-red-300 rounded-full animate-pulse" />
        )}
      </button>

      {/* Recording Timer */}
      {isRecording && (
        <div className="text-center">
          <p className="text-sm font-semibold text-slate-700">
            Recording: {formatTime(recordingTime)}
          </p>
          <p className="text-xs text-slate-500 mt-1">Click stop to end recording</p>
        </div>
      )}

      {/* Cancel Button (during recording) */}
      {isRecording && (
        <button
          onClick={onRecordingCancel}
          className="px-4 py-2 text-sm bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium rounded transition-colors"
        >
          Cancel Recording
        </button>
      )}

      {/* Recording Info */}
      {!isRecording && (
        <div className="text-center">
          <p className="text-sm text-slate-600">
            Click the microphone to start recording your review
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Speak naturally about your stay (max 5 minutes)
          </p>
        </div>
      )}
    </div>
  );
}
