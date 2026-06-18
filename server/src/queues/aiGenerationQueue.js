/**
 * `ai-generation` BullMQ queue.
 *
 * Job data shape:
 *   {
 *     type: 'floor-plan' | 'floor-plan-image' | ...,
 *     planId: string,
 *     userId: string,
 *     userTier: 'FREE' | 'BASIC' | 'PRO' | 'ENTERPRISE',
 *     payload: { roomConfig, landDetails, vastuEnabled, ... }
 *   }
 *
 * Priority:   PRO/ENTERPRISE = 1, BASIC = 5, FREE = 10 (lower → higher prio)
 * Timeout:    120 s
 * Attempts:   3, exponential backoff starting at 2 s
 *
 * On completion / failure the worker emits to Socket.io room `user:{userId}`
 *   `generation:complete` { jobId, type, planId, result }
 *   `generation:failed`   { jobId, type, planId, error }
 *
 * The result is also written to Redis at `ai_job:{jobId}` (TTL 1 h) so the
 * polling-fallback endpoint can return a final answer even if the BullMQ
 * job has already been cleaned up.
 */

const { Queue, Worker, QueueEvents } = require('bullmq');
const Redis = require('ioredis');
const mongoose = require('mongoose');

const AIServiceFactory = require('../services/ai');
const StorageFactory = require('../services/storage');
const { getIO } = require('../config/socket');

