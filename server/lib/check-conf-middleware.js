// @flow
export default function checkConfigurationFactory({ checkQueryString = false }: Object = {}): Function {
  return function checkConfigurationMiddleware({ hull, agent }, res, next) {
    if (!agent.isConnectionStringConfigured()) {
      hull.client.logger.error("connection string not configured");
      return res.status(403).json({ status: "connection string not configured" });
    }

    if (checkQueryString && !agent.isQueryStringConfigured()) {
      hull.client.logger.error("query string not configured");
      return res.status(403).json({ status: "query string not configured" });
    }

    return next();
  };
}
