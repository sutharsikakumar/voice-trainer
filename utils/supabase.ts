import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function uploadAudioToStorage(audioBlob: Blob, fileName: string = `recording-${Date.now()}.wav`) {
  try {
    const file = new File([audioBlob], fileName, { type: 'audio/wav' });
    
    const { data, error } = await supabase.storage
      .from('audio-recordings')
      .upload(`public/${fileName}`, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('Error uploading audio:', error);
      return { success: false, error };
    }

    const { data: { publicUrl } } = supabase.storage
      .from('audio-recordings')
      .getPublicUrl(`public/${fileName}`);

    return { 
      success: true, 
      data: {
        path: data.path,
        publicUrl
      }
    };
  } catch (error) {
    console.error('Error in uploadAudioToStorage:', error);
    return { success: false, error };
  }
}