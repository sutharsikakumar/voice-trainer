"use client";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import styles from "./page.module.css";
import { processAudio } from "../../utils/audioProcessor";
import { SpeechAnalysis } from "../../utils/analyzeSpeech";

export default function AnalysisPage() {
  const searchParams = useSearchParams();
  const fileName = searchParams.get('fileName');
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [analysisData, setAnalysisData] = useState<SpeechAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>("");

  useEffect(() => {
    console.log("Current searchParams:", Object.fromEntries(searchParams.entries()));
    console.log("Current fileName:", fileName);
    setDebugInfo(prev => prev + `\nFileName received: ${fileName || "none"}`);
    
    if (!fileName) {
      setError("No file name provided. Please upload an audio file first.");
      return;
    }

    let isMounted = true;

    const analyzeAudio = async () => {
      try {
        setIsLoading(true);
        setError(null);
        setDebugInfo(prev => prev + "\nStarting audio analysis...");
        
        const analysis = await processAudio(fileName);
        if (isMounted) {
          setAnalysisData(analysis);
          setDebugInfo(prev => prev + "\nAnalysis completed successfully");
        }
      } catch (err: any) {
        console.error("Error analyzing audio:", err);
        if (isMounted) {
          setError(`Failed to analyze audio: ${err?.message || "Unknown error"}`);
          setDebugInfo(prev => prev + `\nERROR: ${err?.message || "Unknown error"}`);
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

  return (
    <div className={styles.container || "container"}>
      {/* Debug Panel - Remove this in production */}
      <div style={{
        margin: '10px 0',
        padding: '10px',
        backgroundColor: '#f0f0f0',
        borderRadius: '4px',
        whiteSpace: 'pre-wrap'
      }}>
        <h3>Debug Info:</h3>
        <p>
          Environment check:<br />
          - SUPABASE_URL exists: {process.env.NEXT_PUBLIC_SUPABASE_URL ? "Yes" : "No"}<br />
          - SUPABASE_KEY exists: {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "Yes" : "No"}<br />
          - fileName from URL: {fileName || "None"}<br />
          - isLoading: {isLoading ? "Yes" : "No"}<br />
          - hasError: {error ? "Yes" : "No"}<br />
          - hasData: {analysisData ? "Yes" : "No"}
        </p>
        <p>{debugInfo}</p>
      </div>

      {/* Transcript Section */}
      <div className={styles.section || "section"}>
        <h2>Transcript</h2>
        <div className={styles.content || "content"}>
          {isLoading ? (
            <p>Transcribing audio... This may take a moment.</p>
          ) : error ? (
            <p style={{ color: 'red' }}>{error}</p>
          ) : !fileName ? (
            <p>No audio file selected. Please upload an audio file first.</p>
          ) : !analysisData ? (
            <p>Analyzing recording: {fileName}</p>
          ) : (
            <div>
              <p style={{ marginBottom: '10px' }}>
                <strong>{analysisData.wpm}</strong> words per minute | 
                <strong> {analysisData.fillerWords.count}</strong> filler words ({analysisData.fillerWords.percentage.toFixed(1)}%)
              </p>
              <div style={{
                whiteSpace: 'pre-wrap',
                backgroundColor: 'white',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '4px'
              }}>
                {analysisData.transcript}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Suggestions Section */}
      <div className={styles.section || "section"}>
        <h2>Suggestions</h2>
        <div className={styles.content || "content"}>
          {isLoading ? (
            <p>Generating suggestions...</p>
          ) : error ? (
            <p>Unable to generate suggestions due to an error.</p>
          ) : !analysisData ? (
            <p>Suggestions will be displayed here once analysis is complete.</p>
          ) : (
            <div>
              <p style={{ whiteSpace: 'pre-line' }}>{analysisData.suggestions}</p>
              
              {/* Info Box with additional analysis */}
              {analysisData.additionalInfo && (
                <div style={{
                  marginTop: '15px',
                  padding: '10px',
                  backgroundColor: '#f0f7ff',
                  borderLeft: '4px solid #0070f3',
                  borderRadius: '4px'
                }}>
                  <h3 style={{ margin: '0 0 8px 0' }}>Additional Analysis</h3>
                  <p style={{ whiteSpace: 'pre-line' }}>{analysisData.additionalInfo}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Plus Button */}
      <button
        onClick={handlePlusClick}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          width: '50px',
          height: '50px',
          borderRadius: '50%',
          backgroundColor: '#0070f3',
          color: 'white',
          fontSize: '24px',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        +
      </button>

      {/* Pop-up Modal */}
      {isPopupOpen && (
        <div style={{
          position: 'fixed',
          bottom: '80px',
          right: '20px',
          backgroundColor: 'white',
          padding: '15px',
          borderRadius: '8px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          zIndex: 100
        }}>
          <button
            onClick={handleClosePopup}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: '4px',
              backgroundColor: '#f0f0f0',
              cursor: 'pointer'
            }}
          >
            Close
          </button>
          <button style={{
            padding: '8px 16px',
            border: 'none',
            borderRadius: '4px',
            backgroundColor: '#f0f0f0',
            cursor: 'pointer'
          }}>
            Record Again
          </button>
          <button style={{
            padding: '8px 16px',
            border: 'none',
            borderRadius: '4px',
            backgroundColor: '#f0f0f0',
            cursor: 'pointer'
          }}>
            Upload Another Audio
          </button>
        </div>
      )}
    </div>
  );
}