"use client";
import styles from "./page.module.css";
import Link from "next/link";
import Header from "@/components/header";
import { useEffect, useRef, useState, MouseEvent } from "react";
import WaveSurfer from "wavesurfer.js";

interface AudioAnalysis {
  duration: number;
  tempo: number;
  pitch_mean: number;
  pitch_std: number;
  speech_rate: number;
  rms_energy: number;
  spectral_centroid: number;
  spectral_bandwidth: number;
}

interface AnalysisResponse {
  success: boolean;
  data: {
    analysis: AudioAnalysis;
    feedback: string;
  };
}

interface TwisterResponse {
  success: boolean;
  twister?: string;
  error?: string;
}

interface UploadResponse {
  success: boolean;
  data?: { path: string };
  error?: string;
}

export default function Twister(): JSX.Element {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [audioURL, setAudioURL] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [tongueTwister, setTongueTwister] = useState<string>(
    "How much ground would a groundhog hog, if a groundhog could hog ground?"
  );
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "success" | "error">("idle");
  const [feedbackStatus, setFeedbackStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [feedback, setFeedback] = useState<AnalysisResponse | null>(null);
  const [uploadedFilePath, setUploadedFilePath] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioBlobRef = useRef<Blob | null>(null);
  const waveformRef = useRef<HTMLDivElement | null>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);

  const regenerateTwister = async (): Promise<void> => {
    try {
      setIsLoading(true);
      const response: Response = await fetch("/api/twister");
      const data: TwisterResponse = await response.json();

      if (data.success && data.twister) {
        setTongueTwister(data.twister);
        setFeedback(null);
        setFeedbackStatus("idle");
      } else {
        console.error("Failed to fetch tongue twister:", data.error || "Unknown error");
      }
    } catch (error: unknown) {
      console.error("Error fetching tongue twister:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const startRecording = async (): Promise<void> => {
    setAudioURL(null);
    setUploadStatus("idle");
    setFeedback(null);
    setFeedbackStatus("idle");

    try {
      const stream: MediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder: MediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event: BlobEvent): void => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = (): void => {
        const audioBlob: Blob = new Blob(audioChunksRef.current, { type: "audio/wav" });
        audioBlobRef.current = audioBlob;
        const audioUrl: string = URL.createObjectURL(audioBlob);
        setAudioURL(audioUrl);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error: unknown) {
      console.error("Error starting recording:", error);
      setIsRecording(false);
    }
  };

  const stopRecording = (): void => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const uploadRecording = async (): Promise<void> => {
    if (!audioBlobRef.current) {
      console.error("No audio recording to upload");
      return;
    }

    try {
      setIsUploading(true);

      const formData: FormData = new FormData();
      formData.append("audio", audioBlobRef.current, `recording-${Date.now()}.wav`);

      const response: Response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const result: UploadResponse = await response.json();

      if (result.success && result.data) {
        console.log("Upload successful:", result.data);
        setUploadStatus("success");
        setUploadedFilePath(result.data.path);

        await analyzeRecording(result.data.path);
      } else {
        console.error("Upload failed:", result.error || "Unknown error");
        setUploadStatus("error");
      }
    } catch (error: unknown) {
      console.error("Error uploading recording:", error);
      setUploadStatus("error");
    } finally {
      setIsUploading(false);
    }
  };

  const analyzeRecording = async (filePath: string): Promise<void> => {
    if (!filePath) {
      console.error("No file path provided for analysis");
      return;
    }

    try {
      setFeedbackStatus("loading");

      const response: Response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filePath,
          tongueTwister,
        }),
      });

      const result: AnalysisResponse = await response.json();

      if (result.success) {
        console.log("Analysis successful:", result.data);
        setFeedback(result);
        setFeedbackStatus("ready");
      } else {
        console.error("Analysis failed:", result.error || "Unknown error");
        setFeedbackStatus("error");
      }
    } catch (error: unknown) {
      console.error("Error analyzing recording:", error);
      setFeedbackStatus("error");
    }
  };

  useEffect((): (() => void) | undefined => {
    if (uploadStatus !== "idle") {
      const timer: NodeJS.Timeout = setTimeout(() => {
        setUploadStatus("idle");
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [uploadStatus]);

  useEffect((): (() => void) => {
    if (audioURL && waveformRef.current) {
      wavesurferRef.current = WaveSurfer.create({
        container: waveformRef.current,
        waveColor: "#999",
        progressColor: "#333",
        height: 100,
      });

      wavesurferRef.current.on("play", () => setIsPlaying(true));
      wavesurferRef.current.on("pause", () => setIsPlaying(false));
      wavesurferRef.current.on("finish", () => setIsPlaying(false));

      wavesurferRef.current.load(audioURL);
    }

    return () => {
      if (wavesurferRef.current) {
        wavesurferRef.current.destroy();
        wavesurferRef.current = null;
      }
    };
  }, [audioURL]);

  const getUploadButtonText = (): string => {
    if (isUploading) return "Uploading...";
    if (uploadStatus === "success") return "Uploaded!";
    if (uploadStatus === "error") return "Failed!";
    return "Upload";
  };

  const renderFeedbackContent = (): JSX.Element | string => {
    if (feedbackStatus === "idle") {
      return "Record and upload your attempt to get feedback";
    } else if (feedbackStatus === "loading") {
      return "Analyzing your pronunciation...";
    } else if (feedbackStatus === "error") {
      return "Sorry, we couldn't analyze your recording. Please try again.";
    } else if (feedbackStatus === "ready" && feedback) {
      return (
        <div className={styles.feedbackResults}>
          <div className={styles.feedbackText}>{feedback.data.feedback}</div>
          <div className={styles.analysisMetrics}>
            <h4>Audio Metrics:</h4>
            <ul>
              <li>
                <span>Duration:</span> {feedback.data.analysis.duration.toFixed(2)}s
              </li>
              <li>
                <span>Speech Rate:</span>{" "}
                {feedback.data.analysis.speech_rate.toFixed(2)} syllables/sec
              </li>
              <li>
                <span>Volume:</span>{" "}
                {(feedback.data.analysis.rms_energy * 100).toFixed(0)}%
              </li>
              <li>
                <span>Pitch Variation:</span>{" "}
                {feedback.data.analysis.pitch_std.toFixed(2)}
              </li>
            </ul>
          </div>
        </div>
      );
    }
    return "";
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
                disabled={isLoading}
              >
                {isLoading ? "Loading..." : "Regenerate"}
              </button>

              <div className={styles.audioContainer}>
                <button
                  className={`${styles.recordButton} ${isRecording ? styles.recording : ""}`}
                  onClick={isRecording ? stopRecording : startRecording}
                  aria-label={isRecording ? "Stop recording" : "Start recording"}
                  disabled={isLoading || isUploading}
                >
                  <div className={styles.innerCircle}></div>
                </button>

                {!isRecording && audioURL && (
                  <>
                    <div className={styles.waveformWrapper}>
                      <div ref={waveformRef} className={styles.waveform}></div>
                    </div>
                    <button
                      className={styles.playButton}
                      onClick={(e: MouseEvent<HTMLButtonElement>): void =>
                        wavesurferRef.current?.playPause()
                      }
                      aria-label={isPlaying ? "Pause recording" : "Play recording"}
                      disabled={isUploading}
                    >
                      {isPlaying ? "Pause" : "Play"}
                    </button>
                    <button
                      className={`${styles.uploadButton} ${
                        uploadStatus === "success"
                          ? styles.uploadSuccess
                          : uploadStatus === "error"
                          ? styles.uploadError
                          : ""
                      }`}
                      onClick={uploadRecording}
                      disabled={isUploading || !audioURL}
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
              feedbackStatus === "loading" ? styles.loading : ""
            }`}
          >
            {renderFeedbackContent()}
          </div>
        </div>
      </div>
    </main>
  );
}