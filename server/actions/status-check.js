/* @flow */
import { Request, Response } from "express";
import _ from "lodash";


export default function (req: Request, res: Response) {
  // eslint-disable-next-line prefer-const
  let { agent } = req;
  const { client = {}, ship = {} } = req.hull;
  let status = "ok";
  const messages = [];
  const pushMessage = (message, changeStatusTo = "error") => {
    status = changeStatusTo;
    messages.push(message);
  };
  const promises = [];

  if (!req.agent.areConnectionParametersConfigured()) {
    pushMessage("Connection parameters are not fully configured");
  } else {
    // check connection and response
    promises.push(agent.runQuery("SELECT 1 as test", { timeout: 3000 }).catch(err => {
      pushMessage(`Error when trying to connect with database. ${_.get(err, "message", "")}`);
    }));
  }

  if (!agent.isQueryStringConfigured()) {
    pushMessage("Query is not configured");
  }

  if (!agent.isEnabled()) {
    let changeStatusTo = "warning";
    if (status === "error") {
      changeStatusTo = "error";
    }
    pushMessage("Sync is disabled. Enable it in settings.", changeStatusTo);
  }

  if (
    _.get(ship, "private_settings.enabled") &&
    _.get(ship, "private_settings.import_days", 0) < 0 &&
    _.includes(_.get(ship, "private_settings.query"), "import_start_date")) {
    pushMessage("Interval syncing is enabled but interval time is less or equal zero.");
  }

  return Promise.all(promises).then(() => {
    res.json({ messages: _.uniq(messages), status });
    return client.put(`${ship.id}/status`, { status, messages: _.uniq(messages) });
  });
}
