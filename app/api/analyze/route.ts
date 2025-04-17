import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    // Parse JSON data instead of trying to get FormData
    const jsonData = await request.json();
    const { filePath, tongueTwister } = jsonData;
    
    if (!filePath) {
      return NextResponse.json(
        { success: false, error: "No file path provided" },
        { status: 400 }
      );
    }

    // Forward to Python service
    const pythonServiceUrl = process.env.PYTHON_SERVICE_URL || "http://localhost:8000";
    
    try {
      // Create a JSON payload for the Python service
      const pythonRequest = {
        filePath,
        tongueTwister
      };

      // Send to Python service as JSON
      const analysisResponse = await fetch(`${pythonServiceUrl}/analyze-audio`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(pythonRequest),
      });
      
      if (!analysisResponse.ok) {
        const errorData = await analysisResponse.text();
        return NextResponse.json(
          { success: false, error: `Python service error: ${errorData}` },
          { status: 500 }
        );
      }

      const analysisResult = await analysisResponse.json();
      return NextResponse.json({ success: true, ...analysisResult });
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