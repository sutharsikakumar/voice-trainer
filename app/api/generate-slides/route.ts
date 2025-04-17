import { NextRequest, NextResponse } from "next/server";
import OpenAI from 'openai';
import { transcribeAudio } from '@/utils/transcribeAudio';

// Enable Edge Runtime
export const runtime = 'edge';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Constants for timeouts
const TRANSCRIPTION_TIMEOUT = 30000; // 30 seconds
const SLIDE_GENERATION_TIMEOUT = 45000; // 45 seconds
const IMAGE_GENERATION_TIMEOUT = 20000; // 20 seconds per image

interface Slide {
  title: string;
  content: string;
  imageUrl?: string;
}

// Helper function to create a timeout promise
function timeoutPromise<T>(promise: Promise<T>, ms: number, operation: string): Promise<T> {
  let timeoutId: NodeJS.Timeout;
  
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${operation} operation timed out after ${ms}ms`));
    }, ms);
  });

  return Promise.race([
    promise,
    timeoutPromise
  ]).finally(() => clearTimeout(timeoutId));
}

// Separate function for transcription
async function handleTranscription(audioUrl: string): Promise<string> {
  const response = await fetch(audioUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch audio: ${response.statusText}`);
  }
  const audioBlob = await response.blob();
  const file = new File([audioBlob], 'audio.webm', { type: 'audio/webm' });
  return await transcribeAudio(file);
}

// Separate function for slide generation
async function generateSlides(transcript: string) {
  const completion = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content: `You are a professional presentation creator. Create a presentation with 6 slides based on the provided transcript.
        Return ONLY a valid JSON object with this exact structure, and nothing else:
        {
          "slides": [
            {
              "title": "string",
              "content": "• Bullet point 1\\n• Bullet point 2\\n• Bullet point 3"
            }
          ]
        }
        Requirements:
        1. The JSON must be properly escaped
        2. There must be exactly 6 slides
        3. Each slide must have a title and content
        4. Content must be formatted as bullet points with • character
        5. Points must be separated by \\n
        6. No special characters that would break JSON parsing`
      },
      {
        role: "user",
        content: `Create slides from this transcript: ${transcript}`
      }
    ],
    temperature: 0.7,
    max_tokens: 2000
  });

  if (!completion.choices[0]?.message?.content) {
    throw new Error('No content received from GPT-4');
  }

  const cleanedContent = completion.choices[0].message.content
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
    .trim();
  
  return JSON.parse(cleanedContent);
}

// Separate function for image generation
async function generateImage(slide: Slide, index: number) {
  try {
    const imageResponse = await openai.images.generate({
      model: "dall-e-3",
      prompt: `Create a professional presentation slide image for: ${slide.title}. The image should be simple, clean, and relevant to the topic.`,
      n: 1,
      size: "1024x1024",
    });
    
    return {
      ...slide,
      imageUrl: imageResponse.data[0].url
    };
  } catch (error) {
    console.error(`Error generating image for slide ${index + 1}:`, error);
    return {
      ...slide,
      imageUrl: null
    };
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const audioUrl = formData.get('audioUrl') as string;
    
    if (!audioUrl) {
      return NextResponse.json(
        { error: 'No audio URL provided', success: false },
        { status: 400 }
      );
    }

    // Step 1: Transcribe with timeout
    let transcript: string;
    try {
      transcript = await timeoutPromise(
        handleTranscription(audioUrl),
        15000, // 15 second timeout
        'Transcription'
      );
    } catch (error) {
      return NextResponse.json(
        { 
          error: error instanceof Error ? error.message : 'Transcription failed',
          success: false 
        },
        { status: 500 }
      );
    }

    // Step 2: Generate slides with timeout
    let slidesContent;
    try {
      slidesContent = await timeoutPromise(
        generateSlides(transcript),
        25000, // 25 second timeout
        'Slide generation'
      );

      if (!slidesContent?.slides || !Array.isArray(slidesContent.slides)) {
        throw new Error('Invalid response structure: missing slides array');
      }
      
      if (slidesContent.slides.length !== 6) {
        throw new Error(`Expected 6 slides, got ${slidesContent.slides.length}`);
      }
    } catch (error) {
      return NextResponse.json(
        { 
          error: error instanceof Error ? error.message : 'Failed to generate slides',
          success: false 
        },
        { status: 500 }
      );
    }

    // Step 3: Generate images with individual timeouts
    try {
      // Process images in batches of 2 to avoid timeout
      const slidesWithImages = [];
      for (let i = 0; i < slidesContent.slides.length; i += 2) {
        const batch = slidesContent.slides.slice(i, i + 2);
        const batchResults = await Promise.all(
          batch.map((slide: Slide, batchIndex: number) => 
            timeoutPromise(
              generateImage(slide, i + batchIndex),
              15000, // 15 second timeout per image
              `Image generation for slide ${i + batchIndex + 1}`
            )
          )
        );
        slidesWithImages.push(...batchResults);
      }

      return NextResponse.json({
        success: true,
        data: {
          slides: slidesWithImages,
          transcript
        }
      });
    } catch (error) {
      // If image generation fails, return slides without images
      return NextResponse.json({
        success: true,
        data: {
          slides: slidesContent.slides.map((slide: Slide) => ({ ...slide, imageUrl: null })),
          transcript
        }
      });
    }
  } catch (error) {
    console.error('Unhandled error in generate-slides API:', error);
    return NextResponse.json(
      { error: 'Internal server error', success: false },
      { status: 500 }
    );
  }
} 