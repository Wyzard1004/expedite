import { query } from './db';

// Job types
export interface CategorySummarizeJobData {
  hotelId: number;
  categoryId: number;
  categoryName: string;
  reviewTexts: string[];
}

export interface EmbeddingJobData {
  reviewIds: number[];
}

export type JobType = 'category-summarize' | 'embedding-batch';
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

interface QueuedJob {
  id: string;
  type: JobType;
  data: any;
  status: JobStatus;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

// In-memory job store (for development)
// In production, use the database as job storage
const jobs = new Map<string, QueuedJob>();

/**
 * Generate a unique job ID
 */
function generateJobId(): string {
  return `job_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Queue a category summarization job
 */
export async function queueCategorySummarization(
  hotelId: number,
  categoryId: number,
  categoryName: string,
  reviewTexts: string[]
): Promise<string> {
  const jobId = generateJobId();
  const job: QueuedJob = {
    id: jobId,
    type: 'category-summarize',
    data: { hotelId, categoryId, categoryName, reviewTexts },
    status: 'pending',
    createdAt: new Date(),
  };

  jobs.set(jobId, job);

  // Store in database for persistence
  try {
    await query(
      `INSERT INTO job_queue (job_id, job_type, data, status)
       VALUES ($1, $2, $3, $4)`,
      [jobId, 'category-summarize', JSON.stringify(job.data), 'pending']
    );
  } catch (error) {
    console.error('[Queue] Failed to persist job to database:', error);
    // Continue anyway - in-memory queue still works
  }

  console.log(`[Queue] Queued category summary: job ${jobId} for hotel ${hotelId}`);
  return jobId;
}

/**
 * Queue a batch of reviews for embedding processing
 */
export async function queueEmbeddingBatch(reviewIds: number[]): Promise<string> {
  const jobId = generateJobId();
  const job: QueuedJob = {
    id: jobId,
    type: 'embedding-batch',
    data: { reviewIds },
    status: 'pending',
    createdAt: new Date(),
  };

  jobs.set(jobId, job);

  // Store in database for persistence
  try {
    await query(
      `INSERT INTO job_queue (job_id, job_type, data, status)
       VALUES ($1, $2, $3, $4)`,
      [jobId, 'embedding-batch', JSON.stringify(job.data), 'pending']
    );
  } catch (error) {
    console.error('[Queue] Failed to persist job to database:', error);
  }

  console.log(`[Queue] Queued embedding batch: job ${jobId} for ${reviewIds.length} reviews`);
  return jobId;
}

/**
 * Get job status
 */
export async function getJobStatus(jobId: string): Promise<QueuedJob | null> {
  return jobs.get(jobId) || null;
}

/**
 * Get all pending jobs
 */
export async function getPendingJobs(): Promise<QueuedJob[]> {
  return Array.from(jobs.values()).filter((job) => job.status === 'pending');
}

/**
 * Update job status
 */
export async function updateJobStatus(
  jobId: string,
  status: JobStatus,
  error?: string
): Promise<void> {
  const job = jobs.get(jobId);
  if (!job) return;

  job.status = status;
  if (status === 'processing' && !job.startedAt) {
    job.startedAt = new Date();
  } else if (status === 'completed' || status === 'failed') {
    job.completedAt = new Date();
  }
  if (error) {
    job.error = error;
  }

  // Update database
  try {
    await query(
      `UPDATE job_queue SET status = $1, error = $2, updated_at = NOW()
       WHERE job_id = $3`,
      [status, error || null, jobId]
    );
  } catch (error) {
    console.error('[Queue] Failed to update job status in database:', error);
  }
}

/**
 * Initialize the job processor
 * In production, this would be a separate worker service
 * For now, we'll process jobs via API routes
 */
export async function initializeJobProcessor(): Promise<void> {
  console.log('[Queue] Job processor initialized');
  // In a real implementation, this would start background workers
  // For now, jobs are processed on-demand via API routes
}
