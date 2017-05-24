/**
 * Module dependencies.
 */

import Promise from "bluebird";
import fs from "fs";
import JSONStream from "JSONStream";

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

export function openConnection() {}

/**
 * Close the connection.
 *
 * Params:
 *   @client Instance
 */

export function closeConnection() {}

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

export function wrapQuery(query) {
  return query;
}

export function cancelQuery() {}

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

export function runQuery(client, query = {}) {
  return new Promise((resolve) => {
    const file = fs.readFileSync(query, { encoding: "utf8" });
    resolve({ rows: file });
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

export function streamQuery(client, query) {
  return new Promise((resolve) => {
    const stream = fs.createReadStream(query).pipe(JSONStream.parse());
    resolve(stream);
    return stream;
  });
}

export function upload(users, shipId, partNumber) {
  const data = users.map(user => JSON.stringify(user)).join("\n");
  return new Promise((resolve, reject) => {
    const filename = `tests/extracts/${new Date().getTime()}-${partNumber}.json`;
    fs.writeFile(filename, data, (err) => {
      if (err) {
        return reject(err);
      }
      return resolve({ url: `http://fake.url/${filename}`, partNumber, size: users.length });
    });
  });
}
