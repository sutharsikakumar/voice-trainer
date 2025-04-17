import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioUrl = formData.get('audioUrl') as string;
    
    if (!audioUrl) {
      return NextResponse.json(
        { success: false, error: "No audio URL provided" },
        { status: 400 }
      );
    }

    const pythonServiceUrl = process.env.PYTHON_SERVICE_URL || "http://localhost:8000";
    
    try {
      const pythonRequest = {
        filePath: audioUrl
      };

      const analysisResponse = await fetch(`${pythonServiceUrl}/analyze-audio`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(pythonRequest),
      });
      
      if (!analysisResponse.ok) {
        const errorData = await analysisResponse.text();
        console.error("Python service error:", errorData);
        return NextResponse.json(
          { success: false, error: `Analysis failed: ${errorData}` },
          { status: 500 }
        );
      }

      const analysisResult = await analysisResponse.json();
      
      if (!analysisResult.success || !analysisResult.data) {
        return NextResponse.json(
          { success: false, error: "Invalid response from analysis service" },
          { status: 500 }
        );
      }

      const { analysis, feedback } = analysisResult.data;
      return NextResponse.json({
        success: true,
        data: {
          duration: analysis.duration,
          speech_rate: analysis.speech_rate,
          rms_energy: analysis.rms_energy,
          pitch_std: analysis.pitch_std,
          feedback: feedback
        }
      });
    } catch (connectionError) {
      console.error("Error connecting to Python service:", connectionError);
      return NextResponse.json(
        { 
          success: false, 
          error: "Failed to connect to analysis service. Is the Python service running?" 
        },
        { status: 503 }
      );
    }
  } catch (error) {
    console.error("Audio analysis error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process audio analysis request" },
      { status: 500 }
    );
  }
}