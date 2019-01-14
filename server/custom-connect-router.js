const path = require("path");
const express = require("express");

function manifestRouteFactory(dirname) {
  return function manifestRoute(req, res) {
    return res.sendFile(path.resolve(dirname, "manifest.json"));
  };
}

function readmeRouteFactory(subpath) {
  return function readmeRoute(req, res) {
    // console.log("Trying: " + `https://dashboard.hullapp.io/readme?url=https://${req.headers.host}/${subpath}`);
    return res.redirect(
      `https://dashboard.hullapp.io/readme?url=https://${req.headers.host}/${subpath}`
    );
  };
}

function staticRouter(subpath) {
  const applicationDirectory = path.dirname(
    path.join(require.main.filename, "..")
  );
  const router = express.Router();

  router.use(express.static(`${applicationDirectory}/dist`));
  router.use(express.static(`${applicationDirectory}/${subpath}/assets`));

  router.get("/manifest.json", manifestRouteFactory(`${applicationDirectory}/${subpath}`));
  router.get("/", readmeRouteFactory(subpath));
  router.get("/readme", readmeRouteFactory(subpath));

  return router;
}

module.exports = staticRouter;
