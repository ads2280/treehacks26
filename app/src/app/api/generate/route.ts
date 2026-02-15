import { NextRequest, NextResponse } from 'next/server';
import { generateTrack } from '@/lib/suno';
import { SunoGenerateRequest } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const body: SunoGenerateRequest = await req.json();

    // Validate required fields
    if (!body.topic && !body.tags && !body.prompt) {
      return NextResponse.json(
        { error: 'At least one of topic, tags, or prompt is required' },
        { status: 400 }
      );
    }

    const result = await generateTrack(body);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Generation failed';
    // Preserve rate limit status code if present
    const status = message.includes('(429)') ? 429 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
