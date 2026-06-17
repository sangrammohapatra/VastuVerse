/**
 * AI monitoring — current provider config + BullMQ queue depth + recent jobs.
 *
 *   GET /admin/ai-monitoring
 *     → {
 *         providers: { plan, image, roomSuggestions },
 *         queue:     { waiting, active, completed, failed, delayed, paused },
 *         concurrency: int,
 *         jobsByType: [{ name, count }],
 *         lastFailed: [{ id, name, failedReason, finishedAt }]
 *       }
 */

const { queue } = require('../../queues/aiGenerationQueue');

exports.getMonitoring = async (req, res, next) => {
  try {
    const [counts, failedJobs] = await Promise.all([
      queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed', 'paused').catch(() => ({})),
      queue.getJobs(['failed'], 0, 9, false).catch(() => []),
    ]);

    // Sample running + waiting jobs to compute by-type breakdown
    const sample = await Promise.all([
      queue.getJobs(['waiting'], 0, 49, true).catch(() => []),
      queue.getJobs(['active'],  0, 49, true).catch(() => []),
    ]);
    const allSample = [...sample[0], ...sample[1]];
    const byTypeMap = allSample.reduce((acc, j) => {
      acc[j.name] = (acc[j.name] || 0) + 1; return acc;
    }, {});

    res.json({
      providers: {
        plan:           process.env.AI_PLAN_PROVIDER  || 'ollama',
        image:          process.env.AI_IMAGE_PROVIDER || 'pollinations',
        ollamaUrl:      process.env.OLLAMA_URL        || 'http://localhost:11434',
        openaiPlanModel:  process.env.OPENAI_PLAN_MODEL  || null,
        openaiImageModel: process.env.OPENAI_IMAGE_MODEL || null,
      },
      queue: {
        waiting:   counts.waiting   || 0,
        active:    counts.active    || 0,
        completed: counts.completed || 0,
        failed:    counts.failed    || 0,
        delayed:   counts.delayed   || 0,
        paused:    counts.paused    || 0,
      },
      concurrency: Number(process.env.AI_WORKER_CONCURRENCY) || 2,
      jobsByType: Object.entries(byTypeMap).map(([name, count]) => ({ name, count })),
      lastFailed: failedJobs.map((j) => ({
        id: j.id, name: j.name,
        failedReason: j.failedReason?.slice(0, 240),
        finishedAt: j.finishedOn ? new Date(j.finishedOn).toISOString() : null,
        attemptsMade: j.attemptsMade,
      })),
      timestamp: new Date().toISOString(),
    });
  } catch (e) { next(e); }
};
