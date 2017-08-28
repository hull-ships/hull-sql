/* @flow */

import express from "express";
import bodyParser from "body-parser";
import queueUiRouter from "hull/lib/infra/queue/ui-router";

import statusCheck from "./lib/status-check";
import devModeMiddleware from "./lib/dev-mode";
import SyncAgent from "./lib/sync-agent";
import checkConfiguration from "./lib/check-conf-middleware";

export default function server(app: express, options: any):express {
  const { hostSecret, queue, devMode } = options;

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

  app.get("/admin.html", ({ agent }, res) => {
    if (agent.areConnectionParametersConfigured()) {
      const query = agent.getQuery();
      res.render("connected.html", {
        query,
        last_sync_at: null,
        ...agent.ship.private_settings
      });
    } else {
      res.render("home.html", {});
    }
  });

  app.post("/run", checkConfiguration(), ({ body, agent, hull }, res) => {
    const query = body.query || agent.getQuery();

    if (!query) {
      return res.status(403).json({ status: "query string empty" });
    }

    return agent
      .runQuery(query, { timeout: 20000, limit: 100 })
      .then(data => res.json(data))
      .catch(error => {
        const { status, message } = error;
        const err = agent.adapter.in.checkForError(error);
        if (err) {
          hull.client.logger.error("query.error", { hull_summary: err.message });
        }
        return res.status(status || 500).send({ message });
      });
  });

  app.post("/import", checkConfiguration({ checkQueryString: true }), (req, res) => {
    req.hull.enqueue("startImport");
    res.json({ status: "scheduled" });
  });

  app.post("/sync", checkConfiguration({ checkQueryString: true }), (req, res) => {
    const response = { status: "ignored" };
    if (req.agent.isEnabled()) {
      response.status = "scheduled";
      req.hull.enqueue("startSync");
    }

    res.json(response);
  });

  app.get("/storedquery", checkConfiguration(), ({ agent }, res) => {
    const query = agent.getQuery();
    res.json({ query });
  });

  app.all("/status", statusCheck);

  return app;
}
