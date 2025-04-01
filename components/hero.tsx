"use client";
import { useState, useEffect } from "react";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import styles from "./hero.module.css";

export default function Home() {
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      setSupabase(createClient(supabaseUrl, supabaseKey));
    }
  }, []);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    selectedFile?.type.startsWith("audio") ? setFile(selectedFile) : alert("Please upload a valid audio file.");
  };

  const handleUpload = async () => {
    if (!file || !supabase) return;
    setUploading(true);
    setUploadError(null);

    const fileName = `${Date.now()}-${file.name}`;
    const { error } = await supabase.storage
      .from("audio-recordings")
      .upload(fileName, file, { cacheControl: "3600", upsert: false })
      .catch((err) => {
        setUploadError(err.message);
        throw err;
      });

    error ? setUploadError(error.message) : setFile(null);
    setUploading(false);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      let chunks: Blob[] = [];

      recorder.ondataavailable = (event) => event.data.size > 0 && chunks.push(event.data);
      recorder.onstop = () => {
        setAudioBlob(new Blob(chunks, { type: "audio/webm" }));
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start(200);
      setRecording(true);
      setMediaRecorder(recorder);
    } catch (error) {
      console.error("Error starting recording:", error);
      setUploadError("Microphone access required for recording");
    }
  };

  const stopRecording = () => {
    mediaRecorder?.stop();
    setRecording(false);
  };

  const uploadRecordedAudio = async () => {
    if (!audioBlob || !supabase) return;
    setUploading(true);
    setUploadError(null);

    const file = new File([audioBlob], "recorded-audio.webm", { type: "audio/webm" });
    const fileName = `${Date.now()}-recorded-audio.webm`;

    const { error } = await supabase.storage
      .from("audio-recordings")
      .upload(fileName, file, { cacheControl: "3600", upsert: false })
      .catch((err) => {
        setUploadError(err.message);
        throw err;
      });

    error ? setUploadError(error.message) : setAudioBlob(null);
    setUploading(false);
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Speech Trainer</h1>
      <p className={styles.description}>
        Meet your speech coach! Get started now by uploading your speech or recording in real-time to get personalized feedback on diction, pace, tone, and more!
      </p>

      {uploadError && <div className={styles.errorMessage}>{uploadError}</div>}

      <div className={styles.boxContainer}>
        <div className={styles.recordingBox}>
          <h2 className={styles.subtitle}>Upload Audio</h2>
          <input
            type="file"
            accept="audio/*"
            onChange={handleFileChange}
            className={styles.hiddenInput}
            id="fileInput"
          />
          <label htmlFor="fileInput" className={styles.uploadButton}>
            Choose Audio File
          </label>
          {file && <p className={styles.fileName}>{file.name}</p>}
          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className={!file || uploading ? styles.disabledButton : styles.uploadButton}
          >
            {uploading ? "Uploading..." : "Upload"}
          </button>
        </div>

        <div className={styles.recordingBox}>
          <h2 className={styles.subtitle}>Record Audio</h2>
          <button
            onClick={startRecording}
            disabled={recording}
            className={recording ? styles.disabledButton : styles.recordButton}
          >
            {recording ? "Recording..." : "Start Recording"}
          </button>
          <button
            onClick={stopRecording}
            disabled={!recording}
            className={!recording ? styles.disabledButton : styles.stopButton}
          >
            Stop Recording
          </button>
          {audioBlob && (
            <div className={styles.audioControls}>
              <audio controls className={styles.audioPlayer}>
                <source src={URL.createObjectURL(audioBlob)} type="audio/webm" />
              </audio>
              <button
                onClick={uploadRecordedAudio}
                disabled={uploading}
                className={uploading ? styles.disabledButton : styles.uploadRecordButton}
              >
                {uploading ? "Uploading..." : "Upload Recording"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}