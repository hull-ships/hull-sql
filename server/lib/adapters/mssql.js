/**
 * Module dependencies.
 */
import tedious from "tedious";
import Promise from "bluebird";
import _ from "lodash";
import Readable from "readable-stream";
import SequelizeUtils from "sequelize/lib/utils";
import validateResultColumns from "./validate-result-columns";

/**
 * MS SQL adapter.
 */


export function parseConnectionConfig(settings) {
  const conn = ["type", "host", "port", "name", "user", "password"].reduce((c, key) => {
    const val = settings[`db_${key}`];
    // if (c && val && val.length > 0) {
    //   return { ...c, [key]: val };
    // }
    if (c && val && (val.length > 0 || (key === "port" && _.isNumber(val)))) {
      return { ...c, [key]: val };
    }
    // TODO Not sure what the intention was here, returning false will make this the next c, seems wrong
    // but maybe that was the intention if a value ever isn't something we expect?
    return false;
  }, {});
  // Must-have options
  let opts = {
    port: conn.port || 1433,
    database: conn.name
  };
  // All additional options are optional
  if (settings.db_options) {
    try {
      const customOptions = JSON.parse(settings.db_options);
      if (customOptions) {
        opts = _.merge(opts, customOptions);
      }
    } catch (parseError) {
      console.error("config.error", parseError);
    }
  }

  const config = {
    userName: conn.user,
    password: conn.password,
    server: conn.host,
    options: opts
  };

  return config;
}
/**
 * Open a new connection.
 *
 * @param {Object} settings The ship settings.
 *
 * @return {tedious.Connection} The tedious.Connection instance
 */
export function openConnection(settings) {
  const config = parseConnectionConfig(settings);
  return new tedious.Connection(config);
}

/**
 * Close the connection.
 *
 * @param {tedious.Connection} client The MSSQL client
 */
export function closeConnection(client) {
  client.close();
}

/**
 * Validate Result specific for mssql database
 * @returns Array of errors
 */

export function validateResult(result, import_type = "users") {
  return validateResultColumns(result.columns.map(column => column.colName), import_type);
}

/**
 *
 * @param error from database connector
 * @returns {{errors: Array}}
 */

export function checkForError(error) {
  if (error && (error.code === "EREQUEST")) {
    return { message: `Invalid Syntax: ${_.get(error, "message", "")}` };
  }

  if (error && (error.code === "ESOCKET")) {
    return { message: `Server Error: ${_.get(error, "message", "")}` };
  }

  return false;
}

/**
 * Wrap the user query inside a MS SQL request.
 *
 * @param {*} sql The raw SQL query
 * @param {*} replacements The replacement parameters
 */
export function wrapQuery(sql, replacements) {
  return SequelizeUtils.formatNamedParameters(sql, replacements, "mssql");
}

/**
 * Runs the query using the specified client and options.
 * @param {tedious.Connection} client The MS SQL client.
 * @param {string} query The query to execute.
 * @param {Object} options The options.
 *
 * @returns {Promise} A promise object of the following format: { rows }
 */
export function runQuery(client, query, options) {
  const limit = options.limit || 100;
  const opts = _.omit(options, "limit");

  return new Promise((resolve, reject) => {
    const confoptions = _.merge(client.config.options, opts);
    const conf = _.cloneDeep(client.config);
    conf.options = confoptions;

    let conn = new tedious.Connection(conf);

    conn.on("connect", (err) => { // eslint-disable-line consistent-return
      if (err) {
        if (err.message && err.message.includes("ECONNRESET")) {
          // This is an error caused by the Azure Load Balancer that is not really an error,
          // we can recover from it pretty easily by simply reconnecting.
          // See https://github.com/tediousjs/tedious/issues/300
          try {
            conn.close();
          } finally {
            // if the connection has been already closed, the call above will result in an error
            // but we can recover here:
            conn = new tedious.Connection(conf);
          }
        }
        return reject(err);
      }

      const qparam = `WITH __qry__ AS (${query}) SELECT TOP(${limit}) * FROM __qry__`;

      const request = new tedious.Request(qparam, (reqError) => { // eslint-disable-line consistent-return
        if (reqError) {
          return reject(reqError);
        }
      });

      const rows = [];
      let columnNames = [];
      let resultReturned = false;
      let columnsReturned = false;

      request.on("row", (columns) => {
        const row = {};
        _.forEach(columns, (column) => {
          row[column.metadata.colName] = column.value;
        });
        rows.push(row);
      });

      request.on("done", (rowCount) => { // eslint-disable-line consistent-return
        if (_.isNumber(rowCount) && !resultReturned && columnsReturned) {
          resultReturned = true;
          return resolve({
            rows, columns: columnNames
          });
        }
      });

      request.on("doneInProc", (rowCount) => { // eslint-disable-line consistent-return
        if (_.isNumber(rowCount) && !resultReturned && columnsReturned) {
          resultReturned = true;
          return resolve({
            rows, columns: columnNames
          });
        }
      });

      request.on("doneProc", (rowCount) => { // eslint-disable-line consistent-return
        if (_.isNumber(rowCount) && !resultReturned && columnsReturned) {
          resultReturned = true;
          return resolve({
            rows, columns: columnNames
          });
        }
      });

      request.on("columnMetadata", (columns) => {
        columnNames = columns;
        columnsReturned = true;
      });

      conn.execSql(request);
    });
  });
}

/**
 * Creates a readable stream that contains the query result.
 * @param {tedious.Connection} client The MS SQL client.
 * @param {string} query The query to execute.
 * @param {Object} options The options.
 *
 * @returns {Promise} A promise object that wraps a stream.
 */
export function streamQuery(client, query, options = {}) {
  return new Promise((resolve) => {
    const confoptions = _.merge(client.config.options, options);
    const conf = _.cloneDeep(client.config);
    conf.options = confoptions;
    const conn = new tedious.Connection(conf);

    const streamOpts = {};
    streamOpts.objectMode = true;
    streamOpts.highWaterMark = 10;
    const stream = new Readable(streamOpts);

    let resultReturned = false;

    stream._read = function () { // eslint-disable-line func-names
      conn.on("connect", (err) => { // eslint-disable-line consistent-return
        if (err) {
          stream.emit("error", err);
        }

        const request = new tedious.Request(query, (reqError) => { // eslint-disable-line consistent-return
          if (reqError) {
            stream.emit("error", reqError);
          }
        });

        request.on("row", (columns) => {
          const row = {};
          _.forEach(columns, (column) => {
            row[column.metadata.colName] = column.value;
          });
          stream.push(row);
        });

        request.on("done", (rowCount) => { // eslint-disable-line consistent-return
          if (_.isNumber(rowCount) && !resultReturned) {
            resultReturned = true;
            stream.push(null);
          }
        });

        request.on("doneInProc", (rowCount) => { // eslint-disable-line consistent-return
          if (_.isNumber(rowCount) && !resultReturned) {
            resultReturned = true;
            stream.push(null);
          }
        });

        request.on("doneProc", (rowCount) => { // eslint-disable-line consistent-return
          if (_.isNumber(rowCount) && !resultReturned) {
            resultReturned = true;
            stream.push(null);
          }
        });

        conn.execSql(request);
      });
    };

    stream.once("end", () => {
      process.nextTick(() => {
        stream.emit("close");
      });
    });
    return resolve(stream);
  });
}
