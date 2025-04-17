import { NextRequest, NextResponse } from "next/server";
import OpenAI from 'openai';
import { transcribeAudio } from '@/utils/transcribeAudio';

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

    // Step 1: Transcribe audio with timeout
    let transcript: string;
    try {
      const transcriptionPromise = async () => {
        if (audioFile) {
          return await transcribeAudio(audioFile);
        } else if (audioUrl) {
          const controller = new AbortController();
          const response = await fetch(audioUrl, { signal: controller.signal });
          if (!response.ok) {
            throw new Error(`Failed to fetch audio: ${response.statusText}`);
          }
          const audioBlob = await response.blob();
          const file = new File([audioBlob], 'audio.webm', { type: 'audio/webm' });
          return await transcribeAudio(file);
        }
        throw new Error('No valid audio source provided');
      };

      transcript = await timeoutPromise(
        transcriptionPromise(),
        TRANSCRIPTION_TIMEOUT,
        'Transcription'
      );
    } catch (error) {
      console.error('Error in transcription:', error);
      return NextResponse.json(
        { 
          error: error instanceof Error ? error.message : 'Failed to transcribe audio',
          success: false 
        },
        { status: 500 }
      );
    }

    // Step 2: Generate slides with timeout
    let slidesContent;
    try {
      const slideGenerationPromise = async () => {
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
      };

      slidesContent = await timeoutPromise(
        slideGenerationPromise(),
        SLIDE_GENERATION_TIMEOUT,
        'Slide generation'
      );

      // Validate slides structure
      if (!slidesContent?.slides || !Array.isArray(slidesContent.slides)) {
        throw new Error('Invalid response structure: missing slides array');
      }
      
      if (slidesContent.slides.length !== 6) {
        throw new Error(`Expected 6 slides, got ${slidesContent.slides.length}`);
      }
      
      slidesContent.slides.forEach((slide: any, index: number) => {
        if (!slide?.title || typeof slide.title !== 'string') {
          throw new Error(`Invalid or missing title in slide ${index + 1}`);
        }
        if (!slide?.content || typeof slide.content !== 'string') {
          throw new Error(`Invalid or missing content in slide ${index + 1}`);
        }
      });
    } catch (error) {
      console.error('Error generating slides:', error);
      return NextResponse.json(
        { 
          error: error instanceof Error ? error.message : 'Failed to generate slides',
          success: false 
        },
        { status: 500 }
      );
    }

    // Step 3: Generate images for slides with individual timeouts
    try {
      const generateImageWithTimeout = async (slide: Slide, index: number) => {
        try {
          const imagePromise = openai.images.generate({
            model: "dall-e-3",
            prompt: `Create a professional presentation slide image for: ${slide.title}. The image should be simple, clean, and relevant to the topic.`,
            n: 1,
            size: "1024x1024",
          });

          const imageResponse = await timeoutPromise(
            imagePromise,
            IMAGE_GENERATION_TIMEOUT,
            `Image generation for slide ${index + 1}`
          );
          
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
      };

      // Process images in parallel with a concurrency limit of 2
      const slidesWithImages = [];
      for (let i = 0; i < slidesContent.slides.length; i += 2) {
        const batch = slidesContent.slides.slice(i, i + 2);
        const batchResults = await Promise.all(
          batch.map((slide: Slide, batchIndex: number) => 
            generateImageWithTimeout(slide, i + batchIndex)
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
      console.error('Error processing slides with images:', error);
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