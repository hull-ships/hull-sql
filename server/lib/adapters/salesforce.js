/**
 * Module dependencies.
 */
import jsforce from "jsforce";
import csv from "csv-stream";
import Promise from "bluebird";
import SequelizeUtils from "sequelize/lib/utils";
import through2 from "through2";
import validateResultColumns from "./validate-result-columns";
import _ from "lodash";
/**
 * Salesforce adapter.
 */

/**
 * Open a new connection.
 *
 * @param {Object} settings The ship settings.
 *
 */
export function openConnection(settings) {
  const params = {
    oauth2 : {
      clientId : process.env.SALESFORCE_CLIENT_ID,
      clientSecret : process.env.SALESFORCE_CLIENT_SECRET
    },
    instanceUrl : settings.instance_url,
    accessToken : settings.access_token,
    refreshToken : settings.refresh_token
  };

  // TODO: Add suport for refreshing tokens
  const conn = new jsforce.Connection(params);

  return conn;
}

export function getRequiredParameters() {
  return ["access_token", "refresh_token", "instance_url"];
}

export function isValidConfiguration(settings) {
  // TODO: Add more validation here
  return true;
}

/**
 * Close the connection.
 */
export function closeConnection(client) {
  return Promise.resolve();
}

/**
 * Validate Result specific for database
 * @returns Array of errors
 */

export function validateResult(result, import_type = "users") {
  if (!result.rows || result.rows.length === 0) {
    return "Try to select a preview query which will return some results to validate";
  }
  return validateResultColumns(Object.keys(result.rows[0]), import_type);
}

/**
 *
 * @param error from database connector
 * @returns {{errors: Array}}
 */

export function checkForError(error) {
  // default behavior is to check for a "message" and bubble it up which is correct
  return false;
}

/**
 * Wrap the user query inside a SQL query.
 *
 * @param {*} sql The raw SQL query
 * @param {*} replacements The replacement parameters
 */
export function wrapQuery(sql, replacements) {
  return SequelizeUtils.formatNamedParameters(sql, replacements, "mysql");
}

function conformRecord(record) {
  // TODO: check if we want to lowercase the column names here
  return _.reduce(record, (m,v,k) => {
    if (k === 'attributes') return m;
    m[k.toLowerCase()] = v;
    return m;
  }, {})
}

/**
 * Runs the query using the specified client and options.
 * @param client The Salesforce client.
 * @param {string} query The query to execute.
 * @param {Object} options The options.
 *
 * @returns {Promise} A promise object of the following format: { rows }
 */
export function runQuery(client, query, options = {}) {
  return new Promise((resolve, reject) => {
    const soqlText = `${query} LIMIT ${options.limit}`;
    client.query(soqlText, (err, result) => {
      if (err) return reject(err);
      return resolve({ rows: result.records.map(conformRecord) });
    });
  });
}

/**
 * Creates a readable stream that contains the query result.
 * @param client The Salesforce client.
 * @param {string} query The query to execute.
 * @param {Object} options The options.
 *
 * @returns {Promise} A promise object that wraps a stream.
 */
export function streamQuery(client, query) {
  const options = {
    escapeChar : '"',
    enclosedChar : '"'
  };

  const csvStream = csv.createStream(options);

  return new Promise((resolve, reject) => {
    const stream = client.bulk
      .query(query)
      .stream()
      .pipe(csvStream)
      .pipe(through2({ objectMode: true, highWaterMark: 10 }, (row, enc, callback) => {
        const conformed = conformRecord(row);
        return callback(null, conformRecord(row));
      }));

    return resolve(stream);
  });
}
