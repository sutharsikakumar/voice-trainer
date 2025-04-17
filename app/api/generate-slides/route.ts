import { NextRequest, NextResponse } from "next/server";
import OpenAI from 'openai';
import { transcribeAudio } from '@/utils/transcribeAudio';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface Slide {
  title: string;
  content: string[];
  imageDescription: string;
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
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: `You are a professional presentation creator. Create a presentation with 6 slides based on the provided transcript. 
          Each slide should have a title and bullet points. 
          Format your response as a valid JSON object with this exact structure:
          {
            "slides": [
              {
                "title": "Slide Title",
                "content": "Bullet point 1\nBullet point 2\nBullet point 3"
              }
            ]
          }
          Make sure the response is valid JSON and contains exactly 6 slides.`
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

    const slidesContent = JSON.parse(completion.choices[0].message.content);
    
    if (!slidesContent.slides || !Array.isArray(slidesContent.slides)) {
      throw new Error('Invalid slides format received from GPT-4');
    }
    
    const slidesWithImages = await Promise.all(
      slidesContent.slides.map(async (slide: any) => {
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
          console.error('Error generating image:', error);
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
    console.error('Error in generate-slides API:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate slides', success: false },
      { status: 500 }
    );
  }
}

const generateSlides = async (transcript: string) => {
  const completion = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content: `You are a presentation expert. Create 6 slides based on the provided transcript. Each slide should have a title, content in bullet points, and an image description. Format the response as a JSON array of slide objects, each with: title, content, and imageDescription fields.`
      },
      {
        role: "user",
        content: `Create 6 presentation slides from this transcript: ${transcript}`
      }
    ],
    response_format: { type: "json_object" },
    temperature: 0.7,
    max_tokens: 2000
  });

  const responseContent = completion.choices[0].message.content;
  if (!responseContent) {
    throw new Error('No content received from GPT-4');
  }

  const cleanedContent = responseContent
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
    .trim();

  let slidesData;
  try {
    const parsedContent = JSON.parse(cleanedContent);
    if (!parsedContent.slides || !Array.isArray(parsedContent.slides)) {
      throw new Error('Invalid response structure: missing slides array');
    }
    slidesData = parsedContent.slides;
    
    if (slidesData.length !== 6) {
      throw new Error(`Expected 6 slides, got ${slidesData.length}`);
    }
    
    slidesData.forEach((slide: Slide, index: number) => {
      if (!slide.title || typeof slide.content !== 'string' || !slide.imageDescription) {
        throw new Error(`Invalid slide structure at index ${index}`);
      }
    });
  } catch (parseError) {
    console.error('Failed to parse GPT-4 response:', cleanedContent);
    throw new Error('Invalid JSON response from GPT-4: ' + (parseError as Error).message);
  }

  const slidesWithImages = await Promise.all(
    slidesData.map(async (slide: any) => {
      try {
        const imageResponse = await openai.images.generate({
          model: "dall-e-3",
          prompt: slide.imageDescription,
          n: 1,
          size: "1024x1024",
          quality: "standard",
        });

        return {
          ...slide,
          imageUrl: imageResponse.data[0].url
        };
      } catch (imageError) {
        console.error('Error generating image for slide:', slide.title, imageError);
        return {
          ...slide,
          imageUrl: null
        };
      }
    })
  );

  return slidesWithImages;
};

function parsePresentationContent(content: string | null) {
  if (!content) return [];
  
  const slideSections = content.split(/\n\nSlide \d+:/).filter(Boolean);
  
  return slideSections.map(section => {
    const lines = section.split('\n');
    const title = lines[0].replace('Title:', '').trim();
    const content = lines
      .slice(1)
      .filter(line => !line.includes('Image Concept:'))
      .join('\n')
      .trim();
    const imageConcept = lines
      .find(line => line.includes('Image Concept:'))
      ?.replace('Image Concept:', '')
      .trim();

    return {
      title,
      content,
      imageConcept: imageConcept || undefined,
    };
  });
} 