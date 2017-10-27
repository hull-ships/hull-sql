export default ({ agent }, res) => {
  const query = agent.getQuery();
  res.json({ query });
};
