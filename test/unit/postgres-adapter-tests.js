/* global describe, it */
const { expect } = require("chai");
const moment = require("moment");

const postgresAdapter = require("../../server/lib/adapters/postgres");

describe("Postgres Adapter", () => {
  it("should replace import_start_date in query", () => {
    const wrappedQuery = postgresAdapter.wrapQuery("SELECT :import_start_date", {
      import_start_date: moment().format()
    });

    expect(wrappedQuery).to.be.equal(`WITH __qry__ AS (SELECT '${moment().format()}') SELECT * FROM __qry__`);
  });
});
