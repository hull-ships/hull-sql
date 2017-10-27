export default (req, res) => {
  const response = { status: "ignored" };
  if (req.agent.isEnabled()) {
    response.status = "scheduled";
    req.hull.enqueue("startSync");
  }

  res.json(response);
};
