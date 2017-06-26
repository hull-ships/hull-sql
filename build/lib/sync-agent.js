"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _lodash = require("lodash");

var _lodash2 = _interopRequireDefault(_lodash);

var _moment = require("moment");

var _moment2 = _interopRequireDefault(_moment);

var _batchStream = require("batch-stream");

var _batchStream2 = _interopRequireDefault(_batchStream);

var _promiseStreams = require("promise-streams");

var _promiseStreams2 = _interopRequireDefault(_promiseStreams);

var _through2Map = require("through2-map");

var _through2Map2 = _interopRequireDefault(_through2Map);

var _adapters = require("./adapters");

var Adapters = _interopRequireWildcard(_adapters);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; } /**
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * Module dependencies.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                */

// Map each record of the stream.


var DEFAULT_BATCH_SIZE = parseInt(process.env.BATCH_SIZE || "10000", 10);
var NB_CONCURRENT_BATCH = 3;
var FULL_IMPORT_DAYS = process.env.FULL_IMPORT_DAYS || "10000";

/**
 * Export the sync agent for the SQL ship.
 */

var ConfigurationError = function (_Error) {
  _inherits(ConfigurationError, _Error);

  function ConfigurationError(msg) {
    _classCallCheck(this, ConfigurationError);

    var _this = _possibleConstructorReturn(this, (ConfigurationError.__proto__ || Object.getPrototypeOf(ConfigurationError)).call(this, msg));

    _this.status = 403;
    return _this;
  }

  return ConfigurationError;
}(Error);

