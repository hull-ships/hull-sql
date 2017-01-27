import Bootstrap from "./bootstrap";
import SyncAgent from "./sync-agent";

const options = Bootstrap(process.env);

console.warn("Starting worker from queue", options.queue.id);
SyncAgent.work(options.queue);
