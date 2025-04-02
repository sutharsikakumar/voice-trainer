"use client";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import styles from "./page.module.css";
import { createClient } from "@supabase/supabase-js";

export default function AnalysisPage() {
  const searchParams = useSearchParams();
  const fileName = searchParams.get('fileName');
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [analysisData, setAnalysisData] = useState<any>(null);

  useEffect(() => {
    if (!fileName) return;

    const fetchAnalysis = async () => {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const { data } = await supabase
        .from('audio-analysis')
        .select('*')
        .eq('file_name', fileName)
        .single();
      if (data) setAnalysisData(data);
    };
    fetchAnalysis();
  }, [fileName]);

  const handlePlusClick = () => {
    setIsPopupOpen(true);
  };

  const handleClosePopup = () => {
    setIsPopupOpen(false);
  };

  return (
    <div className={styles.container}>
      {/* Transcript Section */}
      <div className={styles.section}>
        <h2>Transcript</h2>
        <div className={styles.content}>
          {fileName ? (
            <p>Analyzing recording: {fileName}</p>
          ) : (
            <p>Transcript will be displayed here.</p>
          )}
          {/* You can display analysisData.transcript here if available */}
          {analysisData?.transcript && <p>{analysisData.transcript}</p>}
        </div>
      </div>

      {/* Suggestions Section */}
      <div className={styles.section}>
        <h2>Suggestions</h2>
        <div className={styles.content}>
          {analysisData?.suggestions ? (
            <p>{analysisData.suggestions}</p>
          ) : (
            <p>Suggestions will be displayed here.</p>
          )}
          {/* Optional smaller box with speech bubble tail */}
          <div className={styles.infoBox}>
            <p>Additional info</p>
            {/* You can display additional analysis info here */}
            {analysisData?.additional_info && <p>{analysisData.additional_info}</p>}
          </div>
        </div>
      </div>

      {/* Plus Button */}
      <button
        onClick={handlePlusClick}
        className={styles.plusButton}
      >
        +
      </button>

      {/* Pop-up Modal */}
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