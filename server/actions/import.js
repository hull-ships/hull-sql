export default ({ hull }, res) => {
  hull.enqueue("startImport");
  res.json({ status: "scheduled" });
};
