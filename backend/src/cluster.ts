import cluster from "cluster";
import { cpus } from "os";

// WEB_CONCURRENCY is the Render/Heroku convention.
// Default: use all CPU cores. On free-tier (1 CPU) this stays as 1 worker.
const WORKERS = parseInt(process.env.WEB_CONCURRENCY ?? "0", 10) || cpus().length;

if (cluster.isPrimary) {
  console.log(`[cluster] Primary ${process.pid} — spawning ${WORKERS} worker(s) on ${cpus().length} CPU(s)`);

  for (let i = 0; i < WORKERS; i++) cluster.fork();

  cluster.on("exit", (worker, code, signal) => {
    if (!worker.exitedAfterDisconnect) {
      console.warn(`[cluster] Worker ${worker.process.pid} died (${signal ?? code}). Restarting in 1 s…`);
      setTimeout(() => cluster.fork(), 1_000);
    }
  });

  // Zero-downtime rolling restart on SIGUSR2
  process.on("SIGUSR2", () => {
    const workers = Object.values(cluster.workers ?? {}).filter(Boolean) as import("cluster").Worker[];
    let i = 0;
    const next = () => {
      const w = workers[i++];
      if (!w) return;
      w.once("exit", () => { cluster.fork(); setTimeout(next, 2_000); });
      w.disconnect();
    };
    next();
  });
} else {
  require("./server");
}
