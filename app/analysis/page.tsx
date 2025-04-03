"use client";
import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import styles from "./page.module.css";
import { processAudio } from "../../utils/audioProcessor";
import { SpeechAnalysis } from "../../utils/analyzeSpeech";
import Link from "next/link";

export default function AnalysisPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const fileName = searchParams.get('fileName');
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [analysisData, setAnalysisData] = useState<SpeechAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!fileName) {
      setError("No file name provided. Please upload an audio file first.");
      return;
    }

    let isMounted = true;

    const analyzeAudio = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const analysis = await processAudio(fileName);
        if (isMounted) {
          setAnalysisData(analysis);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(`Failed to analyze audio: ${err?.message || "Unknown error"}`);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    
    analyzeAudio();

    return () => {
      isMounted = false;
    };
  }, [fileName, searchParams]);

  const handlePlusClick = () => {
    setIsPopupOpen(true);
  };

  const handleClosePopup = () => {
    setIsPopupOpen(false);
  };

  const handleBackToHome = () => {
    router.push('/');
  };

  return (
    <div className={styles.container}>
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Transcript</h2>
        <div className={styles.content}>
          {isLoading ? (
            <p>Transcribing audio... This may take a moment.</p>
          ) : error ? (
            <p className={styles.errorText}>{error}</p>
          ) : !fileName ? (
            <p>No audio file selected. Please upload an audio file first.</p>
          ) : !analysisData ? (
            <p>Analyzing recording: {fileName}</p>
          ) : (
            <div>
              <p className={styles.statsLine}>
                <strong>{analysisData.wpm}</strong> words per minute | 
                <strong> {analysisData.fillerWords.count}</strong> filler words ({analysisData.fillerWords.percentage.toFixed(1)}%)
              </p>
              <div className={styles.transcriptBox}>
                {analysisData.transcript}
              </div>
            </div>
          )}
        </div>
      </div>
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Suggestions</h2>
        <div className={styles.content}>
          {isLoading ? (
            <p>Generating suggestions...</p>
          ) : error ? (
            <p>Unable to generate suggestions due to an error.</p>
          ) : !analysisData ? (
            <p>Suggestions will be displayed here once analysis is complete.</p>
          ) : (
            <div>
              <p className={styles.suggestionText}>{analysisData.suggestions}</p>
              {analysisData.additionalInfo && (
                <div className={styles.additionalInfoBox}>
                  <h3 className={styles.additionalInfoTitle}>Additional Analysis</h3>
                  <p className={styles.additionalInfoText}>{analysisData.additionalInfo}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <button 
        className={styles.backButton}
        onClick={handleBackToHome}
      >
        back to home
      </button>

      <button
        onClick={handlePlusClick}
        className={styles.plusButton}
      >
        +
      </button>
      {isPopupOpen && (
        <div className={styles.popup}>
          <button
            onClick={handleClosePopup}
            className={styles.popupButton}
          >
            Close
          </button>
          <button className={styles.popupButton}>
            Record Again
          </button>
          <button className={styles.popupButton}>
            Upload Another Audio
          </button>
        </div>
      )}
    </div>
  );
}