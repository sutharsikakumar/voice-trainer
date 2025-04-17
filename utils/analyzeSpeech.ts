export interface SpeechAnalysis {
  duration: number;
  speech_rate: number;
  rms_energy: number;
  pitch_std: number;
  feedback?: string;
}

export async function getAudioDuration(audioData: Blob): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    const url = URL.createObjectURL(audioData);
    
    audio.addEventListener('loadedmetadata', () => {
      URL.revokeObjectURL(url);
      resolve(audio.duration);
    });
    
    audio.addEventListener('error', (error) => {
      URL.revokeObjectURL(url);
      reject(error);
    });
    
    audio.src = url;
  });
}

export function analyzeSpeech(transcript: string, duration: number): SpeechAnalysis {
  // Basic analysis based on transcript length and duration
  const wordCount = transcript.split(/\s+/).length;
  const speech_rate = wordCount / (duration / 60); // words per minute
  
  return {
    duration,
    speech_rate,
    rms_energy: 0.5, // placeholder value
    pitch_std: 20, // placeholder value
  };
}

export async function analyzeAudio(audioBlob: Blob): Promise<any> {
  try {
    const formData = new FormData();
    formData.append("audio", audioBlob);
    
    const response = await fetch("/api/analyze", {
      method: "POST",
      body: formData,
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Analysis API error response:", errorText);
      throw new Error(`Analysis failed: ${errorText || "Unknown error"}`);
    }
    
    const data = await response.json();
    return { success: true, ...data }; 
  } catch (error) {
    console.error("Error in analyzeAudio:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to analyze audio" 
    };
  }
}