export async function getTranscript(fileName: string): Promise<string> {
  try {
    console.log(`Processing transcript for file: ${fileName}`);
    
    const response = await fetch('/api/transcribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName })
    });
    
    console.log(`Transcription API response status: ${response.status}`);
    
    if (!response.ok) {
      const errorResponse = response.clone();
      
      try {
        const errorData = await errorResponse.json();
        throw new Error(errorData.error || 'Transcription failed');
      } catch (parseError) {
        const errorText = await response.text();
        console.error('Raw error response:', errorText);
        throw new Error(`Transcription failed with status ${response.status}`);
      }
    }
    
    const result = await response.json();
    return result.text;
  } catch (error) {
    console.error("Transcription error:", error);
    throw error;
  }
}