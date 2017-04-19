import Bootstrap from "./bootstrap";
import Scheduler from "./worker-jobs";

const options = Bootstrap(process.env);

console.warn("Starting worker from queue", options.queue.id);
Scheduler(options);
