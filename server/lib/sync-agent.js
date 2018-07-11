/**
 * Module dependencies.
 */
const _ = require("lodash");
const moment = require("moment");
const ps = require("promise-streams");
const { ConfigurationError } = require("hull/lib/errors");

import uuid from "uuid/v1";

// Map each record of the stream.
const map = require("through2-map");
const through2 = require("through2");

const Adapters = require("./adapters");

const DEFAULT_BATCH_SIZE = parseInt(process.env.BATCH_SIZE || "10000", 10);
const FULL_IMPORT_DAYS = process.env.FULL_IMPORT_DAYS || "10000";

/**
 * Export the sync agent for the SQL ship.
 */
class SyncAgent {

  /**
   * Creates a new SyncAgent instance.
   * @param {*} param0 The configuration for the client.
   */
  constructor({ ship, client, job, metric, batchSize = DEFAULT_BATCH_SIZE }) {
    // Expose the ship settings
    // and the Hull instance.
    this.ship = ship;
    this.hull = client;
    this.job = job;
    this.metric = metric;
    this.batchSize = batchSize;

    this.importDelay = _.random(0, _.get(this.ship.private_settings, "sync_interval", 120));

    const private_settings = this.ship.private_settings;
    this.import_type = private_settings.import_type || "users";
    // Get the DB type.
    const { db_type, output_type = "s3" } = private_settings;
    this.db_type = db_type;
    this.adapter = { in: Adapters[db_type], out: Adapters[output_type] };

    // Make sure the DB type is known.
    // If not, throw an error.
    // Otherwise, use the correct adapter.
    if (!this.adapter.in) {
      throw new ConfigurationError(`Invalid database type ${db_type}.`);
    }
    if (!this.adapter.out) {
      throw new ConfigurationError(`Invalid output type ${output_type}.`);
    }

    try {
      this.client = this.adapter.in.openConnection(private_settings);
    } catch (err) {
      let message;
      const error = this.adapter.in.checkForError(err);
      if (error) {
        message = error.message;
      } else {
        message = `Server Error: ${_.get(err, "message", "")}`;
      }

      client.logger.error("connection.error", { hull_summary: message });
      throw err;
    }
    return this;
  }

  /**
   * Returns whether sync is enabled or not.
   * @return {boolean} True if sync is enabled; otherwise false.
   */
  isEnabled() {
    return this.ship.private_settings.enabled === true;
  }

  /**
   * Returns whether all required connection parameters have been supplied.
   * @return {boolean} True if all parameters are specified; otherwise false.
   */
  areConnectionParametersConfigured() {
    const settings = this.ship.private_settings;
    const conn = ["type", "host", "port", "name", "user", "password"].reduce((c, key) => {
      let val = settings[`db_${key}`];
      if (key === "type" && val === "redshift") val = "postgres";
      if (c && val && val.length > 0) {
        return { ...c,
          [key]: val
        };
      }
      return false;
    }, {});

    return !!conn;
  }

  /**
   * Returns whether the query string has been configured.
   * @return {boolean} True if the query string is set; otherwise false.
   */
  isQueryStringConfigured() {
    return !!this.getQuery();
  }

  /**
   * Returns the SQL query from the ship settings.
   * @return {string} The SQL query string as supplied by the user.
   */
  getQuery() {
    return _.trimEnd(this.ship.private_settings.query, ";");
  }

  /**
   * One time query run for UI preview and status endpoint
   * @param  {string} query
   * @param  {Object} options [description]
   * @return {[type]}         [description]
   */
  runQuery(query, options = {}) {
    // Wrap the query.
    const oneDayAgo = moment().subtract(1, "day").utc();
    const replacements = {
      last_updated_at: options.last_updated_at || oneDayAgo.toISOString(),
      import_start_date: moment().subtract(this.ship.private_settings.import_days, "days").format()
    };
    options.connectionTimeout = 1000;
    options.queryTimeout = 10000;
    const wrappedQuery = this.adapter.in.wrapQuery(query, replacements);
    // Run the method for the specific adapter.
    return this.adapter.in.runQuery(this.client, wrappedQuery, options)
      .then(result => {
        this.adapter.in.closeConnection(this.client);

        const { errors } = this.adapter.in.validateResult(result, this.import_type);
        if (errors && errors.length > 0) {
          return { entries: result.rows, errors };
        }

        return { entries: result.rows };
      })
      .catch((err) => {
        this.adapter.in.closeConnection(this.client);
        return Promise.reject(err);
      });
  }

