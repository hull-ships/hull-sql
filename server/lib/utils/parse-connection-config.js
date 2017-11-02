import URI from "urijs";

import { shouldUseSshTunnel } from "./ssh-tunnel";

export function parseConnectionConfig(settings) {
  const conn = ["type", "host", "port", "name", "user", "password"].reduce((c, key) => {
    let val = settings[`db_${key}`];
    if (key === "type" && val === "redshift") val = "postgres";
    if (key === "host" && shouldUseSshTunnel(settings)) val = "127.0.0.1";
    if (c && val && val.length > 0) {
      return { ...c, [key]: val };
    }
    return false;
  }, {});
  if (conn) {
    const uri = URI()
      .protocol(conn.type)
      .username(conn.user)
      .password(conn.password)
      .host(conn.host)
      .port(conn.port)
      .path(conn.name);

    if (settings.db_options) {
      return uri.query(settings.db_options).toString();
    }
    return uri.toString();
  }

  return false;
}

export default parseConnectionConfig;
