import { NextRequest, NextResponse } from "next/server";
import OpenAI from 'openai';
import { transcribeAudio } from '@/utils/transcribeAudio';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface Slide {
  title: string;
  content: string;
  imageUrl?: string;
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

    // Transcribe audio
    let transcript: string;
    try {
      if (audioFile) {
        transcript = await transcribeAudio(audioFile);
      } else if (audioUrl) {
        const response = await fetch(audioUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch audio: ${response.statusText}`);
        }
        const audioBlob = await response.blob();
        const file = new File([audioBlob], 'audio.webm', { type: 'audio/webm' });
        transcript = await transcribeAudio(file);
      } else {
        throw new Error('No valid audio source provided');
      }
    } catch (error) {
      console.error('Error in transcription:', error);
      return NextResponse.json(
        { error: 'Failed to transcribe audio', success: false },
        { status: 500 }
      );
    }

    // Generate slides
    let slidesContent;
    try {
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

      // Clean and parse the response
      const cleanedContent = completion.choices[0].message.content
        .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
        .trim();
      
      try {
        slidesContent = JSON.parse(cleanedContent);
      } catch (parseError) {
        console.error('Raw GPT response:', cleanedContent);
        throw new Error('Failed to parse GPT-4 response as JSON');
      }
      
      // Validate response structure
      if (!slidesContent?.slides || !Array.isArray(slidesContent.slides)) {
        throw new Error('Invalid response structure: missing slides array');
      }
      
      if (slidesContent.slides.length !== 6) {
        throw new Error(`Expected 6 slides, got ${slidesContent.slides.length}`);
      }
      
      // Validate each slide
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
        { error: error instanceof Error ? error.message : 'Failed to generate slides', success: false },
        { status: 500 }
      );
    }

    // Generate images for slides
    try {
      const slidesWithImages = await Promise.all(
        slidesContent.slides.map(async (slide: Slide, index: number) => {
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
        })
      );

      return NextResponse.json({
        success: true,
        data: {
          slides: slidesWithImages,
          transcript
        }
      });
    } catch (error) {
      console.error('Error processing slides with images:', error);
      return NextResponse.json(
        { error: 'Failed to generate slide images', success: false },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Unhandled error in generate-slides API:', error);
    return NextResponse.json(
      { error: 'Internal server error', success: false },
      { status: 500 }
    );
  }
} 