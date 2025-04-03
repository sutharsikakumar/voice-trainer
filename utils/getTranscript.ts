/**
 * Gets the transcript for an audio file using OpenAI's Whisper API
 * @param fileName Name of the audio file in Supabase storage
 * @returns The transcript text as a Promise<string>
 */
export async function getTranscript(fileName: string): Promise<string> {
  try {
    console.log(`Processing transcript for file: ${fileName}`);
    
    const response = await fetch('/api/transcribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName })
    });
    
    // Log the response status for debugging
    console.log(`Transcription API response status: ${response.status}`);
    
    if (!response.ok) {
      // Store response in variable before reading it
      const errorResponse = response.clone();
      
      // Try to parse error as JSON first
      try {
        const errorData = await errorResponse.json();
        throw new Error(errorData.error || 'Transcription failed');
      } catch (parseError) {
        // If not JSON, get as text from original response
        const errorText = await response.text();
        console.error('Raw error response:', errorText);
        throw new Error(`Transcription failed with status ${response.status}`);
      }
    }
    
    // Read the response body only once
    const result = await response.json();
    return result.text;
  } catch (error) {
    console.error("Transcription error:", error);
    throw error;
  }
}