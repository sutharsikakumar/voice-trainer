// pages/api/transcribe.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import formidable from 'formidable';
import fs from 'fs';
import FormData from 'form-data';
import fetch from 'node-fetch';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { fileName } = req.body;
    
    // For debugging
    console.log("Received request to transcribe:", fileName);
    
    // Initialize Supabase client with server-side env variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: "Supabase configuration is incomplete" });
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the audio file URL from Supabase storage
    const { data: fileData, error: fileError } = await supabase
      .storage
      .from('audio-recordings')
      .createSignedUrl(fileName, 60);

    if (fileError || !fileData) {
      console.error("Error getting signed URL:", fileError);
      return res.status(500).json({ error: "Could not access the audio file" });
    }

    console.log("Got signed URL:", fileData.signedUrl);

    // Get OpenAI API key
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({ error: "OpenAI API key is missing" });
    }

    // Fetch the audio file
    const audioResponse = await fetch(fileData.signedUrl);
    if (!audioResponse.ok) {
      return res.status(500).json({ error: `Failed to fetch audio file: ${audioResponse.statusText}` });
    }

    const audioBuffer = await audioResponse.buffer();

    // Use form-data library (works better in Node.js)
    const formData = new FormData();
    formData.append('file', audioBuffer, {
      filename: fileName,
      contentType: 'audio/mpeg', // Adjust based on your audio format
    });
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'json');

    // Call Whisper API
    const whisperResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        ...formData.getHeaders() // Important for multipart form data
      },
      body: formData,
    });

    // Debug response status
    console.log("Whisper API response status:", whisperResponse.status);

    if (!whisperResponse.ok) {
      const errorText = await whisperResponse.text();
      console.error("Whisper API error:", errorText); 
      return res.status(whisperResponse.status).json({ 
        error: `Whisper API error: ${whisperResponse.status}`,
        details: errorText
      });
    }

    const result = await whisperResponse.json();
    return res.status(200).json({ text: result.text });
  } catch (error) {
    console.error("Server error processing transcription:", error);
    return res.status(500).json({ error: String(error) });
  }
}