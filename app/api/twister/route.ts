import { NextResponse } from 'next/server';
import { generateTongueTwister } from '@/utils/openai';

export async function GET() {
  try {
    const tongueTwister = await generateTongueTwister();
    
    return NextResponse.json({ 
      twister: tongueTwister,
      success: true 
    });
  } catch (error) {
    console.error('Error in twister API:', error);
    return NextResponse.json(
      { error: 'Failed to generate tongue twister', success: false },
      { status: 500 }
    );
  }
}