import express from "express";
import bodyParser from "body-parser";
import path from "path";
import ejs from "ejs";

import devMode from "./util/dev-mode";
import SyncAgent from "./sync-agent";

import KueRouter from "./util/kue-router";


module.exports = function server(options = {}) {
  const { Hull, hostSecret, queue } = options;
  const { Routes } = Hull;
  const { Readme, Manifest } = Routes;
  const app = express();

  if (options.devMode) {
    app.use(devMode());
  }

  app.engine("html", ejs.renderFile);
  app.set("views", path.resolve(__dirname, "..", "views"));
  app.use(express.static(path.resolve(__dirname, "..", "dist")));
  app.use(express.static(path.resolve(__dirname, "..", "assets")));

  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));

  app.get("/manifest.json", Manifest(__dirname));
  app.get("/", Readme);
  app.get("/readme", Readme);

  app.use("/kue", KueRouter({ hostSecret, queue }));

  app.use(Hull.Middleware({ hostSecret, fetchShip: true, cacheShip: false, requireCredentials: true }));

  app.use((req, res, next) => {
    req.agent = new SyncAgent({ ...req.hull, queue });
    next();
  });

  function checkConfiguration({ agent }, res, next) {
    if (!agent.isEnabled()) {
      res.status(403).json({ status: "ignored" });
    } else if (!agent.isConfigured()) {
      res.status(403).json({ status: "not configured" });
    } else {
      next();
    }
  }

  app.get("/admin.html", ({ agent }, res) => {
    if (agent.isConfigured()) {
      const query = agent.getQuery();
      res.render("connected.html", {
        query: query,
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

  app.post("/import", checkConfiguration, ({ agent }, res) => {
    agent.async("startImport");
    res.json({ status: "scheduled" });
  });

  app.post("/sync", checkConfiguration, ({ agent }, res) => {
    agent.async("startSync");
    res.json({ status: "scheduled" });
  });

  // Error Handler
  app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
    if (err) {
      const logger = req.hull.client ? req.hull.client.logger : Hull.logger;
      logger.error("unhandled error", { message: err.message, status: err.status, method: req.method, url: req.url, params: req.params });
    }

    return res.status(err.status || 500).send({ message: err.message });
  });

  return app;
};
