require("babel-register")({ presets: ["es2015", "stage-0"] });
require("./batch-job-tests");
require("./query-tests");
require("./endpoints-tests");