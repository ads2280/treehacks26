import { NextRequest, NextResponse } from 'next/server';
import { getClips } from '@/lib/suno';

export async function GET(req: NextRequest) {
  try {
    const ids = req.nextUrl.searchParams.get('ids');
    if (!ids) {
      return NextResponse.json({ error: 'ids parameter required' }, { status: 400 });
    }

    const idList = ids.split(',').filter(Boolean);
    if (idList.length === 0) {
      return NextResponse.json({ error: 'At least one clip ID required' }, { status: 400 });
    }

    // Guard against polling too many IDs at once (API limit is 100 clips/min)
    if (idList.length > 20) {
      return NextResponse.json(
        { error: 'Too many clip IDs (max 20 per request)' },
        { status: 400 }
      );
    }

    const result = await getClips(idList);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Clips fetch failed';
    const status = message.includes('(429)') ? 429 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
