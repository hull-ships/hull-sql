export function getSshTunnelConfig({ ssh_username, db_host, db_port, ssh_private_key }) {
  return {
    username: ssh_username,
    port: 22,
    host: db_host,
    dstPort: db_port,
    dstHost: db_host,
    privateKey: ssh_private_key
  };
}

export function shouldUseSshTunnel(privateSettings) {
  return !!(privateSettings.ssh_username && privateSettings.ssh_private_key);
}
