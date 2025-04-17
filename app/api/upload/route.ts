import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;
    
    if (!audioFile) {
      return NextResponse.json(
        { error: 'No audio file provided', success: false },
        { status: 400 }
      );
    }

    const fileName = `recording-${Date.now()}.wav`;
    
    const { data, error } = await supabase.storage
      .from('audio-recordings')
      .upload(`public/${fileName}`, audioFile, {
        cacheControl: '3600',
        contentType: 'audio/wav',
        upsert: false
      });

    if (error) {
      console.error('Error uploading to Supabase:', error);
      return NextResponse.json(
        { error: error.message, success: false },
        { status: 500 }
      );
    }

    const { data: { publicUrl } } = supabase.storage
      .from('audio-recordings')
      .getPublicUrl(`public/${fileName}`);

    const { error: dbError } = await supabase
      .from('audio_recordings')
      .insert({
        file_path: data.path,
        public_url: publicUrl,
        file_name: fileName,
        created_at: new Date().toISOString()
      });

    if (dbError) {
      console.error('Error saving to database:', dbError);
    }

    return NextResponse.json({ 
      success: true,
      data: {
        path: data.path,
        publicUrl
      }
    });
  } catch (error) {
    console.error('Error in upload API:', error);
    return NextResponse.json(
      { error: 'Failed to upload audio', success: false },
      { status: 500 }
    );
  }
}