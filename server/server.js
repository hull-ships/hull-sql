/* @flow */
import bodyParser from "body-parser";
import devMode from "./util/dev-mode";
import SyncAgent from "./sync-agent";
import kueRouter from "./util/kue-router";


module.exports = function server(options: any) {
  const { app, hostSecret, queue } = options;

  if (options.devMode) {
    app.use(devMode());
  }

  app.use(bodyParser.urlencoded({ extended: true }));

  app.use("/kue", kueRouter({ hostSecret, queue }));

  app.use((req, res, next) => {
    req.agent = new SyncAgent(req.hull);
    next();
  });

  function checkConfiguration({ hull, agent }, res, next) {
    if (!agent.isConnectionStringConfigured()) {
      hull.client.logger.error("connection string not configured");
      return res.status(403).json({ status: "connection string not configured" });
    }

    if (!agent.isQueryStringConfigured()) {
      hull.client.logger.error("query string not configured");
      return res.status(403).json({ status: "query string not configured" });
    }

    return next();
  }

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

  app.post("/run", checkConfiguration, ({ body, agent }, res) => {
    const query = body.query || agent.getQuery();
    agent
      .runQuery(query, { timeout: 20000 })
      .then(data => res.json(data))
      .catch(({ status, message }) =>
        res.status(status || 500).send({ message })
      );
  });

  app.post("/import", checkConfiguration, (req, res) => {
    req.hull.enqueue("startImport");
    res.json({ status: "scheduled" });
  });

  app.post("/sync", checkConfiguration, (req, res) => {
    const response = { status: "ignored" };
    if (req.agent.isEnabled()) {
      response.status = "scheduled";
      req.hull.enqueue("startSync");
    }

    res.json(response);
  });

  return app;
};
