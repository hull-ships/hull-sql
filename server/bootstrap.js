/* eslint global-require: 0 */

import Hull from "hull";
import kue from "kue";
import Aws from "aws-sdk";


export default function (env) {
  Aws.config.update({
    accessKeyId: env.AWS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_KEY
  });


  if (env.LOG_LEVEL) {
    Hull.logger.transports.console.level = env.LOG_LEVEL;
  }

  const queue = kue.createQueue({
    prefix: env.KUE_PREFIX || "hull-sql",
    redis: env.REDIS_URL
  });

  const PORT = env.PORT || 8082;

  return {
    PORT,
    queue,
    Hull,
    hostSecret: env.SECRET,
    devMode: env.NODE_ENV === "development",
    workerMode: env.WORKER_MODE || "standalone"
  };
}
