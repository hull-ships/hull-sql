/* @flow */
import SyncAgent from "./sync-agent";

module.exports = function workerJobs(options: any = {}) {
  const { connector } = options;

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

  connector.startWorker();
};
