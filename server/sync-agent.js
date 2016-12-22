/**
 * Module dependencies.
 */

const _ = require("lodash");

// Map each record of the stream.
const map = require("through2-map");

/**
 * Configure the streaming to AWS.
 */

// Configure the AWS SDK.
const Aws = require("aws-sdk");
Aws.config.update({
  accessKeyId: process.env.AWS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_KEY
});

// Configure the AWS S3 account with
// a new AWS instance.
const awsAccount = new Aws.S3();
const awsS3 = require("s3-upload-stream")(awsAccount);

import * as Adapters from "./adapters";

/**
 * Export the sync agent for the SQL ship.
 */

export default class SyncAgent {

  /**
   * Constructor.
   *
   * Params:
   *   @ship Object*
   *   @hull Object*
   */

  constructor({ ship, client }) {
    // Expose the ship settings
    // and the Hull instance.
    this.ship = ship;
    this.hull = client;

    // Get the DB type.
    const { db_type } = this.ship.private_settings;
    this.adapter = Adapters[db_type];

    // Make sure the DB type is known.
    // If not, throw an error.
    // Otherwise, use the correct adapter.
    if (!this.adapter) {
      throw new Error(`Invalid database type '${db_type}'.`);
    }

    this.client = this.adapter.openConnection(this.ship.private_settings.connection_string);
    return this;
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
    const wrappedQuery = this.adapter.wrapQuery(query);
    // Run the method for the specific adapter.
    return this.adapter.runQuery(this.client, wrappedQuery, options)
      .then(result => {
        return { entries: result.rows };
      });
  }

  streamQuery(query, options = {}) {
    const { last_updated_at } = options;

    // Wrap the query.
    const wrappedQuery = this.adapter.wrapQuery(query, last_updated_at);
    // Run the method for the specific adapter.
    return this.adapter.streamQuery(this.client, wrappedQuery).then(stream => {
      stream.on("error", err => this.hull.logger.error("sync.error", { message: err.toString() }));
      return stream;
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

  startSync(stream, started_sync_at) {
    this.hull.logger.info("sync.start");
    let processed = 0;
    let last_updated_at;


    const transform = map({ objectMode: true }, (record) => {
      const user = {};
      processed += 1;

      if (processed % 1000 === 0) {
        this.hull.logger.info("sync.progress", { processed, elapsed: new Date() - started_sync_at });
      }

      // Add the user id if exists.
      if (record.external_id) {
        user.userId = record.external_id.toString();
      }

      // console.warn("Hello record", { record });

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

    return this.uploadStream(stream.pipe(transform), started_sync_at)
      .then(url => this.startImportJob(url))
      .then(job => {
        return this.updateShipSettings({
          last_sync_at: started_sync_at,
          last_updated_at: last_updated_at || started_sync_at,
          last_job_id: job.id
        });
      })
      .then(() => {
        this.hull.logger.info("sync.done", { processed, duration: new Date() - started_sync_at });
      })
      .catch(err => {
        console.warn("WTF: ", err);
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

  uploadStream(stream, started_sync_at) {
    const s3Params = {
      Bucket: process.env.BUCKET_PATH,
      ACL: "private",
      StorageClass: "STANDARD",
      ContentType: "application/json",
      Expires: 86400,
      Key: `extracts/${this.ship.id}/${started_sync_at.getTime()}.json`
    };

    // Stream and upload the data to S3.
    const uploader = stream.pipe(awsS3.upload(s3Params));

    return new Promise((resolve, reject) => {
      // On a stream error.
      stream.on("error", reject);

      // On a stream error.
      uploader.on("error", reject);

      // Make sure the stream has finish
      // before doing everything else.
      stream.on("end", () => {
        this.adapter.closeConnection(this.client);
        uploader.on("uploaded", () => {
          // Get the bucket URL.
          const url = awsAccount.getSignedUrl("getObject", _.pick(s3Params, [
            "Bucket",
            "Key",
            "Expires"
          ]));
          resolve(url);
        });
      });
    });
  }
}
