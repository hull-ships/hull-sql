import SyncAgent from "./sync-agent";
import options from "./bootstrap";

console.warn("Starting worker from queue", options.queue.id);
SyncAgent.work(options.queue);

