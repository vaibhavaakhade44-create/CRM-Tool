// PM2 cluster config for production.
// Deploy: pm2 start ecosystem.config.js --env production
// Reload: pm2 reload blcrm --update-env
// Logs:   pm2 logs blcrm

module.exports = {
  apps: [
    {
      name: "blcrm",
      script: "dist/cluster.js",
      instances: "max",           // one worker per CPU core
      exec_mode: "cluster",
      watch: false,
      max_memory_restart: "512M", // restart a worker if it leaks past 512 MB

      // ── Environment — production ──────────────────────────────
      env_production: {
        NODE_ENV: "production",
        PORT: 5000,
        // Increase per-worker DB pool.
        // Total connections = DB_POOL_LIMIT × instances.
        // Set conservatively for Neon free (20 max) or higher for paid plans.
        DB_POOL_LIMIT: 10,
        // Set REDIS_URL to enable shared cache + rate-limit across workers.
        // Example: redis://default:<password>@<host>:6379
        // REDIS_URL: "redis://...",
      },

      // ── Logging ───────────────────────────────────────────────
      out_file: "logs/out.log",
      error_file: "logs/error.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,

      // ── Zero-downtime deploys ─────────────────────────────────
      wait_ready: true,           // wait for process.send('ready') signal
      listen_timeout: 15000,      // 15 s to start
      kill_timeout: 10000,        // 10 s graceful shutdown window
      shutdown_with_message: true,

      // ── Restart strategy ─────────────────────────────────────
      min_uptime: "10s",          // don't count restart if dies in < 10 s
      max_restarts: 10,
      exp_backoff_restart_delay: 100,
    },
  ],
};
