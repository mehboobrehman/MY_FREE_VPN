const { vpnNodes } = require('../models/store');

async function getNodes(req, res) {
  const { country, streaming, smart_dns } = req.query;
  let nodes = Array.from(vpnNodes.values());

  if (country) {
    const upperCountry = country.toUpperCase();
    nodes = nodes.filter(n => n.country_code === upperCountry);
  }

  if (streaming === 'true') {
    nodes = nodes.filter(n => n.is_streaming === true);
  }

  if (smart_dns === 'true') {
    nodes = nodes.filter(n => n.smart_dns_enabled === true);
  }

  return res.status(200).json({
    nodes
  });
}

module.exports = {
  getNodes
};
