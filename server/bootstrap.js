/* eslint global-require: 0 */
if (process.env.NEW_RELIC_LICENSE_KEY) {
  console.warn("Starting newrelic agent with key: ", process.env.NEW_RELIC_LICENSE_KEY);
  require("newrelic");
}

const Hull = require("hull");
const kue = require("kue");

// Configure AWS
const Aws = require("aws-sdk");
Aws.config.update({
  accessKeyId: process.env.AWS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_KEY
});


if (process.env.LOG_LEVEL) {
  Hull.logger.transports.console.level = process.env.LOG_LEVEL;
}

const queue = kue.createQueue({
  prefix: process.env.KUE_PREFIX || "hull-sql",
  redis: process.env.REDIS_URL
});

const PORT = process.env.PORT || 8082;

export default {
  PORT,
  queue,
  Hull,
  hostSecret: process.env.SECRET || "1234",
  devMode: process.env.NODE_ENV === "development",
  workerMode: process.env.WORKER_MODE || "standalone"
};

