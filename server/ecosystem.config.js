/**
 * PM2 process manifest for VastuVerse API.
 *
 *   pm2-runtime start ecosystem.config.js --env production
 *
 * Cluster mode: 4 forked workers. Each is an independent Node process
 * sharing port 5000 via the OS-level SO_REUSEPORT load balancer that
 * Node provides under cluster mode. Single-process bottleneck (single
 * V8 event loop) is gone — 4× throughput on a 4-core box.
 *
 * Things to know:
 *   - In-process state must NOT be relied on (rate-limiter falls back
 *     to in-memory when REDIS_URL is missing — DO NOT skip Redis in prod
 *     or 4 workers count quotas separately).
 *   - Socket.io uses the Redis adapter to fan out across workers (see
 *     config/socket.js). Without it, a socket connected to worker 2 won't
 *     receive an event emitted from worker 1.
 *   - BullMQ worker (queues/aiGenerationQueue.js) should run on ONE
 *     worker only, not all 4 — otherwise jobs get processed 4× in
 *     parallel and you pay for AI calls 4× over.
 */

module.exports = {
  apps: [
    /* ─── API: 4-worker cluster ─────────────────────────────────── */
    {
      name: 'vastuverse-api',
      script: './src/index.js',
      instances: process.env.PM2_INSTANCES || 4,
      exec_mode: 'cluster',

      // Auto-restart guards
      max_memory_restart: '1G',     // restart worker if it leaks past 1 GB
      max_restarts: 10,             // give up after 10 restarts in <1 min
      min_uptime: '10s',
      autorestart: true,

      // Logs (PM2 owns these; winston writes its own under /app/logs)
      out_file: './logs/pm2-out.log',
      error_file: './logs/pm2-error.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss.SSS',

      // Graceful shutdown — give workers 8s to drain in-flight requests
      // before SIGKILL. Matches the 10s grace period in k8s default
      // pod termination.
      kill_timeout: 8000,
      wait_ready: false,
      listen_timeout: 10000,

      // Node options
      node_args: '--max-old-space-size=1024 --enable-source-maps',

      env: {
        NODE_ENV: 'development',
        PORT: 5000,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000,
        // Only the FIRST worker (instance ID 0) runs the AI queue worker.
        // index.js reads PM2_INSTANCE_ID and skips startWorker() on others.
        // PM2 auto-injects this env var in cluster mode.
      },
    },

    /* ─── (Optional) dedicated queue worker process ────────────────
       If you'd rather isolate the BullMQ worker from the API workers
       entirely, uncomment this block and remove startWorker() from
       index.js. The dedicated process gets its own memory budget and
       crashes don't take down the API.

    {
      name: 'vastuverse-queue',
      script: './src/queueWorker.js',   // thin file that calls startWorker()
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '1G',
      autorestart: true,
      env_production: { NODE_ENV: 'production' },
    },
    */
  ],
};