  startImport(options = {}) {
    this.hull.logger.info("incoming.job.start", { jobName: "sync", type: this.import_type, options });
    const query = this.getQuery();
    const started_sync_at = new Date();
    if (!options.import_days) {
      options.import_days = FULL_IMPORT_DAYS;
    }
    return this.streamQuery(query, options)
      .then(stream => this.sync(stream, started_sync_at))
      .catch(err => {
        let { message } = this.adapter.in.checkForError(err);
        if (!message) {
          message = _.get(err, "message", err);
        }

        this.hull.logger.error("incoming.job.error", { jobName: "sync", hull_summary: message });
        return Promise.reject(err);
      });
  }

  startSync(options = {}) {
    const private_settings = this.ship.private_settings;
    const oneHourAgo = moment().subtract(1, "hour").utc();
    options.import_days = private_settings.import_days;
    const last_updated_at = private_settings.last_updated_at || private_settings.last_sync_at || oneHourAgo.toISOString();
    return this.startImport({ ...options, last_updated_at });
  }

  streamQuery(query, options = {}) {
    const { last_updated_at } = options;
    const replacements = {
      last_updated_at,
      import_start_date: moment().subtract(options.import_days, "days").format()
    };
    // Wrap the query.
    const wrappedQuery = this.adapter.in.wrapQuery(query, replacements);

    this.hull.logger.info("incoming.job.query", { jobName: "sync", query: wrappedQuery, type: this.import_type });

    // Run the method for the specific adapter.
    return this.adapter.in.streamQuery(this.client, wrappedQuery).then(stream => {
      return stream;
    }, err => {
      this.hull.logger.error("incoming.job.error", {
        jobName: "sync",
        errors: _.invoke(err, "toString") || err,
        hull_summary: _.get(err, "message", "Server Error: Error while streaming query from database"),
        type: this.import_type
      });
      err.status = 403;
      throw err;
    });
  }

  /**
   * Stream a wrapped query.
   *
   * Params:
   *   @connection_string String*
   *   @query String*
   *   @callback Function*
   *
   * Return:
   *   @callback Function
   *     - @error Object
   *     - @success Object
   */

  idKey() {
    return this.import_type === "accounts" ? "accountId" : "userId";
  }

  dataKey() {
    return this.import_type === "events" ? "properties" : "traits";
  }

