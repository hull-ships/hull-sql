const assert = require("assert");

import fs from "fs";
import SyncAgent from "../server/sync-agent";
import ClientMock from "./client-mock";

describe("runQuery job", () => {
  const shipId = "ship-id-4321";
  const ship = {
    id: shipId,
    private_settings: {
      db_type: "filesystem",
      output_type: "filesystem"
    },
  };
  const query = "tests/fixtures/query-data.json";

  const job = {};

  it("should run the query and return correct result", (done) => {
    const client = ClientMock();
    const agent = new SyncAgent({ ship, client, job });

    agent.runQuery(query).then(result => {
      const data = fs.readFileSync(query, { encoding: "utf8" });

      assert.equal(result.entries.toString(), data);
    }).then(done);
  });
});
