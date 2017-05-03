/* @flow */
import Bootstrap from "./bootstrap";
import Server from "./server";
import WorkerJobs from "./worker-jobs";

const options = Bootstrap(process.env);

if (options.workerMode === "embedded") {
  WorkerJobs(options);
}

const { connector, app } = options;

connector.setupApp(app);
connector.startApp(Server(options));
