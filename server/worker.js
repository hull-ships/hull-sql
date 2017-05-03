/* @flow */
import Bootstrap from "./bootstrap";
import WorkerJobs from "./worker-jobs";

const options = Bootstrap(process.env);

WorkerJobs(options);
