import express from "express";
import bodyParser from "body-parser";
import path from "path";
import ejs from "ejs";
import moment from "moment";

import devMode from "./dev-mode";
import SyncAgent from "./sync-agent";

module.exports = function server(options = {}) {
  const { Hull, hostSecret } = options;
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

  app.use(Hull.Middleware({ hostSecret, fetchShip: true, cacheShip: false, requireCredentials: false }));

  app.get("/admin.html", (req, res) => {
    const { ship } = req.hull;
    if (ship.private_settings.connection_string) {
      res.render("connected.html", {
        last_sync_at: null,
        ...ship.private_settings
      });
    } else {
      res.render("home.html", {});
    }
  });

  app.post("/run", (req, res) => {
    const { ship } = req.hull;
    const query = req.body.query || ship.private_settings.query;
    const agent = new SyncAgent(req.hull);
    agent
      .runQuery(query, { timeout: 20000 })
      .then(data => res.json(data))
      .catch(({ status, message }) =>
        res.status(status || 500).send({ message })
      );
  });

  app.post("/import", (req, res) => {
    const { private_settings } = req.hull.ship;
    const agent = new SyncAgent(req.hull);
    agent.streamQuery(private_settings.query)
      .catch((err) => {
        const { status, message } = err || {};
        res.status(status || 500).send({ message });
      })
      .then(stream => {
        res.json({ status: "working..." });
        return agent.startSync(stream, new Date());
      });
  });

  app.post("/sync", (req, res) => {
    const { private_settings = {} } = req.hull.ship;
    const oneHourAgo = moment().subtract(1, "hour").utc();
    const last_sync_at = private_settings.last_sync_at || oneHourAgo.toISOString();

    if (private_settings.enabled === true) {
      req.hull.client.logger.info("startSync", { last_sync_at });
      const agent = new SyncAgent(req.hull);
      agent.streamQuery(private_settings.query, { last_sync_at })
        .then(stream => {
          res.json({ status: "working", last_sync_at });
          return agent.startSync(stream, new Date());
        })
        .catch(({ status, message }) => {
          res.status(status || 500).send({ message });
        });
    } else {
      req.hull.client.logger.info("skipSync");
      res.json({ status: "ignored" });
    }
  });

  // Error Handler
  app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
    if (err) {
      const data = {
        status: err.status,
        segmentBody: req.segment,
        method: req.method,
        headers: req.headers,
        url: req.url,
        params: req.params
      };
      console.log("Error ----------------");
      console.log(err.message, err.status, data);
      console.log(err.stack);
    }

    return res.status(err.status || 500).send({ message: err.message });
  });

  return app;
};
