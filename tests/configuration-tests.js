/* eslint-env node, mocha */

const assert = require("assert");

import express from "express";
import http from "http";
import Hull from "hull";
import { Cache, Queue } from "hull/lib/infra";
import Server from "../server/server";

/* Test Configuration */

const port = 8071;
const app = express();
const cache = new Cache({
  store: "memory",
  ttl: 1
});
const queue = new Queue("kue", {
  prefix: process.env.KUE_PREFIX || "hull-sql",
  redis: process.env.REDIS_URL
});
const connector = new Hull.Connector({ port, cache, queue });
const options = { connector, app, queue };

const query = "";

connector.setupApp(app);

app.use((req, res, next) => {
  req.hull.ship = {
    private_settings: {
      db_type: "filesystem",
      output_type: "filesystem",
      query,
      db_host: "localhost",
      db_port: "5433",
      db_name: "hullsql",
      db_user: "hullsql",
      db_password: "hullsql"
    }
  };
  req.hull.client = {
    logger: {
      error: () => {}
    }
  };
  next();
});

connector.startApp(Server(options));


describe("Configuration", () => {
  it("should check configuration on /run endpoint", (done) => {
    const postData = JSON.stringify({
      query
    });

    const requestOptions = {
      host: "localhost",
      port,
      method: "POST",
      path: "/run",
      headers: {
        "Content-Type": "application/json",
      }
    };

    const req = http.request(requestOptions, (res) => {
      res.setEncoding("utf-8");
      console.log("status code:", res.statusCode);
      assert(res.statusCode === 403);
      let respContent = "";

      res.on("data", chunk => {
        respContent += chunk.toString();
      });

      res.on("end", () => {
        console.log(respContent);
        done();
      });
    });

    req.write(postData);
    req.end();
  });
});
