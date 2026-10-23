const { vpnNodes } = require('../models/store');

async function getNodes(req, res) {
  const { country } = req.query;
  let nodes = Array.from(vpnNodes.values());

  if (country) {
    const upperCountry = country.toUpperCase();
    nodes = nodes.filter(n => n.country_code === upperCountry);
  }

  return res.status(200).json({
    nodes
  });
}

module.exports = {
  getNodes
};
