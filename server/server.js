/* @flow */
import express from "express";
import bodyParser from "body-parser";
import queueUiRouter from "hull/lib/infra/queue/ui-router";

import devModeMiddleware from "./lib/dev-mode";
import SyncAgent from "./lib/sync-agent";
import checkConfiguration from "./lib/check-conf-middleware";

export default function server(app: express, options: any):express {
  const { hostSecret, queue, devMode } = options;

  if (devMode) {
    app.use(devModeMiddleware());
  }

  app.use(bodyParser.urlencoded({ extended: true }));

  app.use("/kue", queueUiRouter({ hostSecret, queueAgent: queue }));

  app.use((req, res, next) => {
    req.agent = new SyncAgent(req.hull);
    next();
  });

  app.get("/admin.html", ({ agent }, res) => {
    if (agent.isConnectionStringConfigured()) {
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

  app.post("/run", checkConfiguration(), ({ body, agent }, res) => {
    const query = body.query || agent.getQuery();

    if (!query) {
      return res.status(403).json({ status: "query string empty" });
    }

    return agent
      .runQuery(query, { timeout: 20000 })
      .then(data => res.json(data))
      .catch(({ status, message }) =>
        res.status(status || 500).send({ message })
      );
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

  return app;
}
