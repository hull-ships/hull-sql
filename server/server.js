/* @flow */

import express from "express";
import bodyParser from "body-parser";
import queueUiRouter from "hull/lib/infra/queue/ui-router";

import statusCheck from "./lib/status-check";
import devModeMiddleware from "./lib/dev-mode";
import SyncAgent from "./lib/sync-agent";
import checkConfiguration from "./lib/check-conf-middleware";

const path = require("path");

// function readmeRouteFactory() {
//   return function readmeRoute(req, res) {
//     // console.log("Trying: " + `https://dashboard.hullapp.io/readme?url=https://${req.headers.host}/${subpath}`);
//     return res.redirect(
//       `https://dashboard.hullapp.io/readme?url=https://${req.headers.host}/${req.originalUrl}`
//     );
//   };
// }

export default function server(app: express, options: any):express {
  const { hostSecret, queue, devMode } = options;

  if (devMode) {
    app.use(devModeMiddleware());
  }

  app.use(bodyParser.urlencoded({ extended: true }));

  if (queue.adapter.setupUiRouter) {
    app.use("/kue", queueUiRouter({ hostSecret, queueAgent: queue }));
  }

  const applicationDirectory = path.dirname(
    path.join(require.main.filename, "..")
  );

  // any subdirectories can serve custom static assets
  app.use(express.static(`${applicationDirectory}/connectors`));

  // can get this to work by puting it in the routes Router
  // but then it requires authentication if called directly
  // one way or another, these routes don't even look like they are used
  // looks like readme.md is called directly, which because we enable all static assets under /connectors
  // is easily reachable without these routes
  // const staticRoutes = express.Router();
  // // making sure the other special static routes are set in the custom adapter router
  // staticRoutes.use(express.static(`${applicationDirectory}/dist`));
  // staticRoutes.get("/", readmeRouteFactory());
  // staticRoutes.get("/readme", readmeRouteFactory());
  //
  // app.use(staticRoutes);
  // app.use("/:adapter/", staticRoutes);

  app.use((req, res, next) => {
    if (req.hull && req.hull.ship) {
      req.agent = new SyncAgent(req.hull);
      return next();
    }

    return res.status(403).json({ status: "missing credentials" });
  });


  const routes = express.Router();

  routes.get("/admin.html", ({ agent }, res) => {
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

  routes.post("/run", checkConfiguration(), ({ body, agent, hull }, res) => {
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

  routes.post("/import", checkConfiguration({ checkQueryString: true }), (req, res) => {
    req.hull.enqueue("startImport");
    res.json({ status: "scheduled" });
  });

  routes.post("/sync", checkConfiguration({ checkQueryString: true, sync: true }), (req, res) => {
    const response = { status: "ignored" };
    if (req.agent.isEnabled()) {
      response.status = "scheduled";
      req.hull.enqueue("startSync");
    }

    res.json(response);
  });

  routes.get("/storedquery", checkConfiguration(), ({ agent }, res) => {
    const query = agent.getQuery();
    res.json({ query });
  });

  routes.all("/status", statusCheck);

  app.use(routes);
  app.use("/:adapter/", routes);

  return app;
}
