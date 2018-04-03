/**
 * Module dependencies.
 */
const Promise = require("bluebird");
const fs = require("fs");
const JSONStream = require("JSONStream");
const Stream = require("stream");
const through2 = require("through2");

const validateResultColumns = require("./validate-result-columns");
const postgresAdapter = require("./postgres");

/**
 * File system adapter.
 */

/**
 * Open a new connection.
 *
 * Params:
 *   @connection_string String*
 *
 * Return:
 *   @client Instance
 */

function openConnection() {}

/**
 * Close the connection.
 *
 * Params:
 *   @client Instance
 */

function closeConnection() {}

/**
 * Wrap the user query
 * inside a PostgreSQL request.
 *
 * Params:
 *   @query String*
 *   @last_updated_at String
 *
 * Return:
 *   @wrappedQuery String
 */

function wrapQuery(query) {
  return query;
}

/**
 * Validate Result specific for filesystem adapter
 * @returns Array of errors
 */

function validateResult(result, import_type = "users") {
  if (process.env.POSTGRES_DATABASE_TEST !== "true") {
    return validateResultColumns(result.columns.map(column => column.name), import_type);
  }
  return postgresAdapter.validateResult(result);
}

function checkForError() {
  return false;
}

function cancelQuery() {}

/**
 * Run a wrapped query.
 *
 * Params:
 *   @client Instance*
 *   @wrappedQuery String*
 *   @callback Function*
 *
 * Return:
 *   @callback Function
 *     - @error Object
 *     - @rows Array
 */

function runQuery(client, query = {}) {
  return new Promise((resolve) => {
    const file = fs.readFileSync(query, { encoding: "utf8" });
    const result = JSON.parse(file);
    resolve(result);
  });
}

/**
 * Stream a wrapped query.
 *
 * Params:
 *   @client Instance*
 *   @wrappedQuery String*
 *   @callback Function*
 *
 * Return:
 *   @callback Function
 *     - @error Object
 *     - @stream Stream
 */

function streamQuery(client, query) {
  return new Promise((resolve) => {
    const stream = fs.createReadStream(query).pipe(JSONStream.parse());
    resolve(stream);
    return stream;
  });
}

function upload(shipId, partNumber) {
  const stream = new Stream.PassThrough();
  const promise = new Promise((resolve, reject) => {
    const filename = `test/extracts/${new Date().getTime()}-${partNumber}.json`;
    const writeStream = fs.createWriteStream(filename);
    let size = 0;
    writeStream.on("close", (err) => {
      if (err) {
        return reject(err);
      }
      return resolve({ url: `http://fake.url/${filename}`, partNumber, size });
    });
    stream
      .pipe(through2((chunk, enc, callback) => {
        size += 1;
        callback(null, chunk);
      }))
      .pipe(writeStream);
  });
  return { promise, stream };
}


module.exports = {
  validateResultColumns,
  openConnection,
  closeConnection,
  wrapQuery,
  validateResult,
  checkForError,
  cancelQuery,
  runQuery,
  streamQuery,
  upload
};
