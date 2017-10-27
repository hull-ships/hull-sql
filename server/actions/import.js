export default (req, res) => {
  req.hull.enqueue("startImport");
  res.json({ status: "scheduled" });
};
