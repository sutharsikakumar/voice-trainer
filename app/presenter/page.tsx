"use client";
import { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import { supabase } from "@/lib/supabase";
import { AudioAnalysis, RecordingState, Slide, SlideGenerationResponse } from "@/lib/types";
import styles from "./page.module.css";
import Header from "@/components/header";

export default function Presenter() {
  const [state, setState] = useState({
    isRecording: false,
    isPlaying: false,
    isUploading: false,
    isAnalyzing: false,
    uploadStatus: "idle",
    generationStatus: "idle",
    error: null as string | null,
  });

  const [slides, setSlides] = useState<Slide[] | null>(null);
  const [analysis, setAnalysis] = useState<AudioAnalysis | null>(null);
  const [tongueTwister, setTongueTwister] = useState("");
  const [transcript, setTranscript] = useState<string | null>(null);

  const waveformRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioBlobRef = useRef<Blob | null>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);

  const startRecording = async () => {
    try {
      if (wavesurferRef.current) {
        wavesurferRef.current.destroy();
        wavesurferRef.current = null;
      }
      if (audioBlobRef.current) {
        URL.revokeObjectURL(URL.createObjectURL(audioBlobRef.current));
        audioBlobRef.current = null;
      }
      audioChunksRef.current = [];

      if (waveformRef.current) {
        waveformRef.current.innerHTML = '';
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
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
      
      const audioBlob = new Blob(audioChunksRef.current, {
        type: mediaRecorderRef.current.mimeType,
      });
      audioBlobRef.current = audioBlob;
      
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

  const uploadRecording = async () => {
    if (!audioBlobRef.current) {
      setState(prev => ({ ...prev, error: "No audio recording to upload" }));
      return;
    }

    try {
      setState(prev => ({
        ...prev,
        isUploading: true,
        isAnalyzing: true,
        error: null,
      }));
      setSlides(null);
      setAnalysis(null);
      setTranscript(null);

      const fileName = `presentation-${Date.now()}.webm`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("audio-recordings")
        .upload(fileName, audioBlobRef.current);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("audio-recordings")
        .getPublicUrl(uploadData.path);

      const formData = new FormData();
      formData.append("audioUrl", publicUrl);

      const [generationResponse, analysisResponse] = await Promise.all([
        fetch("/api/generate-slides", {
          method: "POST",
          body: formData,
        }),
        fetch("/api/analyze-speech", {
          method: "POST",
          body: formData,
        }),
      ]);

      if (!generationResponse.ok) {
        const errorText = await generationResponse.text();
        throw new Error(`Slide generation failed: ${errorText}`);
      }

      if (!analysisResponse.ok) {
        const errorText = await analysisResponse.text();
        throw new Error(`Analysis failed: ${errorText}`);
      }

      const [generationData, analysisData] = await Promise.all([
        generationResponse.json(),
        analysisResponse.json(),
      ]);

      if (!generationData.success) {
        throw new Error(generationData.error || 'Failed to generate slides');
      }

      if (!analysisData.success) {
        throw new Error(analysisData.error || 'Failed to analyze speech');
      }

      setTranscript(generationData.data.transcript);
      setSlides(generationData.data.slides);
      setAnalysis(analysisData.data);
      setState(prev => ({ ...prev, generationStatus: "ready" }));
    } catch (error) {
      console.error("Error in upload and processing:", error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : "Failed to process recording",
        generationStatus: "error",
      }));
    } finally {
      setState(prev => ({
        ...prev,
        isUploading: false,
        isAnalyzing: false,
      }));
    }
  };

  useEffect(() => {
    if (waveformRef.current && audioBlobRef.current) {
      const audioUrl = URL.createObjectURL(audioBlobRef.current);
      wavesurferRef.current = WaveSurfer.create({
        container: waveformRef.current,
        waveColor: "#999",
        progressColor: "#333",
        height: 100,
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

  const getUploadButtonText = () => {
    if (state.isUploading) return "Generating...";
    if (state.uploadStatus === "success") return "Generated!";
    if (state.uploadStatus === "error") return "Failed!";
    return "Generate Slides";
  };

  const renderSlidesContent = () => {
    if (state.generationStatus === "idle") {
      return "Record your presentation to generate slides";
    } else if (state.generationStatus === "loading") {
      return "Generating slides...";
    } else if (state.generationStatus === "error") {
      return "Sorry, we couldn't generate slides. Please try again.";
    } else if (state.generationStatus === "ready" && slides) {
      return (
        <div className={styles.slidesGrid}>
          {slides.map((slide: Slide, index: number) => (
            <div key={index} className={styles.slideCard}>
              <div className={styles.slideContent}>
                <h4>{slide.title}</h4>
                <div className={styles.bulletPoints}>
                  {slide.content}
                </div>
              </div>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <main className={styles.main}>
      <Header />
      <div className={styles.container}>
        <h1 className={styles.title}>
          Welcome to <span>Presenter</span>
        </h1>
        <p className={styles.description}>
          Record presentation below.
        </p>

        <div className={styles.recordingContainer}>
          <div className={styles.waveform} ref={waveformRef} />
          <div className={styles.controls}>
            {state.isRecording ? (
              <button
                className={styles.stopButton}
                onClick={stopRecording}
              >
                Stop Recording
              </button>
            ) : (
              <button
                className={styles.recordButton}
                onClick={startRecording}
                disabled={state.isUploading}
              >
                Start Recording
              </button>
            )}
            {audioBlobRef.current && (
              <>
                <button
                  className={styles.playButton}
                  onClick={() => wavesurferRef.current?.playPause()}
                  disabled={state.isUploading}
                >
                  {state.isPlaying ? "Pause" : "Play"}
                </button>
                <button
                  className={styles.uploadButton}
                  onClick={uploadRecording}
                  disabled={state.isUploading}
                >
                  {getUploadButtonText()}
                </button>
              </>
            )}
          </div>
        </div>

        {transcript && (
          <div className={styles.transcriptContainer}>
            <h2>Transcript</h2>
            <div className={styles.transcriptContent}>
              {transcript}
            </div>
          </div>
        )}

        <div className={styles.slidesSection}>
          {renderSlidesContent()}
        </div>

        {state.error && <div className={styles.error}>{state.error}</div>}
      </div>
    </main>
  );
}
