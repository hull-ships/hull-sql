import express from "express";
import bodyParser from "body-parser";
import path from "path";
import devMode from "./dev-mode";
import ejs from "ejs";

import SyncAgent from "../lib/sync-agent"

module.exports = function server(options = {}) {
  const { Hull, hostSecret } = options;
  const { Routes, Middleware: hullClient } = Hull;
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

  app.get("/admin.html", hullClient({ hostSecret, fetchShip: false }), (req, res) => {

    const { config } = req.hull;

    const hull = new Hull({
      id: req.query.ship,
      secret: req.query.secret,
      organization: req.query.organization
    });

    hull.get(req.query.ship)
      .then(shipConfig => {

        if (shipConfig.private_settings.connection_string) {
          res.render("connected.html", {
            last_sync_at: shipConfig.private_settings.last_sync_at,
            db_type: shipConfig.private_settings.db_type,
            query: shipConfig.private_settings.query
          });
        }

        else {
          res.render("home.html", {});
        }
      });
  });

  app.post('/run', hullClient({ hostSecret, fetchShip: false }), (req, res) => {
    const settings = {
      id: req.query.ship,
      secret: req.query.secret,
      organization: req.query.organization
    };

    const hull = new Hull(settings);

    hull.get(settings.id)
      .then((ship) => {
        const query = req.body.query || ship.private_settings.query
        const agent = new SyncAgent(ship, hull);

        agent.runQuery(ship.private_settings.connection_string, query, (err, data) => {
          if (err) {
            Hull.logger.error(err);
            return res.json(err);
          } else {
            Hull.logger.info(data);
            return res.json(data);
          }

        });
      })
      .catch(err => {
        Hull.logger.error(err);
        return res.json(err);
      });
  });


  app.post('/import', hullClient({ hostSecret, fetchShip: false }), (req, res) => {
    const settings = {
      id: req.query.ship,
      secret: req.query.secret,
      organization: req.query.organization
    };

    let last_sync_at;
    if (req.query.incremental) {
      last_sync_at = ship.private_settings.last_sync_at;
    }

    const hull = new Hull(settings);

    hull.get(settings.id)
      .then((ship) => {
        const query = ship.private_settings.query;
        const agent = new SyncAgent(ship, hull);

        agent.streamQuery(ship.private_settings.connection_string, query, last_sync_at, (err, result) => {
          if (err) {
            Hull.logger.error(err);
            return res.json(err);
          } else {
            Hull.logger.info(result);
            return res.json(result);
          }
        });
      })
      .catch(err => {
        Hull.logger.error(err);
        return res.json(err);
      });
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
      console.log("Error ----------------", err.message, err.status, data);
      console.log(err.stack);
    }

    return res.status(err.status || 500).send({ message: err.message });
  });

  return app;
};
