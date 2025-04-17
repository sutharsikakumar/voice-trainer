import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface Slide {
  title: string;
  content: string;
  imagePrompt?: string;
  imageUrl?: string;
}

export async function generateSlidesFromAudio(audioFile: File): Promise<Slide[]> {
  try {
    const supportedFormats = ['flac', 'm4a', 'mp3', 'mp4', 'mpeg', 'mpga', 'oga', 'ogg', 'wav', 'webm'];
    const fileExtension = audioFile.name.split('.').pop()?.toLowerCase();
    
    if (!fileExtension || !supportedFormats.includes(fileExtension)) {
      throw new Error(`Invalid file format. Supported formats: ${JSON.stringify(supportedFormats)}`);
    }

    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
    });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `You are a professional presentation creator. Create a structured presentation with 3-5 slides based on the provided transcript.
          For each slide, provide:
          1. A clear title
          2. 3-5 bullet points of content
          3. A detailed image prompt for DALL-E that would make a good visual for this slide
          
          Format your response as JSON with this structure:
          {
            "slides": [
              {
                "title": "Slide Title",
                "content": "Bullet point 1\nBullet point 2\nBullet point 3",
                "imagePrompt": "Detailed description for DALL-E"
              }
            ]
          }`
        },
        {
          role: 'user',
          content: `Create a presentation based on this transcript: ${transcription.text}`
        }
      ],
      response_format: { type: "json_object" }
    });

    const slidesData = JSON.parse(completion.choices[0].message.content || '{"slides":[]}').slides;

    const slidesWithImages = await Promise.all(
      slidesData.map(async (slide: Slide) => {
        if (slide.imagePrompt) {
          const imageResponse = await openai.images.generate({
            model: "dall-e-3",
            prompt: slide.imagePrompt,
            n: 1,
            size: "1024x1024",
          });
          slide.imageUrl = imageResponse.data[0].url;
        }
        return slide;
      })
    );

    return slidesWithImages;
  } catch (error) {
    console.error('Error in slide generation:', error);
    throw error;
  }
} 