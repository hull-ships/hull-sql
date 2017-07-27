/* global describe, it */
import { expect, should } from "chai";
import sinon from "sinon";
import moment from "moment";

import * as postgresAdapter from "../../server/lib/adapters/postgres";

describe("Postgres Adapter", () => {

  it("should replace import_start_date in query", () => {
    const wrappedQuery = postgresAdapter.wrapQuery("SELECT :import_start_date", {
      import_start_date: moment().format()
    });

    expect(wrappedQuery).to.be.equal(`WITH __qry__ AS (SELECT '${moment().format()}') SELECT * FROM __qry__`);
  });
});
