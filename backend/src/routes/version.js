const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// GET /api/v1/version - Retrieve application version from root version.json
router.get('/', (req, res) => {
  try {
    const versionFilePath = path.join(__dirname, '../../../version.json');
    if (!fs.existsSync(versionFilePath)) {
      return res.status(404).json({ status: 'error', message: 'Version file not found' });
    }
    const versionData = JSON.parse(fs.readFileSync(versionFilePath, 'utf8'));
    return res.status(200).json({
      status: 'success',
      version: versionData.version
    });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;
