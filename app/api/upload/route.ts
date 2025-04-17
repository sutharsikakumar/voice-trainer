import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

console.log("Supabase URL configured:", process.env.NEXT_PUBLIC_SUPABASE_URL ? "Yes" : "No");
console.log("Supabase Service Key configured:", process.env.SUPABASE_SERVICE_KEY ? "Yes" : "No");

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  throw new Error("Missing required Supabase environment variables");
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export async function POST(request: NextRequest) {
  try {
    console.log("Received upload request");
    const formData = await request.formData();
    const file = formData.get('audio') as File;

    if (!file) {
      console.log("No file found in form data");
      return NextResponse.json(
        { success: false, error: "No audio file provided" },
        { status: 400 }
      );
    }

    console.log("File received:", {
      name: file.name,
      type: file.type,
      size: file.size
    });

    if (!file.type.startsWith('audio/')) {
      console.log("Invalid file type:", file.type);
      return NextResponse.json(
        { success: false, error: "Invalid file type. Please upload an audio file." },
        { status: 400 }
      );
    }

    const uniqueFileName = `recording-${Date.now()}-${Math.random().toString(36).substring(2, 9)}.webm`;
    console.log("Attempting to upload to:", uniqueFileName);
    
    const { data, error } = await supabase.storage
      .from('audio-recordings')
      .upload(uniqueFileName, file, {
        contentType: file.type,
        upsert: false,
      });

    if (error) {
      console.error("Supabase upload error details:", {
        message: error.message,
        name: error.name
      });
      return NextResponse.json(
        { success: false, error: `Upload failed: ${error.message}` },
        { status: 500 }
      );
    }

    if (!data) {
      console.error("No data returned from upload");
      return NextResponse.json(
        { success: false, error: "Upload failed: No data returned" },
        { status: 500 }
      );
    }

    console.log("File uploaded successfully. Path:", data.path);

    const { data: { publicUrl } } = supabase.storage
      .from('audio-recordings')
      .getPublicUrl(data.path);

    console.log("Generated public URL:", publicUrl);

    const { data: verifyData, error: verifyError } = await supabase.storage
      .from('audio-recordings')
      .list('', {
        limit: 1,
        search: uniqueFileName
      });

    if (verifyError) {
      console.error("Error verifying file:", verifyError);
    } else {
      console.log("File verification result:", verifyData);
    }

    return NextResponse.json({
      success: true,
      data: {
        filePath: data.path,
        publicUrl: publicUrl
      }
    });
  } catch (error) {
    console.error("Unexpected error during upload:", error);
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred during upload" },
      { status: 500 }
    );
  }
}