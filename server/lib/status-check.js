/* @flow */
import { Request, Response } from "express";
import _ from "lodash";

import SyncAgent from "./sync-agent";

export default function (req: Request, res: Response) {
  let { agent } = req;
  const { hull = {} } = req;
  const messages = [];
  const promises = [];
  let status = "ok";

  if (!req.agent.areConnectionParametersConfigured()) {
    status = "error";
    messages.push("Connection string is not configured");
  } else {
    // check connection and response
    promises.push(req.agent.runQuery("SELECT 1", { timeout: 3000 }).catch(err => {
      messages.push(`Error when trying to connect with database. ${_.get(err, "message", "")}`);
    }));
  }

  if (!req.agent.isQueryStringConfigured()) {
    status = "error";
    messages.push("Query string is not configured");
  } else {
    if (req.hull && req.hull.ship) {
      agent = new SyncAgent(req.hull);
      promises.push(agent.runQuery(agent.getQuery(), { limit: 1, timeout: 3000 }).then(result => {
        if (result.entries && result.entries.length === 0) {
          messages.push("Database does not return any rows for saved query");
        }

        if (result.errors) {
          messages.push(result.errors);
        }
      }).catch(err => {
        messages.push(`Error when trying to connect with database. ${_.get(err, "message", "")}`);
      }));
    } else {
      messages.push("Hull client is undefined");
    }
  }

  if (_.get(hull, "ship.private_settings.enabled") && _.get(hull, "ship.private_settings.import_days", 0) < 0) {
    status = "error";
    messages.push("Interval syncing is enabled but interval time is less or equal zero.");
  }

  return Promise.all(promises).then(() => {
    res.json({ messages: _.uniq(messages), status });
    return hull.client.put(req.hull.ship.id, { status, status_messages: _.uniq(messages) });
  });
}
