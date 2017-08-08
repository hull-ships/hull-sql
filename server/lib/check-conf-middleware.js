// @flow
import _ from "lodash";

export default function checkConfigurationFactory({ checkQueryString = false }: Object = {}): Function {
  return function checkConfigurationMiddleware({ hull, agent }, res, next) {
    if (!agent.areConnectionParametersConfigured()) {
      hull.client.post(`/connector/${_.get(hull, "ship.id")}/notifications`, { status: "warning", message: "connection string not configured" });
      hull.client.logger.error("connection string not configured");
      return res.status(403).json({ status: "connection string not configured" });
    }

    if (checkQueryString && !agent.isQueryStringConfigured()) {
      hull.client.post(`/connector/${_.get(hull, "ship.id")}/notifications`, { status: "warning", message: "query string not configured" });
      hull.client.logger.error("query string not configured");
      return res.status(403).json({ status: "query string not configured" });
    }

    return next();
  };
}
