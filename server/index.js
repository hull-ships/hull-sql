/* @flow */
import Hull from "hull";
import express from "express";
import Aws from "aws-sdk";
import { Cache, Queue } from "hull/lib/infra";
import BullAdapter from "hull/lib/infra/queue/adapter/bull";
import SqsAdapter from "hull/lib/infra/queue/adapter/sqs";

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

let queue;

if (process.env.QUEUE_ADAPTER === "sqs" && process.env.SQS_QUEUE_URL) {
  queue = new Queue(new SqsAdapter({
    region: process.env.AWS_REGION || "us-east-1",
    accessKeyId: process.env.AWS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_KEY,
    queueUrl: process.env.SQS_QUEUE_URL
  }));
} else {
  queue = new Queue(new BullAdapter({
    prefix: process.env.KUE_PREFIX || "hull-sql",
    redis: process.env.REDIS_URL,
    settings: {
      lockDuration: process.env.OVERRIDE_LOCK_DURATION || 60000,
      stalledInterval: process.env.OVERRIDE_STALLED_INTERVAL || 60000
    }
  }));
}

const connector = new Hull.Connector({
  timeout: process.env.CONNECTOR_TIMEOUT,
  hostSecret,
  port,
  cache,
  queue,
  clientConfig: {
    firehoseUrl: process.env.OVERRIDE_FIREHOSE_URL
  }
});

connector.setupApp(app);

app.use("/snowflake", require("./custom-connect-router")("connectors/snowflake"));

if (process.env.COMBINED || process.env.WORKER) {
  worker(connector);
  connector.startWorker();
}

if (process.env.COMBINED || process.env.SERVER) {
  server(app, { hostSecret, queue, devMode });
  connector.startApp(app);
}
