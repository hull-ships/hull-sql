const assert = require("assert");

import _ from "lodash";
import fs from "fs";
import path from "path";
import SyncAgent from "../server/sync-agent";
import sinon from "sinon";

function identity() {}

describe("Batch SQL import jobs", () => {
  const extractsDir = "tests/extracts";
  const shipId = "ship-id-1234";
  const ship = {
    id: shipId,
    private_settings: {
      db_type: "filesystem",
      output_type: "filesystem",
      query: "tests/fixtures/data.json",
    },
  };

  function getMockClient() {
    return {
      configuration: identity,
      logger: {
        info: (msg, data) => console.log(msg, data),
        error: (msg, data) => console.log(msg, data),
        debug: (msg, data) => console.log(msg, data),
        log: (msg, data) => console.log(msg, data)
      },
      get: (url, params) => {
        return Promise.resolve({});
      },
      post: (url, params) => {
        return Promise.resolve({});
      },
      put: (url, params) => {
        return Promise.resolve({});
      }
    };

  }

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
    const client = getMockClient();
    const agent = new SyncAgent({ ship, client, job, batchSize: 2 });

    const createJob = sinon.spy(client, "post").withArgs("/import/users");
    const updateShip = sinon.spy(client, "put").withArgs(ship.id);


    agent.startImport().then(() => {
      // Make sure jobs created
      assert(createJob.calledTwice);
      assert(createJob.firstCall.args[1].name.match(/part 1/));
      assert(createJob.secondCall.args[1].name.match(/part 2/));

      assert(updateShip.calledOnce);


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
