import { createClient } from "@supabase/supabase-js";

/**
 * Gets the transcript for an audio file using OpenAI's Whisper API
 * @param fileName Name of the audio file in Supabase storage
 * @returns The transcript text
 */
export async function getTranscript(fileName: string): Promise<string> {
  try {
    // Initialize Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Get the audio file URL from Supabase storage
    const { data: fileData, error: fileError } = await supabase
      .storage
      .from('audio-recordings')
      .createSignedUrl(`${fileName}`, 60); // 60 seconds expiry

    if (fileError || !fileData) {
      console.error("Error getting file URL:", fileError);
      throw new Error("Could not access the audio file");
    }

    // Call Whisper API
    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.NEXT_PUBLIC_OPENAI_API_KEY}`,
      },
      body: createFormData(fileData.signedUrl, fileName),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Whisper API error: ${error}`);
    }

    const result = await response.json();
    return result.text;
  } catch (error) {
    console.error("Transcription error:", error);
    throw error;
  }
}

/**
 * Helper function to create form data for the Whisper API request
 */
function createFormData(audioUrl: string, fileName: string): FormData {
  const formData = new FormData();
  
  // We need to fetch the audio file and convert it to a blob
  const audioBlob = fetch(audioUrl)
    .then(response => response.blob());
    
  // Add the file to the form data
  audioBlob.then(blob => {
    formData.append("file", blob, fileName);
    formData.append("model", "whisper-1");
    formData.append("response_format", "json");
  });
  
  return formData;
}