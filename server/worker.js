/* @flow */
const { Connector } = require("hull");

const SyncAgent = require("./lib/sync-agent");

function workerJobs(connector: Connector): Connector {
  connector.worker({
    startSync: function startSyncWrapper(ctx) {
      ctx.job = this;
      const agent = new SyncAgent(ctx);
      return agent.startSync();
    },
    startImport: function startImportWrapper(ctx) {
      ctx.job = this;
      const agent = new SyncAgent(ctx);
      return agent.startImport();
    }
  });
  return connector;
}

module.exports = workerJobs;
