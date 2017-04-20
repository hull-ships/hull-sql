import bodyParser from "body-parser";
import devMode from "./util/dev-mode";
import SyncAgent from "./sync-agent";
import KueRouter from "./util/kue-router";


module.exports = function server(options = {}) {
  const { app, hostSecret } = options;

  if (options.devMode) {
    app.use(devMode());
  }

  app.use(bodyParser.urlencoded({ extended: true }));

  app.use("/kue", KueRouter({ hostSecret }));

  app.use((req, res, next) => {
    req.agent = new SyncAgent(req.hull);
    next();
  });

  function checkConfiguration({ agent }, res, next) {
    if (!agent.isConfigured()) {
      console.error({ status: "not configured" });
      res.status(403).json({ status: "not configured" });
    } else {
      next();
    }
  }

  app.get("/admin.html", ({ agent }, res) => {
    if (agent.isConfigured()) {
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

  app.post("/run", ({ body, agent }, res) => {
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
