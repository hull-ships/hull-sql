/* eslint-env node, mocha */

const assert = require("assert");

import _ from "lodash";
import fs from "fs";
import path from "path";
import sinon from "sinon";
import SyncAgent from "../server/lib/sync-agent";
import ClientMock from "./client-mock";

describe("Batch SQL import jobs", () => {
  const extractsDir = "tests/extracts";
  const shipId = "ship-id-1234";
  const ship = {
    id: shipId,
    private_settings: {
      db_type: "filesystem",
      output_type: "filesystem",
      query: "tests/fixtures/batch-data.json",
      db_host: "localhost",
      db_port: "5433",
      db_name: "hullsql",
      db_user: "hullsql",
      db_password: "hullsql"
    },
  };
  const metric = {
    increment: () => {}
  };


  const job = {};

  beforeEach(() => {
    if (!fs.existsSync(extractsDir)) {
      fs.mkdirSync(extractsDir);
    }
    fs.readdir(extractsDir, (err, files) => {
      for (const file of files) {
        fs.unlink(path.join(extractsDir, file), (e) => {
          console.error(e);
        });
      }
    });
  });

  it("should read file", (done) => {
    const client = ClientMock();
    const agent = new SyncAgent({ ship, client, job, metric, batchSize: 2 });

    const createJob = sinon.spy(client, "post").withArgs("/import/users");
    const updateShip = sinon.spy(client.utils.settings, "update");
    const metricIncrement = sinon.spy(metric, "increment");


    agent.startImport().then(() => {
      // Make sure jobs created
      assert(createJob.calledTwice);
      assert(createJob.parent.firstCall.args[1].name.match(/part 1/));
      assert(createJob.parent.secondCall.args[1].name.match(/part 2/));

      assert(updateShip.calledOnce);

      assert(metricIncrement.calledOnce);
      assert.equal(metricIncrement.firstCall.args[0], "ship.incoming.users");
      assert.equal(metricIncrement.firstCall.args[1], 3);


      // Make sure files where extracted
      const files = fs.readdirSync(extractsDir);
      assert.equal(files.length, 2);
      files.forEach((file) => {
        fs.readFile(path.join(extractsDir, file), (err, buf) => {
          const data = buf.toString();
          if (_.endsWith(file, "1.json")) {
            assert.equal(data.match(/,/g || []).length, 2);
          } else if (_.endsWith(file, "2.json")) {
            assert.equal(data.match(/,/g || []).length, 1);
          }
        });
      });
    }).then(done);
  });
});
