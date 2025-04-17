import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Supabase URL or Service Key is missing');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:3000';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { filePath, tongueTwister } = body;

    if (!filePath) {
      return NextResponse.json({ success: false, error: 'File path is required' }, { status: 400 });
    }

    const fileKey = filePath.startsWith('/') ? filePath.substring(1) : filePath;
    const tempFilePath = path.join(os.tmpdir(), `temp-${Date.now()}.wav`);
    const { data, error } = await supabase.storage
      .from('audio-recordings')
      .download(fileKey);

    if (error) {
      console.error('Error downloading file from Supabase:', error);
      return NextResponse.json({ success: false, error: 'Failed to download file' }, { status: 500 });
    }

    const buffer = await data.arrayBuffer();
    fs.writeFileSync(tempFilePath, Buffer.from(buffer));
    const analysisResponse = await axios.post(`${PYTHON_SERVICE_URL}/analyze`, {
      file_path: tempFilePath,
      tongue_twister: tongueTwister,
    });

    fs.unlinkSync(tempFilePath);
    const analysisData = {
      success: true,
      data: {
        analysis: {
          duration: analysisResponse.data.duration || 0,
          tempo: analysisResponse.data.tempo || 0,
          pitch_mean: analysisResponse.data.pitch_mean || 0,
          pitch_std: analysisResponse.data.pitch_std || 0,
          speech_rate: analysisResponse.data.speech_rate || 0,
          rms_energy: analysisResponse.data.rms_energy || 0,
          spectral_centroid: analysisResponse.data.spectral_centroid || 0,
          spectral_bandwidth: analysisResponse.data.spectral_bandwidth || 0,
        },
        feedback: analysisResponse.data.feedback || 'No feedback provided',
      },
    };

    return NextResponse.json(analysisData);
  } catch (error) {
    console.error('Error in analysis API route:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return NextResponse.json({ success: false, error: 'Method not allowed' }, { status: 405 });
}