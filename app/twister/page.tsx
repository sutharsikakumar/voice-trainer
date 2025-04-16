"use client";
import styles from "./page.module.css";
import Link from "next/link";
import Header from "@/components/header";
import { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";

export default function Twister() {
  const [isRecording, setIsRecording] = useState(false);
  const [audioURL, setAudioURL] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);

  const startRecording = async () => {
    setAudioURL(null);
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream);
    mediaRecorderRef.current = mediaRecorder;
    audioChunksRef.current = [];

    mediaRecorder.ondataavailable = (event) => {
      audioChunksRef.current.push(event.data);
    };

    mediaRecorder.onstop = () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: "audio/wav" });
      const audioUrl = URL.createObjectURL(audioBlob);
      setAudioURL(audioUrl);
    };

    mediaRecorder.start();
    setIsRecording(true);
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  useEffect(() => {
    if (audioURL && waveformRef.current) {
      wavesurferRef.current = WaveSurfer.create({
        container: waveformRef.current,
        waveColor: "#999",
        progressColor: "#333",
        height: 100,
      });

      wavesurferRef.current.on('play', () => setIsPlaying(true));
      wavesurferRef.current.on('pause', () => setIsPlaying(false));
      wavesurferRef.current.on('finish', () => setIsPlaying(false));

      wavesurferRef.current.load(audioURL);
    }

    return () => {
      if (wavesurferRef.current) {
        wavesurferRef.current.destroy();
        wavesurferRef.current = null;
      }
    };
  }, [audioURL]);

  return (
    <main className={styles.main}>
      <Header />

      <div className={styles.contentContainer}>
        <div className={styles.twisterContainer}>
          <h1 className={styles.welcomeText}>
            Welcome to <span className={styles.twisterTitle}>Twister.</span>
          </h1>

          <div className={styles.tonguetwisterBox}>
            <h2 className={styles.tonguetwister}>
              How much ground would a groundhog hog, if a groundhog could hog ground?
            </h2>

            <div className={styles.actionsContainer}>
              <button className={styles.regenerateButton}>
                Regenerate
              </button>

              <div className={styles.audioContainer}>
                <button
                  className={`${styles.recordButton} ${isRecording ? styles.recording : ""}`}
                  onClick={isRecording ? stopRecording : startRecording}
                  aria-label={isRecording ? "Stop recording" : "Start recording"}
                >
                  <div className={styles.innerCircle}></div>
                </button>

                {!isRecording && audioURL && (
                  <>
                    <div className={styles.waveformWrapper}>
                      <div ref={waveformRef} className={styles.waveform}></div>
                    </div>
                    <button
                      className={styles.uploadButton}
                      onClick={() => wavesurferRef.current?.playPause()}
                      aria-label={isPlaying ? "Pause recording" : "Play recording"}
                    >
                      {isPlaying ? "Pause" : "Play"}
                    </button>
                    <button className={styles.uploadButton}>Upload</button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className={styles.feedbackPanel}>
          <h3 className={styles.feedbackTitle}>Feedback</h3>
          <p className={styles.feedbackContent}>Thinking...</p>
        </div>
      </div>
    </main>
  );
}