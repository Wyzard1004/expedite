import { NextRequest, NextResponse } from 'next/server';
import { getPendingJobs, getJobStatus } from '@/lib/queue';

export async function GET(request: NextRequest) {
  try {
    const pendingJobs = await getPendingJobs();

    return NextResponse.json(
      {
        status: 'ok',
        summary: {
          pending: pendingJobs.length,
          total: pendingJobs.length,
        },
        recentJobs: pendingJobs.slice(0, 20).map((job) => ({
          id: job.id,
          type: job.type,
          status: job.status,
          createdAt: job.createdAt,
          startedAt: job.startedAt,
          completedAt: job.completedAt,
          error: job.error,
        })),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API] Queue stats error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve queue stats' },
      { status: 500 }
    );
  }
}
