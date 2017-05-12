/* eslint global-require: 0 */
import Hull from "hull";
import express from "express";
import Aws from "aws-sdk";
import { Cache } from "hull/lib/infra";

export default function (env) {
  Aws.config.update({
    accessKeyId: env.AWS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_KEY
  });


  if (env.LOG_LEVEL) {
    Hull.logger.transports.console.level = env.LOG_LEVEL;
  }

  const app = express();

  const port = env.PORT || 8082;

  const hostSecret = env.SECRET;

  const cache = new Cache({
    store: "memory",
    ttl: 1
  });

  const connector = new Hull.Connector({ hostSecret, port, cache });

  return {
    hostSecret,
    devMode: env.NODE_ENV === "development",
    workerMode: env.WORKER_MODE || "standalone",
    connector,
    app
  };
}
