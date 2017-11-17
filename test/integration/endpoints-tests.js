/* eslint-env node, mocha */

import assert from "assert";
import http from "http";
import fs from "fs";
import bootstrap from "./support/bootstrap";

describe("Server", () => {
  it("should return status OK on /run endpoint", (done) => {
    const query = "test/fixtures/query-data.json";
    const queryResult = "test/fixtures/query-data-result.json";
    const port = 8070;
    const postData = JSON.stringify({
      query
    });
    bootstrap(query, port);

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
        const data = fs.readFileSync(queryResult, { encoding: "utf8" });
        assert(data.includes(JSON.stringify(JSON.parse(respContent).entries)));
        done();
      });
    });

    req.write(postData);
    req.end();
  });

  it("should return errors if result does not contain required column names for users import", (done) => {
    const port = 8077;
    const query = "test/fixtures/query-data-without-required-columns.json";
    bootstrap(query, port, "users");

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
        assert.equal(JSON.parse(respContent).errors[0], "Column names should include email and/or external_id");
        done();
      });
    });

    req.write(postData);
    req.end();
  });

  it("should return errors if result does not contain required column names for events import", (done) => {
    const port = 8078;
    const query = "test/fixtures/query-events-data-without-required-columns.json";
    bootstrap(query, port, "events");

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
      // console.log({ res });
      assert(res.statusCode === 200);
      let respContent = "";

      res.on("data", chunk => {
        respContent += chunk.toString();
      });

      res.on("end", () => {
        assert.equal(JSON.parse(respContent).errors[0], "Column names should include event, timestamp and external_id or email");
        done();
      });
    });

    req.write(postData);
    req.end();
  });

  it("should return errors if result contain invalid column names", (done) => {
    const port = 8072;
    const query = "test/fixtures/query-data-with-invalid-columns.json";
    bootstrap(query, port);

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
        assert.equal(JSON.parse(respContent).errors[0], "Following column names should not contain special characters ('$', '.') : name.invalid");
        done();
      });
    });

    req.write(postData);
    req.end();
  });


  it("should return errors if postgres result contain json column", (done) => {
    process.env.POSTGRES_DATABASE_TEST = "true";
    const port = 8079;
    const query = "test/fixtures/postgres-query-data.json";
    bootstrap(query, port);

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
        assert.equal(JSON.parse(respContent).errors[0], "Following columns from postgres database are in json format which is not supported : test");
        process.env.POSTGRES_DATABASE_TEST = "false";
        done();
      });
    });

    req.write(postData);
    req.end();
  });

  it("should return status OK for /admin.html endpoint", (done) => {
    bootstrap("", 8888);
    http.get("http://localhost:8888/admin.html", (res) => {
      assert(res.statusCode === 200);
      done();
    });
  });
});
