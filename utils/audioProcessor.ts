import { createClient } from "@supabase/supabase-js";
import { getTranscript } from "./getTranscript";
import { analyzeSpeech, getAudioDuration, SpeechAnalysis } from "./analyzeSpeech";


export async function processAudio(fileName: string): Promise<SpeechAnalysis> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    
    const { data: audioData, error: audioError } = await supabase
      .storage
      .from('audio-recordings')
      .download(fileName);
      
    if (audioError || !audioData) {
      throw new Error("Could not download audio file");
    }
    
    const audioDuration = await getAudioDuration(audioData);
    const transcript = await getTranscript(fileName);
    const analysis = analyzeSpeech(transcript, audioDuration);
    
    return analysis;
  } catch (error) {
    console.error("Error processing audio:", error);
    throw error;
  }
}