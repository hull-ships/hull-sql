import Bootstrap from "./bootstrap";
import WorkerJobs from "./worker-jobs";

const options = Bootstrap(process.env);

console.warn("Starting worker from queue", options.queue.id);
WorkerJobs(options);
