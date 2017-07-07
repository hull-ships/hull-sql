import _ from "lodash";

export function parseConnectionConfig(settings) {
  const conn = ["type", "host", "port", "name", "user", "password"].reduce((c, key) => {
    const val = settings[`db_${key}`];
    if (c && val && val.length > 0) {
      return { ...c,
        [key]: val
      };
    }
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

export default parseConnectionConfig;
