import { NextRequest, NextResponse } from "next/server";
import { transcribeAudio } from '@/utils/transcribeAudio';

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || "http://localhost:8000";

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

    // Send to Python service for analysis
    const pythonResponse = await fetch(`${PYTHON_SERVICE_URL}/analyze-audio`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filePath: audioUrl || URL.createObjectURL(audioBlob),
      }),
    });

    if (!pythonResponse.ok) {
      const errorText = await pythonResponse.text();
      console.error("Python service error:", errorText);
      throw new Error(`Analysis failed: ${errorText}`);
    }

    const analysisResult = await pythonResponse.json();
    
    if (!analysisResult.success || !analysisResult.data) {
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
    console.error('Error in analyze-speech API:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to analyze speech', success: false },
      { status: 500 }
    );
  }
} 