export default ({ body, agent }, res) => {
  return agent
    .runQuery(body.query, { timeout: 20000, limit: 100 })
    .then(data => res.json(data))
    .catch(error => {
      const { status, message } = error;
      return res.status(status || 500).send({ message });
    });
};
