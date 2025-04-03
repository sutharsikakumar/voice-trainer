import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Readable } from 'stream';
import fs from 'fs';
import path from 'path';
import os from 'os';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(request: Request) {
  try {
    const { fileName } = await request.json();
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data, error } = await supabase.storage
      .from('audio-recordings')
      .download(fileName);

    if (error || !data) {
      return NextResponse.json(
        { error: 'Audio file not found' },
        { status: 404 }
      );
    }

    const tempFilePath = path.join(os.tmpdir(), fileName);
  
    const buffer = Buffer.from(await data.arrayBuffer());
    fs.writeFileSync(tempFilePath, buffer);
    
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempFilePath),
      model: 'whisper-1',
      response_format: 'text',
    });
    
    fs.unlinkSync(tempFilePath);

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