  sync(stream, started_sync_at) {
    let processed = 0;
    let last_updated_at;
    const jobId = _.get(this, "job.id", uuid()); // ID of the job chunk
    const importId = uuid(); // ID of the whole job

    const transform = map({ objectMode: true }, (record) => {
      const data = {}; // data formated to be sent to hull
      processed += 1;

      if (processed % 1000 === 0) {
        const elapsed = new Date() - started_sync_at;
        this.hull.logger.info("incoming.job.progress", { jobId, jobName: "sync", stepName: "query", progress: processed, elapsed, type: this.import_type });
        if (this.job && this.job.queue && this.job.queue.client) {
          try {
            this.job.queue.client.extendLock(this.job.queue, this.job.id);
            this.job.progress(processed);
          } catch (err) {
            this.hull.logger.debug("unsupported.adapter.operation", { errors: err });
            // unsupported adapter operation
          }
        }
      }

      // Add the external_id if exists.
      if (record.external_id) {
        data[this.idKey()] = record.external_id.toString();
      }

      if (record.updated_at) {
        last_updated_at = last_updated_at || record.updated_at;
        if (record.updated_at > last_updated_at) {
          last_updated_at = record.updated_at;
        }
      }

      const omitTraits = ["external_id", "updated_at"];

      // Extract account external_id when linking to users
      if (this.import_type === "users" && record.account_id) {
        data.accountId = record.account_id;
        omitTraits.push("account_id");
      } else if (this.import_type === "events") {
        data.timestamp = record.timestamp;
        data.event = record.event;
        data.eventId = record.event_id;
        omitTraits.push("timestamp", "event", "event_id");
      }

      // Register everything else inside the "traits" object.
      data[this.dataKey()] = _.omit(record, omitTraits);
      return data;
    });

    let numBatches = 1;
    let numUsers = 0;
    let currentStream = null;
    let currentPromise = null;
    const { batchSize, adapter, ship } = this;

    let last_job_id = null;
    return new Promise((resolve, reject) => {
      ps.wait(stream
      .on("error", (err) => {
        this.hull.logger.error("incoming.job.error", {
          jobName: "sync",
          errors: _.invoke(err, "toString") || err,
          hull_summary: _.get(err, "message", "Server Error: Error while streaming query from database"),
          type: this.import_type
        });

        if (stream.close) stream.close();
        this.adapter.in.closeConnection(this.client);
        reject(err);
      })
      .pipe(transform)
      .pipe(through2({ objectMode: true, highWaterMark: 10 }, function rotate(user, enc, callback) {
        try {
          if (currentStream === null || numUsers % batchSize === 0) {
            numBatches += 1;
            if (currentStream) {
              currentStream.end();
              this.push(currentPromise);
            }
            const newUpload = adapter.out.upload(ship.id, (numBatches - 1));
            currentStream = newUpload.stream;
            currentPromise = newUpload.promise;
          }
          currentStream.write(`${JSON.stringify(user)}\n`);
          numUsers += 1;
          callback();
        } catch (e) {
          throw e;
        }
      }, function finish(callback) {
        if (currentStream && currentStream.end) {
          // Readable does not implement end function,
          // so we need to be careful here.
          currentStream.end();
        }
        this.push(currentPromise);
        callback();
      }))
      .pipe(ps.map({ highWaterMark: 1 }, ({ url, partNumber, size }) => {
        return (() => {
          this.hull.logger.info("incoming.job.progress", { jobName: "sync", stepName: "upload", progress: partNumber, size, type: this.import_type });
          if (size > 0) {
            return this.startImportJob(url, partNumber, size, importId);
          }
          return false;
        })()
        .then(({ job }) => {
          last_job_id = job.id;
          this.hull.logger.info("incoming.job.progress", { jobName: "sync", stepName: "import", progress: partNumber, job, type: this.import_type });
          return { job };
        });
      }))
      )
      .then(() => {
        const duration = new Date() - started_sync_at;

        this.metric.increment(`ship.incoming.${this.import_type}`, processed);
        if (processed === 0) {
          this.hull.logger.warn("incoming.job.warning", { hull_summary: "Warning: Saved query returned no results" });
        }
        this.hull.logger.info("incoming.job.success", { jobName: "sync", duration, progress: processed, type: this.import_type });

        const settings = {
          last_sync_at: started_sync_at,
          last_updated_at: last_updated_at || started_sync_at
        };

        if (last_job_id) {
          settings.last_job_id = last_job_id;
        }
        return this.hull.utils.settings.update(settings)
          .then(() => {
            if (_.get(this.ship, "status.status") === "error") {
              return this.hull.put("app/status", {
                status: "ok",
              });
            }
            return Promise.resolve();
          })
          .then(resolve);
      })
      .catch(err => {
        this.hull.logger.error("incoming.job.error", {
          jobName: "sync",
          errors: _.get(err, "message", err),
          hull_summary: _.get(err, "message", "Server Error: Encountered error during sync operation"),
          type: this.import_type
        });
        this.hull.put("app/status", {
          status: "error",
          messages: [_.get(err, "message", err)]
        });
        reject(err);
      });
    });
  }

  startImportJob(url, partNumber, size, importId) {
    const { overwrite } = this.ship.private_settings;
    const params = {
      url,
      format: "json",
      notify: true,
      emit_event: false,
      overwrite: !!overwrite,
      name: `Import from hull-sql ${this.ship.name} - part ${partNumber}`,
      schedule_at: moment().add(this.importDelay + (2 * partNumber), "minutes").toISOString(),
      stats: { size },
      size,
      import_id: importId,
      part_number: partNumber
    };

    this.hull.logger.info("incoming.job.progress", { jobName: "sync", stepName: "import", progress: partNumber, options: _.omit(params, "url"), type: this.import_type });

    return this.hull.post(`/import/${this.import_type}`, params)
      .then(job => {
        return { job, partNumber };
      });
  }
}

module.exports = SyncAgent;
