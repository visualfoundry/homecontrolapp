import { NextResponse } from 'next/server';
import { diagnoseUnifi } from '@/lib/unifi-client';

export const dynamic = 'force-dynamic';

export async function GET() {
  const result = await diagnoseUnifi();
  return NextResponse.json(result, { status: 200 });
}
