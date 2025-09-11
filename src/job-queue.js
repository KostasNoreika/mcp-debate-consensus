/**
 * Simple in-memory job queue for asynchronous debate processing
 */

class JobQueue {
    constructor() {
        this.jobs = new Map();
        this.jobCounter = 0;
    }

    /**
     * Create a new job and start processing it in background
     */
    async createJob(question, projectPath, debate) {
        const jobId = `debate_${Date.now()}_${++this.jobCounter}`;
        
        const job = {
            id: jobId,
            question,
            projectPath,
            status: 'pending',
            createdAt: Date.now(),
            startedAt: null,
            completedAt: null,
            result: null,
            error: null
        };
        
        this.jobs.set(jobId, job);
        
        // Start processing in background without awaiting
        this.processJob(jobId, debate).catch(error => {
            console.error(`Job ${jobId} failed:`, error.message);
            const failedJob = this.jobs.get(jobId);
            if (failedJob) {
                failedJob.status = 'failed';
                failedJob.error = error.message;
                failedJob.completedAt = Date.now();
            }
        });
        
        return jobId;
    }

    /**
     * Process a job in background
     */
    async processJob(jobId, debate) {
        const job = this.jobs.get(jobId);
        if (!job) return;
        
        job.status = 'running';
        job.startedAt = Date.now();
        
        try {
            console.error(`Starting background debate for job ${jobId}: ${job.question}`);
            
            const result = await debate.runDebate(job.question, job.projectPath);
            
            job.status = 'completed';
            job.completedAt = Date.now();
            job.result = result;
            
            console.error(`Completed debate for job ${jobId}`);
            
        } catch (error) {
            job.status = 'failed';
            job.error = error.message;
            job.completedAt = Date.now();
            
            console.error(`Failed debate for job ${jobId}:`, error.message);
        }
    }

    /**
     * Get job status
     */
    getJob(jobId) {
        return this.jobs.get(jobId);
    }

    /**
     * Get all jobs
     */
    getAllJobs(limit = 10) {
        const allJobs = Array.from(this.jobs.values());
        return allJobs
            .sort((a, b) => b.createdAt - a.createdAt)
            .slice(0, limit);
    }

    /**
     * Clean up old completed/failed jobs
     */
    cleanup(maxAge = 24 * 60 * 60 * 1000) { // 24 hours default
        const cutoff = Date.now() - maxAge;
        
        for (const [jobId, job] of this.jobs.entries()) {
            if ((job.status === 'completed' || job.status === 'failed') && 
                job.completedAt && job.completedAt < cutoff) {
                this.jobs.delete(jobId);
            }
        }
    }

    /**
     * Get formatted job status
     */
    formatJobStatus(job) {
        const duration = job.completedAt 
            ? `${Math.round((job.completedAt - job.createdAt) / 1000)}s`
            : job.startedAt 
                ? `${Math.round((Date.now() - job.startedAt) / 1000)}s (running)`
                : 'pending';

        let statusIcon;
        switch (job.status) {
            case 'pending': statusIcon = '⏳'; break;
            case 'running': statusIcon = '🔄'; break;
            case 'completed': statusIcon = '✅'; break;
            case 'failed': statusIcon = '❌'; break;
            default: statusIcon = '❓';
        }

        return {
            id: job.id,
            status: `${statusIcon} ${job.status}`,
            question: job.question,
            duration,
            result: job.result,
            error: job.error
        };
    }
}

module.exports = { JobQueue };