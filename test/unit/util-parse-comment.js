/* global describe, it */
import {
  expect,
} from "chai";
import parseComments from "../../server/lib/utils/parse-comments";

describe("Parse comments", () => {
  var env;

  // mocking an environment
  before(function () {
    env = process.env;
    process.env = { DELETE_COMMENTS: false };
  });

  // restoring everything back
  after(function () {
    process.env = env;
  });

  it("should ignore comments and variables defined inside a query", () => {
    let testQuery = "-- test comment\n" +
                    "SELECT * from users\n" +
                    "-- test end :test";
    testQuery = parseComments(testQuery, { test: "blahblah" }, { logger: { debug: () => {} } });

    expect(testQuery).to.be.equal("-- test comment\n" +
                                  "SELECT * from users\n" +
                                  "-- test end :test");
  });

  it("should throw an error when invalid variables are found in comments", () => {
    const testQuery = "/* failing */ /* test comment */\n" +
                      "SELECT * from users\n" +
                      "/* test end :whatsthat */";

    expect(() => { parseComments(testQuery, { test: "fail" }, { logger: { debug: () => {} } }); }).to.throw();
  });
});
