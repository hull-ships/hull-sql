/**
 * Module dependencies.
 */

import _ from "lodash";
import moment from "moment";
import URI from "urijs";
import Hull from "hull";

// Map each record of the stream.
import map from "through2-map";
import Stream from "stream";

/**
 * Configure the streaming to AWS.
 */

import Aws from "aws-sdk";
import * as Adapters from "./adapters";

/**
 * Export the sync agent for the SQL ship.
 */


class ConfigurationError extends Error {
  constructor(msg) {
    super(msg);
    this.status = 403;
  }
}

export default class SyncAgent {

  static work(queue) {
    queue.process("SyncAgent", (job, done) => {
      try {
        const { method, configuration, args } = job.data;
        const hull = new Hull(configuration);
        return hull.get("app").then(ship => {
          const agent = new SyncAgent({ ship, client: hull, queue, job });
          if (agent[method]) {
            const ret = agent[method](...args);
            if (ret && ret.then) {
              ret.then(done.bind(this, null), done);
            } else {
              done(null, ret);
            }
          } else {
            done(new Error(`Unknown method ${method}`));
          }
        }, done);
      } catch (err) {
        done(err);
        return err;
      }
    });
  }

  async(method, ...args) {
    const configuration = _.pick(this.hull.configuration(), "id", "organization", "secret");
    const params = { method, args, configuration };
    const job = this.queue.create("SyncAgent", params);
    return job.removeOnComplete(true)
      .attempts(3)
      .backoff({ type: "exponential" })
      .save();
  }

  /**
   * Constructor.
   *
   * Params:
   *   @ship Object*
   *   @hull Object*
   */

  constructor({ ship, client, queue, job }) {
    // Expose the ship settings
    // and the Hull instance.
    this.ship = ship;
    this.hull = client;
    this.queue = queue;
    this.job = job;

    // Get the DB type.
    const { db_type } = this.ship.private_settings;
    this.adapter = Adapters[db_type];

    // Make sure the DB type is known.
    // If not, throw an error.
    // Otherwise, use the correct adapter.
    if (!this.adapter) {
      throw new ConfigurationError(`Invalid database type ${db_type}.`);
    }

    const connectionString = this.connectionString();

    this.client = this.adapter.openConnection(connectionString);
    return this;
  }

  isEnabled() {
    return this.ship.private_settings.enabled === true;
  }

  isConfigured() {
    return !!this.connectionString();
  }

  connectionString() {
    const conn = ["type", "host", "port", "name", "user", "password"].reduce((c, key) => {
      const val = this.ship.private_settings[`db_${key}`];
      if (c && val && val.length > 0) {
        return { ...c, [key]: val };
      }
      return false;
    }, {});
    if (conn) {
      return URI()
              .protocol(conn.type)
              .username(conn.user)
              .password(conn.password)
              .host(conn.host)
              .port(conn.port)
              .path(conn.name)
              .toString();
    }
    return false;
  }

  updateShipSettings(settings) {
    return this.hull.get(this.ship.id).then(({ private_settings }) => {
      return this.hull.put(this.ship.id, {
        private_settings: {
          ...private_settings,
          ...settings
        }
      });
    });
  }

  getQuery() {
    return this.ship.private_settings.query;
  }

  /**
   * Run a wrapped query.
   *
   * Params:
   *   @query String*
   *   @callback Function*
   *
   * Return:
   *   @callback Function
   *     - @error Object
   *     - @success Object
   */

  runQuery(query, options = {}) {
    // Wrap the query.
    const oneDayAgo = moment().subtract(1, "day").utc();
    const last_updated_at = options.last_updated_at || oneDayAgo.toISOString();
    const wrappedQuery = this.adapter.wrapQuery(query, last_updated_at);
    // Run the method for the specific adapter.
    return this.adapter.runQuery(this.client, wrappedQuery, options)
      .then(result => {
        return { entries: result.rows };
      });
  }

