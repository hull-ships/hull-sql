// @flow

export default function checkConfigurationFactory({ checkQueryString = false, sync = false }: Object = {}): Function {
  return function checkConfigurationMiddleware({ hull, agent }, res, next) {
    if (!agent.areConnectionParametersConfigured()) {
      if (sync) {
        hull.client.logger.error("incoming.job.error", { hull_summary: "connection string not configured, please update it or disable sync" });
      } else {
        hull.client.logger.error("connection string not configured");
      }
      return res.status(403).json({ message: "connection parameters not configured" });
    }

    if (checkQueryString && !agent.isQueryStringConfigured()) {
      if (sync) {
        hull.client.logger.error("incoming.job.error", { hull_summary: "query string not configured, please update it or disable sync" });
      } else {
        hull.client.logger.error("query string not configured");
      }
      return res.status(403).json({ message: "query string not configured" });
    }

    return next();
  };
}
