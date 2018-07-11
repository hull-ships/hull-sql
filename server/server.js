/* @flow */

const express = require("express");
const bodyParser = require("body-parser");
const queueUiRouter = require("hull/lib/infra/queue/ui-router");

const statusCheck = require("./lib/status-check");
const devModeMiddleware = require("./lib/dev-mode");
const SyncAgent = require("./lib/sync-agent");
const checkConfiguration = require("./lib/check-conf-middleware");

function server(app: express, options: any): express {
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
        import_type: "users",
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
      .runQuery(query, { timeout: parseInt(process.env.RUN_TIMEOUT_MS, 10) | 60000, limit: 100 })
      .then(data => res.json(data))
      .catch(error => {
        const { status, message } = error;
        return res.status(status || 500).send({ message });
      });
  });

  app.post("/import", checkConfiguration({ checkQueryString: true }), (req, res) => {
    req.hull.enqueue("startImport");
    res.json({ status: "scheduled" });
  });

  app.post("/sync", checkConfiguration({ checkQueryString: true, sync: true }), (req, res) => {
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

module.exports = server;
