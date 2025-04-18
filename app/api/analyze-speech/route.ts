import { NextRequest, NextResponse } from "next/server";
import OpenAI from 'openai';
import { transcribeAudio } from '@/utils/transcribeAudio';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

    let transcript;
    try {
      if (audioFile) {
        transcript = await transcribeAudio(audioFile);
      } else if (audioUrl) {
        const response = await fetch(audioUrl);
        const audioBlob = await response.blob();
        const audioFile = new File([audioBlob], 'audio.webm', { type: 'audio/webm' });
        transcript = await transcribeAudio(audioFile);
      }
    } catch (error) {
      console.error('Error in transcription:', error);
      return NextResponse.json(
        { error: 'Failed to transcribe audio', success: false },
        { status: 500 }
      );
    }
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4-1106-preview",
      messages: [
        {
          role: "system",
          content: `You are a speech analysis expert. Analyze the provided transcript and provide feedback on:
          1. Clarity and pronunciation
          2. Pace and rhythm
          3. Confidence and engagement
          4. Areas for improvement
          
          Format your response as a valid JSON object with this exact structure:
          {
            "clarity": "Feedback on clarity and pronunciation",
            "pace": "Feedback on pace and rhythm",
            "confidence": "Feedback on confidence and engagement",
            "improvements": "Specific areas for improvement"
          }`
        },
        {
          role: "user",
          content: `Analyze this speech transcript: ${transcript}`
        }
      ],
      temperature: 0.7,
      max_tokens: 1000,
      response_format: { type: "json_object" }
    });

    if (!completion.choices[0]?.message?.content) {
      throw new Error('No content received from GPT-4');
    }

    const analysis = JSON.parse(completion.choices[0].message.content);
    
    if (!analysis.clarity || !analysis.pace || !analysis.confidence || !analysis.improvements) {
      throw new Error('Invalid analysis format received from GPT-4');
    }

    return NextResponse.json({
      success: true,
      data: analysis
    });
  } catch (error) {
    console.error('Error in analyze-speech API:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to analyze speech', success: false },
      { status: 500 }
    );
  }
} 