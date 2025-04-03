import { createClient } from "@supabase/supabase-js";
import { getTranscript } from "./getTranscript";
import { analyzeSpeech, getAudioDuration, SpeechAnalysis } from "./analyzeSpeech";

/**
 * Process audio file to get transcript and analysis
 * @param fileName Name of the audio file in Supabase storage
 * @returns Analysis results including transcript and speech metrics
 */
export async function processAudio(fileName: string): Promise<SpeechAnalysis> {
  try {
    // Initialize Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    
    // Get the audio file for duration calculation
    const { data: audioData, error: audioError } = await supabase
      .storage
      .from('audio-recordings')
      .download(fileName);
      
    if (audioError || !audioData) {
      throw new Error("Could not download audio file");
    }
    
    // Create a copy of the blob before using it, since Blob isn't clonable
    // but we can create multiple Blobs from the same ArrayBuffer
    const audioBuffer = await audioData.arrayBuffer();
    const audioBlobForDuration = new Blob([audioBuffer], { type: audioData.type });
    
    // Get audio duration
    const audioDuration = await getAudioDuration(audioBlobForDuration);
    
    // Get transcript (pass fileName, not the blob, as your API handles the download)
    const transcript = await getTranscript(fileName);
    
    // Analyze speech
    const analysis = analyzeSpeech(transcript, audioDuration);
    
    return analysis;
  } catch (error) {
    console.error("Error processing audio:", error);
    throw error;
  }
}