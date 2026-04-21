// A small round-robin worker pool that dispatches SVG optimization tasks to
// dedicated worker_threads. Each task returns a Promise resolved with the
// optimized string. The pool is created lazily via optimizeSVGBatch() and is
// torn down when the batch is done.
import { Worker } from "worker_threads";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORKER_PATH = path.join(__dirname, "worker.js");

class WorkerPool {
  constructor(size, defaults = {}) {
    this.size = Math.max(1, size | 0);
    this.workers = [];
    this.free = [];
    this.queue = [];
    this.nextId = 1;
    this.pending = new Map();
    for (let i = 0; i < this.size; i++) {
      const w = new Worker(WORKER_PATH, { workerData: { defaults } });
      w.on("message", (msg) => this._onMessage(w, msg));
      w.on("error", (err) => this._onError(w, err));
      this.workers.push(w);
      this.free.push(w);
    }
  }

  _onMessage(w, msg) {
    const entry = this.pending.get(msg.id);
    if (!entry) return;
    this.pending.delete(msg.id);
    if (msg.ok) entry.resolve(msg.data);
    else entry.reject(new Error(msg.error));
    this.free.push(w);
    this._drain();
  }

  _onError(w, err) {
    // Reject every pending task handled by this worker; in practice SVGO
    // errors are reported via message, so hitting this means the worker died.
    for (const [id, entry] of this.pending) {
      if (entry.worker === w) {
        this.pending.delete(id);
        entry.reject(err);
      }
    }
  }

  _drain() {
    while (this.free.length && this.queue.length) {
      const w = this.free.shift();
      const job = this.queue.shift();
      const id = this.nextId++;
      this.pending.set(id, { ...job, worker: w });
      w.postMessage({ id, content: job.content, options: job.options });
    }
  }

  run(content, options) {
    return new Promise((resolve, reject) => {
      this.queue.push({ content, options, resolve, reject });
      this._drain();
    });
  }

  async terminate() {
    await Promise.all(this.workers.map((w) => w.terminate()));
  }
}

/**
 * Optimize many SVG strings in parallel using worker_threads.
 *
 * @param {Array<{content:string, options?:object}>|Array<string>} items
 * @param {{concurrency?:number, defaults?:object}} poolOptions
 * @returns {Promise<string[]>} optimized SVG strings, in the same order as input
 */
export async function optimizeSVGBatch(items, poolOptions = {}) {
  const size = poolOptions.concurrency || os.cpus().length;
  const pool = new WorkerPool(size, poolOptions.defaults || {});
  try {
    return await Promise.all(
      items.map((it) => {
        const content = typeof it === "string" ? it : it.content;
        const options = typeof it === "string" ? {} : it.options || {};
        return pool.run(content, options);
      })
    );
  } finally {
    await pool.terminate();
  }
}

export { WorkerPool };
