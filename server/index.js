/* @flow */
import Hull from "hull";
import express from "express";
import Aws from "aws-sdk";
import { Cache, Queue } from "hull/lib/infra";

import server from "./server";
import worker from "./worker";

const hostSecret = process.env.SECRET;
const port = process.env.PORT || 8082;
const devMode = process.env.NODE_ENV === "development";

const app = express();

Aws.config.update({
  accessKeyId: process.env.AWS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_KEY
});


if (process.env.LOG_LEVEL) {
  Hull.logger.transports.console.level = process.env.LOG_LEVEL;
}

const cache = new Cache({
  store: "memory",
  ttl: 1
});

const queue = new Queue("bull", {
  prefix: process.env.KUE_PREFIX || "hull-sql",
  redis: process.env.REDIS_URL
});

const connector = new Hull.Connector({
  hostSecret,
  port,
  cache,
  queue
});

connector.setupApp(app);

if (process.env.COMBINED || process.env.WORKER) {
  worker(connector);
  connector.startWorker();
}

if (process.env.COMBINED || process.env.SERVER) {
  server(app, { hostSecret, queue, devMode });
  connector.startApp(app);
}

