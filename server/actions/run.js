export default ({ body, agent, hull }, res) => {
  const query = body.query || agent.getQuery();

  if (!query) {
    return res.status(403).json({ status: "query string empty" });
  }

  return agent
    .runQuery(query, { timeout: 20000, limit: 100 })
    .then(data => res.json(data))
    .catch(error => {
      const { status, message } = error;
      return res.status(status || 500).send({ message });
    });
};
