import options from "./bootstrap";
import Server from "./server";
import SyncAgent from "./sync-agent";

if (options.workerMode === "embedded") {
  console.warn("Starting worker from queue", options.queue.id);
  SyncAgent.work(options.queue);
}

console.log(`Listening on port ${options.PORT}`);
Server(options).listen(options.PORT);

