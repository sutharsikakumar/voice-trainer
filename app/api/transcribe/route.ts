import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Readable } from 'stream';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(request: Request) {
  try {
    const { fileName } = await request.json();
    
    // Initialize Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Download audio file from Supabase storage
    const { data, error } = await supabase.storage
      .from('audio-recordings')
      .download(fileName);

    if (error || !data) {
      return NextResponse.json(
        { error: 'Audio file not found' },
        { status: 404 }
      );
    }

    // Convert Blob to Readable stream
    const buffer = Buffer.from(await data.arrayBuffer());
    const readable = new Readable();
    readable.push(buffer);
    readable.push(null);

    // Transcribe with Whisper API
    const transcription = await openai.audio.transcriptions.create({
      file: new File([buffer], fileName, { type: 'audio/mpeg' }),
      model: 'whisper-1',
      response_format: 'text',
    });

    return NextResponse.json({ 
      text: transcription
    });

  } catch (error: any) {
    console.error('Transcription error:', error);
    return NextResponse.json(
      { error: error.message || 'Transcription failed' },
      { status: 500 }
    );
  }
}