import { NextRequest, NextResponse } from "next/server";

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL;
if (!PYTHON_SERVICE_URL) {
  console.error('PYTHON_SERVICE_URL environment variable is not set');
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;
    const audioUrl = formData.get('audioUrl') as string;
    
    if (!audioFile && !audioUrl) {
      return NextResponse.json(
        { error: 'No audio file or URL provided', success: false },
        { status: 400 }
      );
    }

    let audioBlob: Blob | null = null;
    if (audioFile) {
      audioBlob = audioFile;
    } else if (audioUrl) {
      const response = await fetch(audioUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch audio: ${response.statusText}`);
      }
      audioBlob = await response.blob();
    }

    if (!audioBlob) {
      throw new Error('Failed to get audio data');
    }

    try {
      if (!PYTHON_SERVICE_URL) {
        throw new Error('Analysis service URL is not configured');
      }

      console.log(`Attempting to connect to Python service at: ${PYTHON_SERVICE_URL}`);
      
      const tempAudioUrl = URL.createObjectURL(audioBlob);
      
      const pythonResponse = await fetch(`${PYTHON_SERVICE_URL}/analyze-audio`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify({
          filePath: tempAudioUrl,
        }),
      });

      URL.revokeObjectURL(tempAudioUrl);

      if (!pythonResponse.ok) {
        const errorText = await pythonResponse.text();
        console.error("Python service error response:", errorText);
        throw new Error(`Analysis service returned error: ${errorText}`);
      }

      const analysisResult = await pythonResponse.json();
      
      if (!analysisResult.success || !analysisResult.data) {
        console.error("Invalid analysis result:", analysisResult);
        throw new Error("Invalid response from analysis service");
      }

      const { analysis, feedback } = analysisResult.data;

      return NextResponse.json({
        success: true,
        data: {
          clarity: feedback,
          pace: `Speech rate: ${analysis.speech_rate.toFixed(2)} syllables/sec`,
          confidence: `Volume: ${(analysis.rms_energy * 100).toFixed(0)}%, Pitch variation: ${analysis.pitch_std.toFixed(2)}`,
          improvements: "Practice maintaining consistent volume and pitch variation",
          feedback: feedback,
          duration: analysis.duration,
          speech_rate: analysis.speech_rate,
          rms_energy: analysis.rms_energy,
          pitch_std: analysis.pitch_std
        }
      });
    } catch (error) {
      console.error("Python service connection error:", error);
      
      if (error instanceof Error) {
        if (error.message.includes('fetch failed')) {
          return NextResponse.json(
            { 
              error: "Could not connect to the analysis service. Please try again later.", 
              success: false 
            },
            { status: 503 }
          );
        }
        if (error.message.includes('Analysis service URL is not configured')) {
          return NextResponse.json(
            { 
              error: "Analysis service is not properly configured. Please contact support.", 
              success: false 
            },
            { status: 500 }
          );
        }
      }
      
      return NextResponse.json(
        { 
          error: error instanceof Error ? error.message : 'Failed to analyze speech', 
          success: false 
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in analyze-speech API:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to analyze speech', success: false },
      { status: 500 }
    );
  }
} 
