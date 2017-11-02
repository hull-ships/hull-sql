export default ({ hull, agent }, res) => {
  const response = { status: "ignored" };
  if (agent.isEnabled()) {
    response.status = "scheduled";
    hull.enqueue("startSync");
  }

  res.json(response);
};
