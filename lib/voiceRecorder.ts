'use client';

interface VoiceRecorderCallbacks {
  onDataAvailable?: (audioBlob: Blob) => void;
  onError?: (error: string) => void;
}

export class VoiceRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: BlobPart[] = [];
  private stream: MediaStream | null = null;
  private isRecording = false;
  private callbacks: VoiceRecorderCallbacks = {};

  constructor(callbacks: VoiceRecorderCallbacks = {}) {
    this.callbacks = callbacks;
  }

  /**
   * Start recording audio from the user's microphone
   */
  async startRecording(): Promise<void> {
    try {
      // Request microphone access
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Create MediaRecorder
      const mimeType = this.getSupportedMimeType();
      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: mimeType || 'audio/webm',
      });

      // Collect audio chunks
      this.audioChunks = [];
      this.mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      // Handle recording stop
      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: mimeType || 'audio/webm' });
        this.callbacks.onDataAvailable?.(audioBlob);
      };

      // Handle errors
      this.mediaRecorder.onerror = (event: any) => {
        this.callbacks.onError?.(
          `Recording error: ${event.error || 'Unknown error'}`
        );
      };

      this.mediaRecorder.start();
      this.isRecording = true;
    } catch (error) {
      const errorMsg =
        error instanceof DOMException ? error.message : 'Failed to access microphone';
      this.callbacks.onError?.(errorMsg);
      throw error;
    }
  }

  /**
   * Stop recording and return the audio blob
   */
  stopRecording(): Blob | null {
    if (!this.mediaRecorder || !this.isRecording) {
      return null;
    }

    this.mediaRecorder.stop();
    this.isRecording = false;

    // Stop all tracks
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
    }

    // Return audio blob if immediately available
    if (this.audioChunks.length > 0) {
      const mimeType = this.getSupportedMimeType();
      return new Blob(this.audioChunks, { type: mimeType || 'audio/webm' });
    }

    return null;
  }

  /**
   * Cancel recording and cleanup
   */
  cancelRecording(): void {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
      this.isRecording = false;
    }

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
    }

    this.audioChunks = [];
  }

  /**
   * Check if recording is currently active
   */
  getIsRecording(): boolean {
    return this.isRecording;
  }

  /**
   * Get supported MIME type for the browser
   */
  private getSupportedMimeType(): string | null {
    const mimeTypes = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/wav',
      'audio/ogg',
    ];

    for (const mimeType of mimeTypes) {
      if (MediaRecorder.isTypeSupported(mimeType)) {
        return mimeType;
      }
    }

    return null;
  }

  /**
   * Check if browser supports recording
   */
  static isSupported(): boolean {
    return (
      typeof navigator !== 'undefined' &&
      typeof navigator.mediaDevices !== 'undefined' &&
      typeof navigator.mediaDevices.getUserMedia !== 'undefined' &&
      typeof MediaRecorder !== 'undefined'
    );
  }
}

/**
 * React Hook for voice recording
 */
export function useVoiceRecorder() {
  const [isRecording, setIsRecording] = React.useState(false);
  const [audioBlob, setAudioBlob] = React.useState<Blob | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const recorderRef = React.useRef<VoiceRecorder | null>(null);

  const startRecording = async () => {
    try {
      setError(null);
      if (!recorderRef.current) {
        recorderRef.current = new VoiceRecorder({
          onError: (err) => setError(err),
        });
      }
      await recorderRef.current.startRecording();
      setIsRecording(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start recording');
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (recorderRef.current) {
      const blob = recorderRef.current.stopRecording();
      setAudioBlob(blob);
      setIsRecording(false);
    }
  };

  const cancelRecording = () => {
    if (recorderRef.current) {
      recorderRef.current.cancelRecording();
      setIsRecording(false);
      setError(null);
    }
  };

  return {
    isRecording,
    audioBlob,
    error,
    startRecording,
    stopRecording,
    cancelRecording,
    isSupported: VoiceRecorder.isSupported(),
  };
}

// Import React for hook usage
import React from 'react';