var SyncAgent = function () {

  /**
   * Creates a sync agent.
   * @param {Object} config The configuration of the agent.
   */
  function SyncAgent(_ref) {
    var ship = _ref.ship,
        client = _ref.client,
        job = _ref.job,
        metric = _ref.metric,
        _ref$batchSize = _ref.batchSize,
        batchSize = _ref$batchSize === undefined ? DEFAULT_BATCH_SIZE : _ref$batchSize;

    _classCallCheck(this, SyncAgent);

    // Expose the ship settings
    // and the Hull instance.
    this.ship = ship;
    this.hull = client;
    this.job = job;
    this.metric = metric;
    this.batchSize = batchSize;

    this.importDelay = _lodash2.default.random(0, process.env.IMPORT_DELAY || 120);

    // Get the DB type.
    var _ship$private_setting = this.ship.private_settings,
        db_type = _ship$private_setting.db_type,
        _ship$private_setting2 = _ship$private_setting.output_type,
        output_type = _ship$private_setting2 === undefined ? "s3" : _ship$private_setting2;

    this.adapter = { in: Adapters[db_type],
      out: Adapters[output_type]
    };

    // Make sure the DB type is known.
    // If not, throw an error.
    // Otherwise, use the correct adapter.
    if (!this.adapter.in) {
      throw new ConfigurationError("Invalid database type " + db_type + ".");
    }
    if (!this.adapter.out) {
      throw new ConfigurationError("Invalid output type " + output_type + ".");
    }

    this.client = this.adapter.in.openConnection(this.ship.private_settings);

    return this;
  }

  /**
   * Returns whether sync is enabled or not.
   * @return {boolean} True if sync is enabled; otherwise false.
   */


  _createClass(SyncAgent, [{
    key: "isEnabled",
    value: function isEnabled() {
      return this.ship.private_settings.enabled === true;
    }

    /**
     * Returns whether all required connection parameters have been supplied.
     * @return {boolean} True if all parameters are specified; otherwise false.
     */

  }, {
    key: "areConnectionParametersSet",
    value: function areConnectionParametersSet() {
      var settings = this.ship.private_settings;
      var conn = ["type", "host", "port", "name", "user", "password"].reduce(function (c, key) {
        var val = settings["db_" + key];
        if (key === "type" && val === "redshift") val = "postgres";
        if (c && val && val.length > 0) {
          return _extends({}, c, _defineProperty({}, key, val));
        }
        return false;
      }, {});

      if (conn) return true;

      return false;
    }

    /**
     * Returns whether the query string has been configured.
     * @return {boolean} True if the query string is set; otherwise false.
     */

  }, {
    key: "isQueryStringConfigured",
    value: function isQueryStringConfigured() {
      return !!this.getQuery();
    }
  }, {
    key: "getQuery",
    value: function getQuery() {
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

  }, {
    key: "runQuery",
    value: function runQuery(query) {
      var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

      // Wrap the query.
      var oneDayAgo = (0, _moment2.default)().subtract(1, "day").utc();
      var replacements = {
        last_updated_at: options.last_updated_at || oneDayAgo.toISOString(),
        import_start_date: (0, _moment2.default)().subtract(this.ship.private_settings.import_days, "days").format()
      };
      var wrappedQuery = this.adapter.in.wrapQuery(query, replacements);
      // Run the method for the specific adapter.
      return this.adapter.in.runQuery(this.client, wrappedQuery, options).then(function (result) {
        return {
          entries: result.rows
        };
      });
    }
  }, {
    key: "startImport",
    value: function startImport() {
      var _this2 = this;

      var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

      this.hull.logger.info("sync.start", options);
      var query = this.getQuery();
      var started_sync_at = new Date();
      if (!options.import_days) {
        options.import_days = FULL_IMPORT_DAYS;
      }
      return this.streamQuery(query, options).then(function (stream) {
        return _this2.sync(stream, started_sync_at);
      }).catch(function (err) {
        _this2.hull.logger.error("sync.error", {
          message: err.message
        });
        return Promise.reject(err);
      });
    }
  }, {
    key: "startSync",
    value: function startSync() {
      var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

      var private_settings = this.ship.private_settings;
      var oneHourAgo = (0, _moment2.default)().subtract(1, "hour").utc();
      options.import_days = private_settings.import_days;
      var last_updated_at = private_settings.last_updated_at || private_settings.last_sync_at || oneHourAgo.toISOString();
      return this.startImport(_extends({}, options, {
        last_updated_at: last_updated_at
      }));
    }
  }, {
    key: "streamQuery",
    value: function streamQuery(query) {
      var _this3 = this;

      var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
      var last_updated_at = options.last_updated_at;

      var replacements = {
        last_updated_at: last_updated_at,
        import_start_date: (0, _moment2.default)().subtract(options.import_days, "days").format()
      };
      // Wrap the query.
      var wrappedQuery = this.adapter.in.wrapQuery(query, replacements);

      this.hull.logger.debug("sync.query", {
        query: wrappedQuery
      });

      // Run the method for the specific adapter.
      return this.adapter.in.streamQuery(this.client, wrappedQuery).then(function (stream) {
        return stream;
      }, function (err) {
        _this3.hull.logger.error("sync.error", {
          message: err.toString()
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

  }, {
    key: "sync",
    value: function sync(stream, started_sync_at) {
      var _this4 = this;

      var processed = 0;
      var last_updated_at = void 0;

      var transform = (0, _through2Map2.default)({
        objectMode: true
      }, function (record) {
        var user = {};
        processed += 1;

        if (processed % 1000 === 0) {
          var elapsed = new Date() - started_sync_at;
          _this4.hull.logger.info("sync.progress", {
            processed: processed,
            elapsed: elapsed
          });
          if (_this4.job) {
            _this4.job.progress(processed);
            _this4.job.log("%d proceesed in  %d ms", processed, elapsed);
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

        // Register everything else inside the "traits" object.
        user.traits = _lodash2.default.omit(record, "external_id", "updated_at");
        return user;
      });

      var batch = new _batchStream2.default({
        size: this.batchSize
      });

      var num = 0;

      var last_job_id = null;
      return new Promise(function (resolve, reject) {
        stream.on("error", function (err) {
          _this4.hull.logger.error("sync.error", {
            message: err.toString()
          });
          if (stream.close) stream.close();
          _this4.adapter.in.closeConnection(_this4.client);
          reject(err);
        }).pipe(transform).pipe(batch).pipe(_promiseStreams2.default.map({
          concurrent: NB_CONCURRENT_BATCH
        }, function (users) {
          num += 1;
          return _this4.adapter.out.upload(users, _this4.ship.id, num).then(function (_ref2) {
            var url = _ref2.url,
                partNumber = _ref2.partNumber,
                size = _ref2.size;

            if (users.length > 0) {
              return _this4.startImportJob(url, partNumber, size);
            }
            return false;
          }).then(function (_ref3) {
            var job = _ref3.job,
                partNumber = _ref3.partNumber;

            last_job_id = job.id;
            _this4.hull.logger.info("sync.job.part." + partNumber, { job: job });
            return { job: job };
          }).catch(function (err) {
            _this4.hull.logger.error("sync.error", err.message);
          });
        })).wait().then(function () {
          var duration = new Date() - started_sync_at;

          _this4.metric.increment("ship.incoming.users", processed);
          _this4.hull.logger.info("sync.done", {
            duration: duration,
            processed: processed
          });

          var settings = {
            last_sync_at: started_sync_at,
            last_updated_at: last_updated_at || started_sync_at
          };

          if (last_job_id) {
            settings.last_job_id = last_job_id;
          }
          return _this4.hull.utils.settings.update(settings).then(resolve);
        }).catch(function (reason) {
          reject(reason);
        });
      });
    }
  }, {
    key: "startImportJob",
    value: function startImportJob(url, partNumber, size) {
      var overwrite = this.ship.private_settings.overwrite;

      var params = {
        url: url,
        format: "json",
        notify: true,
        emit_event: false,
        overwrite: !!overwrite,
        name: "Import from hull-sql " + this.ship.name + " - part " + partNumber,
        schedule_at: (0, _moment2.default)().add(this.importDelay + 2 * partNumber, "minutes").toISOString(),
        stats: {
          size: size
        }
      };

      this.hull.logger.info("sync.import", _lodash2.default.omit(params, "url"));

      return this.hull.post("/import/users", params).then(function (job) {
        return {
          job: job,
          partNumber: partNumber
        };
      });
    }
  }]);

  return SyncAgent;
}();

exports.default = SyncAgent;