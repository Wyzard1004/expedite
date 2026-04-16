import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { updateJobStatus } from '@/lib/queue';
import { processLLMHotelRating } from '@/lib/processors/llm-hotel-rating';

/**
 * POST /api/admin/llm-ratings/process-now
 * 
 * Synchronously process pending LLM rating jobs immediately
 * This is useful for testing or triggering calculations after reviews are submitted
 * 
 * Query params:
 *   - max_jobs: maximum number of jobs to process (default: 10)
 *   - hotel_id: process only this specific hotel
 *   - secret: optional cron secret verification
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
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

    const hotelIdParam = request.nextUrl.searchParams.get('hotel_id');
    const maxJobs = parseInt(request.nextUrl.searchParams.get('max_jobs') || '10', 10);

    let jobQuery = `
      SELECT job_id, data FROM job_queue 
      WHERE job_type = 'llm-hotel-rating' AND status = 'pending'
    `;
    const queryParams: any[] = [];

    if (hotelIdParam) {
      // Process only jobs for specific hotel
      jobQuery += ` AND data->>'hotelId' = $1`;
      queryParams.push(hotelIdParam);
    }

    jobQuery += ` ORDER BY created_at ASC LIMIT $${queryParams.length + 1}`;
    queryParams.push(maxJobs);

    const jobsResult = await query(jobQuery, queryParams);
    const jobs = jobsResult.rows;

    if (jobs.length === 0) {
      return NextResponse.json(
        {
          success: true,
          message: 'No pending LLM rating jobs',
          processed: 0,
        },
        { status: 200 }
      );
    }

    console.log(`[LLM Admin] Processing ${jobs.length} pending LLM rating jobs (synchronous)`);

    const results = {
      succeeded: 0,
      failed: 0,
      details: [] as Array<{
        jobId: string;
        hotelId: number;
        status: 'success' | 'error';
        rating?: number;
        message: string;
      }>,
    };

    // Process each job sequentially (synchronously)
    for (const job of jobs) {
      const jobId = job.job_id;
      const jobData = job.data;
      const hotelId = jobData.hotelId;

      try {
        console.log(`[LLM Admin] Processing job ${jobId} for hotel ${hotelId}...`);

        // Update job status to processing
        await updateJobStatus(jobId, 'processing');

        // Process the LLM rating
        const result = await processLLMHotelRating(hotelId);

        if (result.success) {
          results.succeeded++;
          results.details.push({
            jobId,
            hotelId,
            status: 'success',
            rating: result.llm_rating,
            message: `${result.llm_rating}/5 - ${result.reasoning}`,
          });

          // Update job status to completed
          await updateJobStatus(jobId, 'completed');
          console.log(`[LLM Admin] ✓ Job ${jobId} completed: ${result.llm_rating}/5`);
        } else {
          results.failed++;
          results.details.push({
            jobId,
            hotelId,
            status: 'error',
            message: result.error || 'Unknown error',
          });

          // Update job status to failed
          await updateJobStatus(jobId, 'failed', result.error);
          console.error(`[LLM Admin] ✗ Job ${jobId} failed: ${result.error}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.failed++;
        results.details.push({
          jobId,
          hotelId,
          status: 'error',
          message: errorMessage,
        });

        try {
          await updateJobStatus(jobId, 'failed', errorMessage);
        } catch (updateError) {
          console.error(`[LLM Admin] Failed to update job status for ${jobId}:`, updateError);
        }

        console.error(`[LLM Admin] ✗ Job ${jobId} error: ${errorMessage}`);
      }
    }

    console.log(
      `[LLM Admin] Processing complete: ${results.succeeded} succeeded, ${results.failed} failed`
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
    console.error('[LLM Admin] Error:', errorMessage);

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
