/**
 * Module dependencies.
 */
import jsforce from "jsforce";
import csv from "csv-stream";
import Promise from "bluebird";
import SequelizeUtils from "sequelize/lib/utils";
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
export function _openConnection(settings) {
  const conn = new jsforce.Connection({
    loginUrl: settings.instance_url
  });
  return new Promise((resolve, reject) => {
    conn.login(settings.username, settings.password + settings.security_token, (err, res) => {
      if (err) {
        console.error(err);
        return reject(err);
      }
      return resolve(conn);
    });
  })
}


export function openConnection(settings) {
  const params = {
    oauth2 : {
      clientId : process.env.SALESFORCE_CLIENT_ID,
      clientSecret : process.env.SALESFORCE_CLIENT_ID
    },
    instanceUrl : settings.instance_url,
    accessToken : settings.access_token,
    refreshToken : settings.refresh_token
  };

  const conn = new jsforce.Connection(params);

  conn.on("refresh", function(accessToken, res) {
    // Refresh event will be fired when renewed access token
    // to store it in your storage for next request
    console.warn("---------------->>> refreshed !", { accessToken, res });
  });

  // Alternatively, you can use the callback style request to fetch the refresh token
  conn.oauth2.refreshToken(settings.refresh_token, (err, results) => {
    console.warn("------------------------------------> refresh", {
      err, results
    });
  });

  console.warn("SFDC connection params", { settings, params });

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
    const soqlText = query; //`${query} LIMIT ${options.limit || 100}`;
    client.query(soqlText, (err, result) => {
      if (err) return reject(err);
      return resolve({ rows: result.records });
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
  // var options = {
  //     delimiter : '\t', // default is ,
  //     endLine : '\n', // default is \n,
  //     columnOffset : 2, // default is 0
  //     escapeChar : '"', // default is an empty string
  //     enclosedChar : '"' // default is an empty string
  // }

  const options = {};
  var csvStream = csv.createStream(options);

  return new Promise((resolve, reject) => {
    resolve(client.bulk.query(query).stream().pipe(csvStream));
  });
}
