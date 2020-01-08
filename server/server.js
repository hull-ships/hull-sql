/* @flow */

import express from "express";
import bodyParser from "body-parser";
import queueUiRouter from "hull/lib/infra/queue/ui-router";

import statusCheck from "./lib/status-check";
import devModeMiddleware from "./lib/dev-mode";
import SyncAgent from "./lib/sync-agent";
import checkConfiguration from "./lib/check-conf-middleware";

const path = require("path");

function adapterReadmeRouteFactory() {
  return function readmeRoute(req, res) {
    // make sure this route has the :adapter parameter specified
    return res.redirect(
      `https://dashboard.hullapp.io/readme?url=https://${req.headers.host}/${req.params.adapter}`
    );
  };
}

export default function server(app: express, options: any):express {
  const { hostSecret, queue, devMode, preview_timeout } = options;
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

  const routes = express.Router();

  const validationMiddleware = (req, res, next) => {
    if (req.hull && req.hull.ship) {
      req.agent = new SyncAgent(req.hull);
      return next();
    }

    return res.status(403).json({ status: "missing credentials" });
  };

  // Typically the agent closes itself after the query or stream is done
  // but in this case we're not using it, so we have to close directly
  // need to refactor this pattern
  const closeRequestAgent = (requestAgent) => {
    if (requestAgent) {
      requestAgent.closeClient();
    }
  };

  routes.get("/admin.html",
    validationMiddleware,
    ({ agent }, res) => {
    if (agent.areConnectionParametersConfigured()) {
      const query = agent.getQuery();
      closeRequestAgent(agent);

      res.render("connected.html", {
        query,
        preview_timeout,
        last_sync_at: null,
        import_type: "users",
        ...agent.ship.private_settings
      });
    } else {
      closeRequestAgent(agent);
      res.render("home.html", {});
    }
  });

  routes.post("/run",
    validationMiddleware,
    checkConfiguration(),
    ({ body, agent, hull }, res) => {
    const query = body.query || agent.getQuery();

    if (!query) {
      return res.status(403).json({ status: "query string empty" });
    }

    return agent
      .runQuery(query, { timeout: parseInt(preview_timeout, 10), limit: 100 })
      .then(data => res.json(data))
      .catch(error => {
        const { status, message } = error;
        return res.status(status || 500).send({ message });
      });
  });

  routes.post("/import",
    validationMiddleware,
    checkConfiguration({ checkQueryString: true }),
    (req, res) => {
      req.hull.enqueue("startImport");

      closeRequestAgent(req.agent);

      res.json({ status: "scheduled" });
    });

  routes.post("/sync",
    validationMiddleware,
    checkConfiguration({ checkQueryString: true, sync: true }),
    (req, res) => {
      const response = { status: "ignored" };
      if (req.agent.isEnabled()) {
        response.status = "scheduled";
        req.hull.enqueue("startSync");
      }

      closeRequestAgent(req.agent);

      res.json(response);
    });

  routes.get("/storedquery",
    validationMiddleware,
    checkConfiguration(),
    ({ agent }, res) => {
      const query = agent.getQuery();
      closeRequestAgent(agent);
      res.json({ query });
    });

  routes.all("/status",
    validationMiddleware,
    statusCheck,
    ({ agent }) => {
      closeRequestAgent(agent);
    });

  app.use(routes);

  // the dist directory is one of the static routes set at the root
  // do we need to add the route to the relative roots?
  // doesn't seem like it right now...
  // app.use(express.static(`${applicationDirexctory}/dist`));

  app.get("/:adapter/", adapterReadmeRouteFactory());
  app.get("/:adapter/readme", adapterReadmeRouteFactory());
  app.use("/:adapter/", routes);

  return app;
}
