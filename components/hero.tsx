"use client";
import { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import styles from "./hero.module.css";


const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState<boolean>(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);


  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile && selectedFile.type === "audio/mpeg") {
      setFile(selectedFile);
    } else {
      alert("Please upload an MP3 file.");
    }
  };


  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);

    const fileName = `${Date.now()}-${file.name}`;
    const { error } = await supabase.storage
      .from("audio-recordings")
      .upload(fileName, file, { cacheControl: "3600", upsert: false });

    if (error) {
      console.error("Error uploading file:", error);
    } else {
      console.log("File uploaded successfully");
    }

    setUploading(false);
  };

  const startRecording = async () => {
    setRecording(true);
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);

    recorder.ondataavailable = (event) => {
      const audioData = event.data;
      setAudioBlob(audioData);
    };

    recorder.onstop = () => {
      setRecording(false);
    };

    recorder.start();
    setMediaRecorder(recorder);
  };

  const stopRecording = () => {
    if (mediaRecorder) {
      mediaRecorder.stop();
    }
  };

  const uploadRecordedAudio = async () => {
    if (!audioBlob) return;

    const fileName = `${Date.now()}-recorded-audio.wav`;
    const { error } = await supabase.storage
      .from("audio-recordings")
      .upload(fileName, audioBlob, { cacheControl: "3600", upsert: false });

    if (error) {
      console.error("Error uploading recorded audio:", error);
    } else {
      console.log("Recorded audio uploaded successfully");
    }
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Speech Trainer</h1>
      <div className="flex flex-row gap-12">
        <div className={styles.uploadBox}>
          <h2 className="text-2xl font-bold mb-4">Upload Audio</h2>
          <input
            type="file"
            accept="audio/mp3"
            onChange={handleFileChange}
            className={styles.hiddenInput}
            id="fileInput"
          />
          <label
            htmlFor="fileInput"
            className={styles.uploadButton}
          >
            Choose MP3 File
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
          <h2 className="text-2xl font-bold mb-4">Record Your Speech</h2>
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
            <div className="flex flex-col items-center gap-4">
              <audio controls className="mt-4">
                <source
                  src={URL.createObjectURL(audioBlob)}
                  type="audio/wav"
                />
              </audio>
              <button
                onClick={uploadRecordedAudio}
                className={styles.uploadRecordButton}
              >
                Upload Recording
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}