  startImport(options) {
    this.hull.logger.info("sync.start", options);
    const { query } = this.ship.private_settings;
    const started_sync_at = new Date();
    return this.streamQuery(query, options)
              .then(stream => this.sync(stream, started_sync_at))
              .then(({ processed, duration, job }) => {
                this.hull.logger.info("sync.done", { processed, duration, job: job.id });
                return { processed, duration, job: job.id };
              });
  }

  startSync(options) {
    const private_settings = this.ship.private_settings;
    const oneHourAgo = moment().subtract(1, "hour").utc();
    const last_updated_at = private_settings.last_updated_at || private_settings.last_sync_at || oneHourAgo.toISOString();
    return this.startImport({ ...options, last_updated_at });
  }

  streamQuery(query, options = {}) {
    const { last_updated_at } = options;

    // Wrap the query.
    const wrappedQuery = this.adapter.wrapQuery(query, last_updated_at);

    this.hull.logger.debug("sync.query", { query: wrappedQuery });

    // Run the method for the specific adapter.
    return this.adapter.streamQuery(this.client, wrappedQuery).then(stream => {
      stream.on("error", err => this.hull.logger.error("sync.error", { message: err.toString(), query: wrappedQuery }));
      return stream;
    }, err => {
      this.hull.logger.error("sync.error", { message: err.toString() });
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

  sync(stream, started_sync_at) {
    let processed = 0;
    let last_updated_at;

    const transform = map({ objectMode: true }, (record) => {
      const user = {};
      processed += 1;

      if (processed % 1000 === 0) {
        const elapsed = new Date() - started_sync_at;
        this.hull.logger.info("sync.progress", { processed, elapsed });
        if (this.job) {
          this.job.progress(processed);
          this.job.log("%d proceesed in  %d ms", processed, elapsed);
        }
      }

      // Add the user id if exists.
      if (record.external_id) {
        user.userId = record.external_id.toString();
      }

      if (record.updated_at) {
        last_updated_at = last_updated_at || record.updated_at;
        if (record.updated_at > last_updated_at) {
          last_updated_at = record.updated_at;
        }
      }

      // Register eveything else inside the "traits" object.
      user.traits = _.omit(record, "external_id", "updated_at");

      return `${JSON.stringify(user)}\n`;
    });

    return this.uploadStream(stream.pipe(transform))
      .then(url => {
        if (processed > 0) {
          return this.startImportJob(url);
        }
        return false;
      })
      .then(job => {
        const settings = {
          last_sync_at: started_sync_at,
          last_updated_at: last_updated_at || started_sync_at
        };

        if (job && job.id) {
          settings.last_job_id = job.id;
        }

        return this.updateShipSettings(settings)
                   .then((ship) => { return { ship, job }; });
      })
      .then(({ ship, job }) => {
        const duration = new Date() - started_sync_at;
        return { ship, job, duration, processed };
      })
      .catch(err => {
        this.hull.logger.error("sync.error", err);
      });
  }

  startImportJob(url) {
    const { overwrite } = this.ship.private_settings;
    const params = {
      url,
      format: "json",
      notify: true,
      emit_event: false,
      overwrite: !!overwrite
    };

    this.hull.logger.info("sync.import", _.omit(params, "url"));

    return this.hull.post("/import/users", params);
  }

  uploadStream(stream) {
    const Body = new Stream.PassThrough();
    const Bucket = process.env.BUCKET_PATH;
    const Key = `extracts/${this.ship.id}/${new Date().getTime()}.json`;
    const params = {
      Bucket, Key, Body,
      ACL: "private",
      ContentType: "application/json",
    };

    return new Promise((resolve, reject) => {
      const s3 = new Aws.S3();

      s3.upload(params, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve(s3.getSignedUrl("getObject", { Bucket, Key, Expires: 86400 }));
        }
      });
      stream.pipe(Body);
    });
  }
}
