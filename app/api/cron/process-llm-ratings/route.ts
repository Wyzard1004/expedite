import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { updateJobStatus } from '@/lib/queue';
import { processLLMHotelRating } from '@/lib/processors/llm-hotel-rating';

/**
 * GET /api/cron/process-llm-ratings
 * 
 * Cron endpoint to process pending LLM rating jobs
 * Can be triggered by:
 * - Vercel Cron (with CRON_SECRET)
 * - External cron services (curl, etc.)
 * - Manual API calls
 * 
 * Query params:
 *   - max_jobs: maximum number of jobs to process (default: 5)
 *   - secret: cron secret for verification
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Verify cron secret if provided
    const cronSecret = process.env.CRON_SECRET;
    const providedSecret = request.nextUrl.searchParams.get('secret');

    if (cronSecret && providedSecret !== cronSecret) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const maxJobs = parseInt(request.nextUrl.searchParams.get('max_jobs') || '5', 10);

    console.log('[Cron] Starting LLM rating job processor');

    // Fetch pending LLM rating jobs
    const jobsResult = await query(
      `SELECT job_id, data FROM job_queue 
       WHERE job_type = 'llm-hotel-rating' AND status = 'pending'
       LIMIT $1`,
      [maxJobs]
    );

    const jobs = jobsResult.rows;

    if (jobs.length === 0) {
      return NextResponse.json(
        {
          success: true,
          message: 'No pending jobs',
          processed: 0,
        },
        { status: 200 }
      );
    }

    console.log(`[Cron] Processing ${jobs.length} pending LLM rating jobs`);

    const results = {
      succeeded: 0,
      failed: 0,
      details: [] as Array<{
        jobId: string;
        hotelId: number;
        status: 'success' | 'error';
        message: string;
      }>,
    };

    // Process each job
    for (const job of jobs) {
      const jobId = job.job_id;
      const jobData = job.data;

      try {
        // Update job status to processing
        await updateJobStatus(jobId, 'processing');

        // Process the LLM rating
        const result = await processLLMHotelRating(jobData.hotelId);

        if (result.success) {
          results.succeeded++;
          results.details.push({
            jobId,
            hotelId: jobData.hotelId,
            status: 'success',
            message: `LLM Rating: ${result.llm_rating}/5 - ${result.reasoning}`,
          });

          // Update job status to completed
          await updateJobStatus(jobId, 'completed');
        } else {
          results.failed++;
          results.details.push({
            jobId,
            hotelId: jobData.hotelId,
            status: 'error',
            message: result.error || 'Unknown error',
          });

          // Update job status to failed
          await updateJobStatus(jobId, 'failed', result.error);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.failed++;
        results.details.push({
          jobId,
          hotelId: jobData.hotelId,
          status: 'error',
          message: errorMessage,
        });

        try {
          await updateJobStatus(jobId, 'failed', errorMessage);
        } catch (updateError) {
          console.error(`Failed to update job status for ${jobId}:`, updateError);
        }
      }
    }

    console.log(
      `[Cron] Processing complete: ${results.succeeded} succeeded, ${results.failed} failed`
    );

    return NextResponse.json(
      {
        success: true,
        message: 'LLM rating processing complete',
        processed: jobs.length,
        succeeded: results.succeeded,
        failed: results.failed,
        details: results.details,
      },
      { status: 200 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Cron] Fatal error:', errorMessage);

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
