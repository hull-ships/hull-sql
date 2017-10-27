export default ({ agent }, res) => {
  if (agent.areConnectionParametersConfigured()) {
    const query = agent.getQuery();
    res.render("connected.html", {
      query,
      last_sync_at: null,
      import_type: "users",
      ...agent.ship.private_settings
    });
  } else {
    res.render("home.html", {});
  }
};
