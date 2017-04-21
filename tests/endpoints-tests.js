const assert = require("assert");

import express from "express";
import http from "http";
import fs from "fs";
import Hull from "hull";
import { Cache } from "hull/lib/infra";
import Server from "../server/server"

/* Test Configuration */

const port = 8080;
const app = express();
const cache = new Cache({
  store: "memory",
  ttl: 1
});
const connector = new Hull.Connector({ port, cache });
const options = { connector, app };

const query = "tests/fixtures/query-data.json";

connector.setupApp(app);

app.use((req, res, next) => {
  req.hull.ship = {
    private_settings: {
      db_type: "filesystem",
      output_type: "filesystem",
      query
    }
  };

  next();
});

connector.startApp(Server(options));


describe("Server", () => {
  it("should return status OK on /run endpoint", (done) => {
    const postData = JSON.stringify({
      query
    });

    let requestOptions = {
      host: "localhost",
      port,
      method: "POST",
      path: "/run",
      headers: {
        'Content-Type': 'application/json', //todo check it
        'Content-Length': Buffer.byteLength(postData)
      }
    };


    const req = http.request(requestOptions, (res) => {
        res.setEncoding('utf-8');
        assert(res.statusCode === 200);
        let respContent = '';

        res.on('data', function (chunk) {
          respContent += chunk.toString();
        });

        res.on('end', function () {
          const data = fs.readFileSync(query);
          assert.equal(JSON.parse(respContent).entries.toString(), data.toString());
          done();
        });

      }
    );

    req.write(postData);
    req.end();
  });

  it("should return status OK for /admin.html endpoint", (done) => {
    http.get("http://localhost:" + port + "/admin.html", (res) => {
        assert(res.statusCode === 200);
        done();
      }
    )
  });

});