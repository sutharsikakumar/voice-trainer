import WaveSurfer from 'wavesurfer.js';

export interface AudioAnalysis {
  clarity: string;
  pace: string;
  pronunciation: string;
  suggestions: string[];
  feedback: string;
  duration: number;
  speech_rate: number;
  rms_energy: number;
  pitch_std: number;
}

export interface Slide {
  title: string;
  content: string;
  imageUrl?: string;
}

export interface SlideGenerationResponse {
  success: boolean;
  data?: {
    slides: Slide[];
    transcript?: string;
  };
  error?: string;
}

export interface UploadResponse {
  success: boolean;
  data?: {
    filePath: string;
    signedUrl: string;
  };
  error?: string;
}

export interface TwisterResponse {
  success: boolean;
  twister?: string;
  error?: string;
}

export interface RecordingState {
  isRecording: boolean;
  isPlaying: boolean;
  isUploading: boolean;
  isAnalyzing: boolean;
  uploadStatus: 'idle' | 'success' | 'error';
  generationStatus: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
}

export interface AudioRefs {
  mediaRecorder: MediaRecorder | null;
  audioChunks: Blob[];
  audioBlob: Blob | null;
  waveform: HTMLDivElement | null;
  wavesurfer: WaveSurfer | null;
} 