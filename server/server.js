/* @flow */

import express from "express";
import bodyParser from "body-parser";
import queueUiRouter from "hull/lib/infra/queue/ui-router";

import devModeMiddleware from "./lib/dev-mode";
import SyncAgent from "./lib/sync-agent";
import checkConfiguration from "./lib/check-conf-middleware";
import * as actions from "./actions";

export default function server(app: express, options: any):express {
  const { hostSecret, queue, devMode } = options;

  // middlewares
  if (devMode) {
    app.use(devModeMiddleware());
  }

  app.use(bodyParser.urlencoded({ extended: true }));

  if (queue.adapter.setupUiRouter) {
    app.use("/kue", queueUiRouter({ hostSecret, queueAgent: queue }));
  }

  app.use((req, res, next) => {
    if (req.hull && req.hull.ship) {
      req.agent = new SyncAgent(req.hull);
      return next();
    }

    return res.status(403).json({ status: "missing credentials" });
  });

  // endpoints
  app.get("/admin.html", actions.admin);
  app.post("/run", checkConfiguration(), actions.run);
  app.post("/import", checkConfiguration({ checkQueryString: true }), actions._import);
  app.post("/sync", checkConfiguration({ checkQueryString: true, sync: true }), actions.sync);
  app.get("/storedquery", checkConfiguration(), actions.storedQuery);
  app.all("/status", actions.statusCheck);

  return app;
}
