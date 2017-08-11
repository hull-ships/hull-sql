/* @flow */
import { Request, Response } from "express";
import _ from "lodash";

import SyncAgent from "./sync-agent";

export default function (req: Request, res: Response) {
  let { agent } = req;
  const { client = {}, ship = {} } = req.hull;
  let status = "ok";
  const messages = [];
  const pushMessage = (message) => {
    status = "error";
    messages.push(message);
  };
  const promises = [];

  if (!req.agent.areConnectionParametersConfigured()) {
    pushMessage("Connection string is not configured");
  } else {
    // check connection and response
    promises.push(agent.runQuery("SELECT 1", { timeout: 3000 }).catch(err => {
      pushMessage(`Error when trying to connect with database. ${_.get(err, "message", "")}`);
    }));
  }

  if (!agent.isQueryStringConfigured()) {
    pushMessage("Query string is not configured");
  } else {
    agent = new SyncAgent(req.hull);
    promises.push(agent.runQuery(agent.getQuery(), { limit: 1, timeout: 3000 }).then(result => {
      if (result.entries && result.entries.length === 0) {
        pushMessage("Database does not return any rows for saved query");
      }

      if (result.errors) {
        pushMessage(`Results have invalid format. ${result.errors.join("\n")}`);
      }
    }).catch(err => {
      pushMessage(`Error when trying to connect with database. ${_.get(err, "message", "")}`);
    }));
  }

  if (_.get(ship, "private_settings.enabled") && _.get(ship, "private_settings.import_days", 0) < 0) {
    pushMessage("Interval syncing is enabled but interval time is less or equal zero.");
  }

  return Promise.all(promises).then(() => {
    res.json({ messages: _.uniq(messages), status });
    return client.put(ship.id, { status, status_messages: _.uniq(messages) });
  });
}
