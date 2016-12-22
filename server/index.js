/* eslint global-require: 0 */
if (process.env.NEW_RELIC_LICENSE_KEY) {
  console.warn("Starting newrelic agent with key: ", process.env.NEW_RELIC_LICENSE_KEY);
  require("newrelic");
}

const Hull = require("hull");
const Server = require("./server");


// Configure AWS
const Aws = require("aws-sdk");
Aws.config.update({
  accessKeyId: process.env.AWS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_KEY
});

const PORT = process.env.PORT || 8082;

if (process.env.LOG_LEVEL) {
  Hull.logger.transports.console.level = process.env.LOG_LEVEL;
}

const options = {
  Hull,
  hostSecret: process.env.SECRET || "1234",
  devMode: process.env.NODE_ENV === "development"
};


const app = Server(options);


console.log(`Listening on port ${PORT}`);
app.listen(PORT);
