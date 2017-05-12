/* @flow */
import { Connector } from "hull";

import SyncAgent from "./sync-agent";

module.exports = function workerJobs(connector: Connector): Connector {
  connector.worker({
    startSync: (ctx) => {
      ctx.job = this;
      const agent = new SyncAgent(ctx);
      agent.startSync(ctx);
    },
    startImport: (ctx) => {
      ctx.job = this;
      const agent = new SyncAgent(ctx);
      agent.startImport({});
    }
  });
  return connector;
};
