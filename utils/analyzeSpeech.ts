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