"use client";
import styles from "./page.module.css";
import Link from "next/link";
import Header from "@/components/header";
import { useEffect, useRef, useState, MouseEvent, JSX } from "react";
import WaveSurfer from "wavesurfer.js";
import { supabase } from "@/lib/supabase";
import { AudioAnalysis, RecordingState, TwisterResponse } from "@/lib/types";

interface AnalysisResponse {
  success: boolean;
  data?: {
    analysis: AudioAnalysis;
    feedback: string;
  };
  error?: string; // Added optional error property
}

interface UploadResponse {
  success: boolean;
  data?: {
    filePath: string;
    signedUrl: string;
  };
  error?: string;
}

export default function Twister(): JSX.Element {
  const [state, setState] = useState<RecordingState>({
    isRecording: false,
    isPlaying: false,
    isUploading: false,
    isAnalyzing: false,
    uploadStatus: "idle",
    generationStatus: "idle",
    error: null,
  });

  const [isRegenerating, setIsRegenerating] = useState(false);

  const [tongueTwister, setTongueTwister] = useState<string>("");
  const [analysis, setAnalysis] = useState<AudioAnalysis | null>(null);

  const waveformRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioBlobRef = useRef<Blob | null>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);

  useEffect(() => {
    const fetchInitialTwister = async () => {
      try {
        await regenerateTwister();
      } catch (error) {
        console.error("Error fetching initial tongue twister:", error);
      }
    };
    fetchInitialTwister();
  }, []);

  const regenerateTwister = async (): Promise<void> => {
    try {
      setIsRegenerating(true);
      const response: Response = await fetch("/api/twister");
      const data: TwisterResponse = await response.json();

      if (data.success && data.twister) {
        setTongueTwister(data.twister);
        setAnalysis(null);
      } else {
        console.error("Failed to fetch tongue twister:", data.error || "Unknown error");
      }
    } catch (error: unknown) {
      console.error("Error fetching tongue twister:", error);
    } finally {
      setIsRegenerating(false);
    }
  };

  const startRecording = async () => {
    try {
      // Clean up previous recording
      if (wavesurferRef.current) {
        wavesurferRef.current.destroy();
        wavesurferRef.current = null;
      }
      if (audioBlobRef.current) {
        URL.revokeObjectURL(URL.createObjectURL(audioBlobRef.current));
        audioBlobRef.current = null;
      }
      audioChunksRef.current = [];

      // Clear the waveform container
      if (waveformRef.current) {
        waveformRef.current.innerHTML = '';
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Try different MIME types for better browser compatibility
      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
        ''
      ];
      
      let mediaRecorder: MediaRecorder | null = null;
      for (const mimeType of mimeTypes) {
        try {
          mediaRecorder = new MediaRecorder(stream, { mimeType });
          break;
        } catch (e) {
          console.log(`MIME type ${mimeType} not supported, trying next...`);
        }
      }
      
      if (!mediaRecorder) {
        throw new Error('No supported MIME type found for MediaRecorder');
      }

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: mediaRecorder.mimeType,
        });
        audioBlobRef.current = audioBlob;

        // Initialize WaveSurfer after recording is complete
        if (waveformRef.current && audioBlob) {
          const audioUrl = URL.createObjectURL(audioBlob);
          wavesurferRef.current = WaveSurfer.create({
            container: waveformRef.current,
            waveColor: "#999",
            progressColor: "#333",
            height: 100,
          });
          wavesurferRef.current.load(audioUrl);
        }
      };

      mediaRecorder.start(1000);
      setState(prev => ({ ...prev, isRecording: true, error: null }));
    } catch (error) {
      console.error("Error starting recording:", error);
      let errorMessage = "Failed to start recording";
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          errorMessage = "Microphone access was denied. Please allow microphone access and try again.";
        } else if (error.name === 'NotFoundError') {
          errorMessage = "No microphone found. Please connect a microphone and try again.";
        }
      }
      setState(prev => ({ ...prev, error: errorMessage }));
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      
      // Create the audio blob immediately after stopping
      const audioBlob = new Blob(audioChunksRef.current, {
        type: mediaRecorderRef.current.mimeType,
      });
      audioBlobRef.current = audioBlob;
      
      // Initialize WaveSurfer with the final recording
      if (waveformRef.current && audioBlob) {
        const audioUrl = URL.createObjectURL(audioBlob);
        if (wavesurferRef.current) {
          wavesurferRef.current.destroy();
        }
        wavesurferRef.current = WaveSurfer.create({
          container: waveformRef.current,
          waveColor: "#999",
          progressColor: "#333",
          height: 100,
        });
        wavesurferRef.current.load(audioUrl);
      }
    }
    setState(prev => ({ ...prev, isRecording: false }));
  };

  const reRecord = () => {
    if (wavesurferRef.current) {
      wavesurferRef.current.destroy();
      wavesurferRef.current = null;
    }
    if (audioBlobRef.current) {
      URL.revokeObjectURL(URL.createObjectURL(audioBlobRef.current));
      audioBlobRef.current = null;
    }
    audioChunksRef.current = [];
    setState(prev => ({ ...prev, isPlaying: false }));
  };

  useEffect(() => {
    if (waveformRef.current && audioBlobRef.current) {
      if (wavesurferRef.current) {
        wavesurferRef.current.destroy();
      }

      const audioUrl = URL.createObjectURL(audioBlobRef.current);
      wavesurferRef.current = WaveSurfer.create({
        container: waveformRef.current,
        waveColor: "#999",
        progressColor: "#333",
        height: 100,
        barWidth: 2,
        barGap: 1,
        cursorWidth: 1,
        cursorColor: "#333",
        normalize: true,
        interact: true,
        fillParent: true
      });

      wavesurferRef.current.on("ready", () => {
        console.log("WaveSurfer is ready");
      });

      wavesurferRef.current.on("play", () => {
        setState(prev => ({ ...prev, isPlaying: true }));
      });

      wavesurferRef.current.on("pause", () => {
        setState(prev => ({ ...prev, isPlaying: false }));
      });

      wavesurferRef.current.on("finish", () => {
        setState(prev => ({ ...prev, isPlaying: false }));
      });

      wavesurferRef.current.load(audioUrl);

      return () => {
        if (wavesurferRef.current) {
          wavesurferRef.current.destroy();
        }
        URL.revokeObjectURL(audioUrl);
      };
    }
  }, [audioBlobRef.current]);

  const uploadRecording = async (): Promise<void> => {
    if (!audioBlobRef.current) {
      setState((prev) => ({ ...prev, error: "No audio recording to upload" }));
      return;
    }

    try {
      setState((prev) => ({
        ...prev,
        isUploading: true,
        isAnalyzing: true,
        error: null,
      }));
      setAnalysis(null);

      const fileName = `recording-${Date.now()}.webm`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("audio-recordings")
        .upload(fileName, audioBlobRef.current);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("audio-recordings")
        .getPublicUrl(uploadData.path);

      const formData = new FormData();
      formData.append("audioUrl", publicUrl);

      const analysisResponse = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });

      if (!analysisResponse.ok) {
        const errorText = await analysisResponse.text();
        throw new Error(`Analysis failed: ${errorText}`);
      }

      const analysisData = await analysisResponse.json();
      
      if (!analysisData.success) {
        throw new Error(analysisData.error || 'Failed to analyze speech');
      }

      setAnalysis(analysisData.data);
      setState((prev) => ({ ...prev, generationStatus: "ready" }));
    } catch (error) {
      console.error("Error in upload and processing:", error);
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : "Failed to process recording",
        generationStatus: "error",
      }));
    } finally {
      setState((prev) => ({
        ...prev,
        isUploading: false,
        isAnalyzing: false,
      }));
    }
  };

  const handleUpload = async () => {
    try {
      await uploadRecording();
    } catch (error) {
      console.error('Upload failed:', error);
      setState(prev => ({ ...prev, error: 'Upload failed. Please try again.' }));
    }
  };

  const getUploadButtonText = (): string => {
    if (state.isUploading) return "Processing...";
    if (state.generationStatus === "ready" && analysis) return "Analyzed!";
    if (state.generationStatus === "error") return "Failed!";
    return "Analyze";
  };

  const renderFeedbackContent = (): JSX.Element | string => {
    if (state.generationStatus === "idle") {
      return "Record and upload your attempt to get feedback";
    } else if (state.generationStatus === "loading") {
      return "Analyzing your pronunciation...";
    } else if (state.generationStatus === "error") {
      return "Sorry, we couldn't analyze your recording. Please try again.";
    } else if (state.generationStatus === "ready" && analysis) {
      return (
        <div className={styles.feedbackResults}>
          <div className={styles.feedbackText}>{analysis.feedback || "No feedback available"}</div>
          <div className={styles.analysisMetrics}>
            <h4>Audio Metrics:</h4>
            <ul>
              <li>
                <span>Duration:</span> {analysis.duration ? analysis.duration.toFixed(2) : "N/A"}s
              </li>
              <li>
                <span>Speech Rate:</span>{" "}
                {analysis.speech_rate ? analysis.speech_rate.toFixed(2) : "N/A"} syllables/sec
              </li>
              <li>
                <span>Volume:</span>{" "}
                {analysis.rms_energy ? (analysis.rms_energy * 100).toFixed(0) : "N/A"}%
              </li>
              <li>
                <span>Pitch Variation:</span>{" "}
                {analysis.pitch_std ? analysis.pitch_std.toFixed(2) : "N/A"}
              </li>
            </ul>
          </div>
        </div>
      );
    }
    return "";
  };

  const handlePlayPause = () => {
    if (wavesurferRef.current) {
      wavesurferRef.current.playPause();
    }
  };

  return (
    <main className={styles.main}>
      <Header />

      <div className={styles.contentContainer}>
        <div className={styles.twisterContainer}>
          <h1 className={styles.welcomeText}>
            Welcome to <span className={styles.twisterTitle}>Twister.</span>
          </h1>
          
          <div className={styles.tonguetwisterBox}>
            <h2 className={styles.tonguetwister}>{tongueTwister}</h2>

            <div className={styles.actionsContainer}>
              <button
                className={styles.regenerateButton}
                onClick={regenerateTwister}
                disabled={isRegenerating}
              >
                {isRegenerating ? "Processing..." : "Regenerate"}
              </button>

              <div className={styles.audioContainer}>
                <button
                  className={`${styles.recordButton} ${state.isRecording ? styles.recording : ""}`}
                  onClick={state.isRecording ? stopRecording : startRecording}
                  aria-label={state.isRecording ? "Stop recording" : "Start recording"}
                  disabled={state.isUploading}
                >
                  <div className={styles.innerCircle}></div>
                </button>

                {!state.isRecording && audioBlobRef.current && (
                  <>
                    <div className={styles.waveformWrapper}>
                      <div ref={waveformRef} className={styles.waveform}></div>
                    </div>
                    <button
                      className={styles.playButton}
                      onClick={() => wavesurferRef.current?.playPause()}
                      aria-label={state.isPlaying ? "Pause recording" : "Play recording"}
                      disabled={state.isUploading}
                    >
                      {state.isPlaying ? "Pause" : "Play"}
                    </button>
                    <button
                      className={styles.uploadButton}
                      onClick={handleUpload}
                      disabled={state.isUploading || state.isRecording}
                    >
                      {getUploadButtonText()}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className={styles.feedbackPanel}>
          <h3 className={styles.feedbackTitle}>Feedback</h3>
          <div
            className={`${styles.feedbackContent} ${
              state.generationStatus === "loading" ? styles.loading : ""
            }`}
          >
            {renderFeedbackContent()}
          </div>
        </div>
      </div>
    </main>
  );
}