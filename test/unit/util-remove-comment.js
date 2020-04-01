/* global describe, it */
import {
  expect,
} from "chai";
import removeComments from "../../server/lib/utils/parse-comments";

describe("Utils functions", () => {
  var env;

  // mocking an environment
  before(function () {
    env = process.env;
    process.env = { DELETE_COMMENTS: true };
  });

  // restoring everything back
  after(function () {
    process.env = env;
  });

  it("should remove comments properly on simple comments in query", () => {
    process.env = { DELETE_COMMENTS: true };
    let testQuery = "-- test comment\n" +
                    "SELECT * from users\n" +
                    "-- test end";
    testQuery = removeComments(testQuery, {}, { logger: { debug: () => {} } });

    expect(testQuery).to.be.equal("\nSELECT * from users\n");
  });
  it("should remove comments properly on simple block comments in query", () => {
    let testQuery = "SELECT employee_id, last_name\n" +
                    "/*\n" +
                    " * Author: Nobody\n" +
                    " * Purpose: Something\n" +
                    " */\n" +
                    "FROM employees\n" +
                    "/* test comment */";
    testQuery = removeComments(testQuery, {}, { logger: { debug: () => {} } });

    expect(testQuery).to.be.equal("SELECT employee_id, last_name\n" +
                                  "\n" +
                                  "FROM employees\n");
  });
  it("should remove comments properly on nested comments in query", () => {
    let testQuery = "/* test /* comment */ */\n" +
                    "SELECT /* something /* not /* useful /* at /* all */ */ */ */ */* from users\n" +
                    "/* test end */";
    testQuery = removeComments(testQuery, {}, { logger: { debug: () => {} } });

    expect(testQuery).to.be.equal("\nSELECT * from users\n");
  });
  it("should keep the query as it is when comments are in a string literal", () => {
    let testQuery = "SELECT '/* something /* not /* useful /* at /* all */ */ */ */ */'users as \"fi/*el*/d\" from " +
                    "users\n\"test\"";
    testQuery = removeComments(testQuery, {}, { logger: { debug: () => {} } });

    expect(testQuery).to.be.equal("SELECT '/* something /* not /* useful /* at /* all */ */ */ */ */'users as \"fi/*el*/d\" from users\n" +
                                  "\"test\"");
  });
  it("should throw an error when comments in query are not valid", () => {
    const testQuery = "/* failing /* */ /* test comment */\n" +
                      "SELECT * from users\n" +
                      "/* test end */";

    expect(() => { removeComments(testQuery, {}, { logger: { debug: () => {} } }); }).to.throw();
  });
  it("should throw an error with a bit of every type of possible comments", () => {
    let testQuery =
      "[select /* block comment */ top 1 'a' /* block comment /* nested block comment */*/ from  sys.tables --LineComment\n" +
      "union\n" +
      "select top 1 '/* literal with */-- lots of comments symbols' from sys.tables --FinalLineComment]\n" +
      "[create table [/*] /* \n" +
      "  -- huh? */\n" +
      "(\n" +
      "    \"--\n" +
      "     --\" integer identity, -- /**/\n" +
      "    [*/] varchar(20) /* -- */\n" +
      "         default '*/ /* -- */' /* /* /* */ */ */\n" +
      ");\n" +
      "            go]";

    testQuery = removeComments(testQuery, {}, { logger: { debug: () => {} } });
    expect(testQuery).to.be.equal(
      "[select  top 1 'a'  from  sys.tables \n" +
      "union\n" +
      "select top 1 '/* literal with */-- lots of comments symbols' from sys.tables \n" +
      "[create table [] varchar(20) \n" +
      "         default '*/ /* -- */' \n" +
      ");\n" +
      "            go]"
    );
  });
});
