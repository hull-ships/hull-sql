const assert = require("assert");

import _ from "lodash";
import fs from "fs";
import path from "path";
import SyncAgent from "../server/sync-agent";

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
  const client = {
    configuration: identity,
    logger: {
      info: (...args) => console.log(...args),
      error: (...args) => console.log(...args),
      debug: (...args) => console.log(...args),
      log: (...args) => console.log(...args)
    },
  };
  const job = {};

  beforeEach(() => {
    if (!fs.existsSync(extractsDir)) {
      fs.mkdirSync(extractsDir);
    }
    fs.readdir(extractsDir, (err, files) => {
      for (const file of files) {
        fs.unlink(path.join(extractsDir, file), (err) => {
          console.error(err.message);
        });
      }
    });
  });

  it("should read file", () => {
    const agent = new SyncAgent({ ship, client, job, batchSize: 2 });

    agent.startImport();

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
  });
});
