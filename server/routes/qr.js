const express = require('express');
const QRCode = require('qrcode');

const router = express.Router();

/**
 * GET /api/qr/generate
 * Generate QR code for the prediction app URL
 */
router.get('/generate', async (req, res) => {
  const baseUrl = req.query.url || `${req.protocol}://${req.get('host')}`;

  try {
    const qrDataUrl = await QRCode.toDataURL(baseUrl, {
      width: 400,
      margin: 2,
      color: {
        dark: '#1a1a2e',
        light: '#ffffff'
      },
      errorCorrectionLevel: 'H'
    });

    res.json({ qrCode: qrDataUrl, url: baseUrl });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate QR code.' });
  }
});

/**
 * GET /api/qr/image
 * Return QR code as PNG image
 */
router.get('/image', async (req, res) => {
  const baseUrl = req.query.url || `${req.protocol}://${req.get('host')}`;

  try {
    res.setHeader('Content-Type', 'image/png');
    await QRCode.toFileStream(res, baseUrl, {
      width: 600,
      margin: 2,
      color: {
        dark: '#1a1a2e',
        light: '#ffffff'
      },
      errorCorrectionLevel: 'H'
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate QR code image.' });
  }
});

module.exports = router;
