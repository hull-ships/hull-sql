/* eslint-env node, mocha */

const assert = require("assert");

import express from "express";
import http from "http";
import fs from "fs";
import Hull from "hull";
import { Cache, Queue } from "hull/lib/infra";
import Server from "../server/server";

/* Test Configuration */

const port = 8070;
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
const options = { connector, queue };

const query = "tests/fixtures/query-data.json";

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

  next();
});
Server(app, options);
connector.startApp(app);


describe("Server", () => {
  it("should return status OK on /run endpoint", (done) => {
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
        "Content-Length": Buffer.byteLength(postData)
      }
    };

    const req = http.request(requestOptions, (res) => {
      res.setEncoding("utf-8");
      assert(res.statusCode === 200);
      let respContent = "";

      res.on("data", chunk => {
        respContent += chunk.toString();
      });

      res.on("end", () => {
        const data = fs.readFileSync(query);
        assert.equal(JSON.parse(respContent).entries.toString(), data.toString());
        done();
      });
    });

    req.write(postData);
    req.end();
  });

  it("should return status OK for /admin.html endpoint", (done) => {
    http.get(`http://localhost:${port}/admin.html`, (res) => {
      assert(res.statusCode === 200);
      done();
    }
    );
  });
});
