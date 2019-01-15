/**
 * Module dependencies.
 */
import snowflake from "snowflake-sdk";
import Promise from "bluebird";
import SequelizeUtils from "sequelize/lib/utils";

/**
 * SnowFlake adapter.
 */

/**
 * Open a new connection.
 *
 * @param {Object} settings The ship settings.
 *
 */
export function openConnection(settings) {
  // Must specify region even though it's supposed to be deprecated
  // Known issue with nodejs sdk (today is Jan 15 2019)
  // https://stackoverflow.com/questions/54129786/snowflake-dw-conncetion-with-node-js-driver
  const conf = {
    account: settings.db_account,
    region: settings.db_region,
    username: settings.db_user,
    password: settings.db_password,
    database: settings.db_name
  };
  return snowflake.createConnection(conf);
}

/**
 * Close the connection.
 */
export function closeConnection(client) {
  if (!client.isUp()) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => client.destroy((err, conn) => {
    return err ? reject(err) : resolve(conn);
  }));
}

/**
 * Validate Result specific for database
 * @returns Array of errors
 */

export function validateResult(result, import_type = "users") {
  // return validateResultColumns(result.columns.map(column => column.name), import_type);
  // TODO
  return {};
}

/**
 *
 * @param error from database connector
 * @returns {{errors: Array}}
 */

export function checkForError(error) {
  // console.warn("TODO: Implement checkForError");
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
 * @param client The SnowFlake client.
 * @param {string} query The query to execute.
 * @param {Object} options The options.
 *
 * @returns {Promise} A promise object of the following format: { rows }
 */
export function runQuery(client, query, options = {}) {
  return new Promise((resolve, reject) => {
    // Connect the connection.
    client.connect((connectionError) => {
      if (connectionError) {
        connectionError.status = 401;
        return reject(connectionError);
      }
      const sqlText = `${query} LIMIT ${options.limit || 100}`;

      return client.execute({
        sqlText,
        complete: (queryError, stmt, rows) => {
          if (queryError) {
            queryError.status = 400;
            return reject(queryError);
          }
          return resolve({ rows });
        } });
    });
  });
}

/**
 * Creates a readable stream that contains the query result.
 * @param client The SnowFlake client.
 * @param {string} query The query to execute.
 * @param {Object} options The options.
 *
 * @returns {Promise} A promise object that wraps a stream.
 */
export function streamQuery(client, query) {
  return new Promise((resolve, reject) => {
    // Connect the connection.
    client.connect((connectionError) => {
      if (connectionError) {
        connectionError.status = 401;
        return reject(connectionError);
      }

      return client.execute({
        sqlText: query,
        streamResult: true,
        complete: (queryError, stmt) => {
          if (queryError) {
            queryError.status = 400;
            return reject(queryError);
          }
          return resolve(stmt.streamRows());
        } });
    });
  });
}
