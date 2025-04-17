import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function transcribeAudio(audioFile: File): Promise<string> {
  try {
    console.log('Starting transcription for file:', {
      name: audioFile.name,
      type: audioFile.type,
      size: audioFile.size
    });

    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
    });

    console.log('Transcription completed successfully');
    return transcription.text;
  } catch (error) {
    console.error('Error in transcription:', error);
    throw error;
  }
} 