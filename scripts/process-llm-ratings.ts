#!/usr/bin/env node

/**
 * scripts/process-llm-ratings.ts
 * 
 * Background job processor for LLM-based hotel rating calculations
 * Run periodically (e.g., via cron): npx ts-node scripts/process-llm-ratings.ts
 * 
 * This script:
 * 1. Fetches pending 'llm-hotel-rating' jobs from the queue
 * 2. Processes each job using the LLM processor
 * 3. Updates job status in the database
 */

import { query } from '../lib/db';
import { updateJobStatus } from '../lib/queue';
import { processLLMHotelRating } from '../lib/processors/llm-hotel-rating';

async function main() {
  console.log('[LLM Processor] Starting job processor...');

  try {
    // Fetch pending LLM rating jobs from database
    const result = await query(
      `SELECT job_id, data FROM job_queue 
       WHERE job_type = 'llm-hotel-rating' AND status = 'pending'
       LIMIT 5`,
      []
    );

    const jobs = result.rows;

    if (jobs.length === 0) {
      console.log('[LLM Processor] No pending LLM rating jobs found');
      return;
    }

    console.log(`[LLM Processor] Found ${jobs.length} pending jobs`);

    // Process each job
    for (const job of jobs) {
      const jobId = job.job_id;
      const jobData = job.data;

      try {
        console.log(`[LLM Processor] Processing job ${jobId} for hotel ${jobData.hotelId}`);

        // Update job status to processing
        await updateJobStatus(jobId, 'processing');

        // Process the LLM rating
        const result = await processLLMHotelRating(jobData.hotelId);

        if (result.success) {
          console.log(`[LLM Processor] ✓ Job ${jobId} completed successfully`);
          console.log(
            `[LLM Processor] Hotel ${jobData.hotelId} LLM Rating: ${result.llm_rating}`
          );
          console.log(`[LLM Processor] Reasoning: ${result.reasoning}`);

          // Update job status to completed
          await updateJobStatus(jobId, 'completed');
        } else {
          console.error(`[LLM Processor] ✗ Job ${jobId} failed: ${result.error}`);
          await updateJobStatus(jobId, 'failed', result.error);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[LLM Processor] ✗ Job ${jobId} encountered error: ${errorMessage}`);
        await updateJobStatus(jobId, 'failed', errorMessage);
      }
    }

    console.log('[LLM Processor] Job processing complete');
  } catch (error) {
    console.error('[LLM Processor] Fatal error:', error);
    process.exit(1);
  }
}

main();