const REDIS_URL = process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`;

const QUEUE_NAME = 'ai-generation';
const JOB_TIMEOUT_MS = 120_000;
const RESULT_TTL_SECONDS = 3600;

// BullMQ requires this on every client.
const connection = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
connection.on('error', (err) => console.error('[ai-queue] connection error:', err.message));

const resultStore = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
resultStore.on('error', (err) => console.error('[ai-queue] resultStore error:', err.message));

/* ─── Priority mapping ─────────────────────────────────────────────── */

function priorityForTier(tier) {
  switch (tier) {
    case 'PRO':
    case 'ENTERPRISE':
      return 1;
    case 'BASIC':
      return 5;
    case 'FREE':
    default:
      return 10;
  }
}

/* ─── Queue handle ─────────────────────────────────────────────────── */

const queue = new Queue(QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { age: 3600, count: 1000 },
    removeOnFail: { age: 24 * 3600 },
  },
});

/** Enqueue an AI generation job. Caller is responsible for tier-limit checks. */
async function enqueueGeneration({ type, planId, userId, userTier, payload }) {
  const job = await queue.add(
    type,
    { type, planId, userId, userTier, payload },
    {
      priority: priorityForTier(userTier),
      // BullMQ uses TTL on the active job in `ms`.
      // Sidekick — give a tiny buffer so the queue marks it failed cleanly.
      ttl: JOB_TIMEOUT_MS,
    }
  );
  return job;
}

/* ─── Job processor ────────────────────────────────────────────────── */

async function processor(job) {
  const { type, planId, userId, payload } = job.data || {};

  await job.updateProgress(5);

  let result;
  switch (type) {
    case 'floor-plan': {
      const planService = await AIServiceFactory.getPlanService();
      await job.updateProgress(20);
      const planOut = await planService.generateFloorPlan(payload || {});
      await job.updateProgress(80);

      // Persist the options on the Plan document
      try {
        const Plan = mongoose.models.Plan || require('../models/Plan');
        await Plan.findOneAndUpdate(
          { _id: planId, userId },
          {
            $set: {
              floorPlan: {
                options: planOut.options,
                selectedOptionId: null,
                jobId: job.id,
                generatedAt: new Date(),
              },
            },
          }
        );
      } catch (e) {
        console.warn('[queue] failed to persist floorPlan:', e.message);
      }

      result = {
        type,
        planId,
        feasible: planOut.feasible,
        options: planOut.options,
        ...(planOut.error && { error: planOut.error }),
      };
      break;
    }

    case 'floor-plan-image': {
      const imageService = await AIServiceFactory.getImageService();
      await job.updateProgress(40);
      const img = await imageService.generateImage(payload || {});
      await job.updateProgress(75);
      const floorPlanUrl = await StorageFactory.persistImage(img.imageUrl, `plans/${planId}/floor-plan`);
      await job.updateProgress(90);
      result = { type, planId, ...img, imageUrl: floorPlanUrl };
      break;
    }

    case 'interior-render': {
      const { roomId, prompt, seed } = payload || {};
      if (!roomId || !prompt) throw new Error('interior_render_missing_inputs');
      const imageService = await AIServiceFactory.getImageService();
      await job.updateProgress(30);
      const img = await imageService.generateImage({ prompt, seed });
      await job.updateProgress(65);
      const interiorUrl = await StorageFactory.persistImage(img.imageUrl, `plans/${planId}/interior/${roomId}`);
      await job.updateProgress(80);

      // Persist per-room entry under interior.rooms.{roomId}
      try {
        const Plan = mongoose.models.Plan || require('../models/Plan');
        await Plan.findOneAndUpdate(
          { _id: planId, userId },
          {
            $set: {
              [`interior.rooms.${roomId}`]: {
                imageUrl: interiorUrl,
                jobId: job.id,
                status: 'ready',
                provider: img.provider,
                seed: img.seed,
                generatedAt: new Date(),
              },
            },
          }
        );
      } catch (e) {
        console.warn('[queue] failed to persist interior room:', e.message);
      }

      result = { type, planId, roomId, imageUrl: interiorUrl, provider: img.provider };
      break;
    }

    case 'exterior-render': {
      const { side, prompt, seed } = payload || {};
      if (!side || !prompt) throw new Error('exterior_render_missing_inputs');
      const imageService = await AIServiceFactory.getImageService();
      await job.updateProgress(30);
      const img = await imageService.generateImage({ prompt, seed });
      await job.updateProgress(65);
      const exteriorUrl = await StorageFactory.persistImage(img.imageUrl, `plans/${planId}/exterior/${side}`);
      await job.updateProgress(80);

      try {
        const Plan = mongoose.models.Plan || require('../models/Plan');
        await Plan.findOneAndUpdate(
          { _id: planId, userId },
          {
            $set: {
              [`exterior.sides.${side}`]: {
                imageUrl: exteriorUrl,
                jobId: job.id,
                status: 'ready',
                provider: img.provider,
                seed: img.seed,
                generatedAt: new Date(),
              },
            },
          }
        );
      } catch (e) {
        console.warn('[queue] failed to persist exterior side:', e.message);
      }

      result = { type, planId, side, imageUrl: exteriorUrl, provider: img.provider };
      break;
    }

    case 'utilities': {
      // Deterministic rule engine — quick but routed through the queue so
      // the wizard gets a consistent loading state + counts toward the
      // user's daily quota.
      const planService = await AIServiceFactory.getPlanService();
      await job.updateProgress(20);
      const utilOut = await planService.generateUtilityPlan(payload || {});
      await job.updateProgress(80);

      try {
        const Plan = mongoose.models.Plan || require('../models/Plan');
        await Plan.findOneAndUpdate(
          { _id: planId, userId },
          {
            $set: {
              utilities: {
                ...utilOut,
                jobId: job.id,
                generatedAt: new Date(),
              },
            },
          }
        );
      } catch (e) {
        console.warn('[queue] failed to persist utilities:', e.message);
      }

      result = { type, planId, utilities: utilOut };
      break;
    }

    case 'bird-eye-3d': {
      const { prompt, seed } = payload || {};
      if (!prompt) throw new Error('bird_eye_missing_prompt');
      const imageService = await AIServiceFactory.getImageService();
      await job.updateProgress(30);
      const img = await imageService.generateImage({ prompt, seed });
      await job.updateProgress(65);
      const birdEyeUrl = await StorageFactory.persistImage(img.imageUrl, `plans/${planId}/bird-eye`);
      await job.updateProgress(80);

      try {
        const Plan = mongoose.models.Plan || require('../models/Plan');
        await Plan.findOneAndUpdate(
          { _id: planId, userId },
          {
            $set: {
              birdEyeView: {
                imageUrl: birdEyeUrl,
                provider: img.provider,
                seed: img.seed,
                jobId: job.id,
                generatedAt: new Date(),
              },
            },
          }
        );
      } catch (e) {
        console.warn('[queue] failed to persist birdEyeView:', e.message);
      }

      result = { type, planId, imageUrl: birdEyeUrl, provider: img.provider };
      break;
    }

    default:
      throw new Error(`unknown_job_type: ${type}`);
  }

  await job.updateProgress(100);
  return result;
}

/* ─── Worker (started by startWorker() in index.js) ────────────────── */

let worker = null;

function startWorker() {
  if (worker) return worker;

  worker = new Worker(QUEUE_NAME, processor, {
    connection,
    concurrency: Number(process.env.AI_WORKER_CONCURRENCY) || 2,
    lockDuration: JOB_TIMEOUT_MS,
  });

  worker.on('completed', async (job, result) => {
    try {
      await resultStore.set(
        `ai_job:${job.id}`,
        JSON.stringify({ status: 'completed', result }),
        'EX',
        RESULT_TTL_SECONDS
      );
    } catch (e) { /* non-fatal */ }

    const io = getIO();
    if (io) {
      io.to(`user:${job.data.userId}`).emit('generation:complete', {
        jobId: job.id,
        type: job.data.type,
        planId: job.data.planId,
        result,
      });
    }
  });

  worker.on('failed', async (job, err) => {
    try {
      await resultStore.set(
        `ai_job:${job?.id}`,
        JSON.stringify({ status: 'failed', error: err?.message || 'unknown' }),
        'EX',
        RESULT_TTL_SECONDS
      );
    } catch (e) { /* non-fatal */ }

    const io = getIO();
    if (io && job) {
      io.to(`user:${job.data.userId}`).emit('generation:failed', {
        jobId: job.id,
        type: job.data.type,
        planId: job.data.planId,
        error: err?.message || 'unknown',
      });
    }
  });

  worker.on('error', (err) => {
    console.error('[ai-queue] worker error:', err.message);
  });

  console.log('[ai-queue] worker started, concurrency:', worker.opts.concurrency);
  return worker;
}

/* ─── Polling-fallback helper ──────────────────────────────────────── */

async function getJobSnapshot(jobId) {
  // Fast path: cached final state
  try {
    const cached = await resultStore.get(`ai_job:${jobId}`);
    if (cached) return JSON.parse(cached);
  } catch (e) { /* fall through */ }

  // Live BullMQ lookup
  const job = await queue.getJob(jobId);
  if (!job) return null;
  const state = await job.getState();
  return {
    status: state,
    progress: job.progress ?? 0,
    result: job.returnvalue || null,
    error: job.failedReason || null,
  };
}

module.exports = {
  queue,
  enqueueGeneration,
  startWorker,
  getJobSnapshot,
  priorityForTier,
};
