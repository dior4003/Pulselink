const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const ALLOWED_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.pdf', '.txt', '.zip']);
const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);

const MediaController = {
  uploadsDir,
  upload(req, res) {
    try {
      const { fileName, base64 } = req.body || {};
      if (!base64 || !fileName) {
        return res.status(400).json({ error: 'Fayl ma’lumoti yetishmayapti' });
      }
      const ext = path.extname(String(fileName)).toLowerCase();
      if (!ALLOWED_EXTS.has(ext)) {
        return res.status(400).json({
          error: 'Ruxsat etilmagan fayl turi. Faqat PNG, JPG, WEBP, GIF, PDF, TXT, ZIP yuklash mumkin.',
        });
      }

      const cleanBase64 = base64.includes(',') ? base64.split(',')[1] : base64;
      const buffer = Buffer.from(cleanBase64, 'base64');
      if (buffer.length > 5 * 1024 * 1024) {
        return res.status(413).json({ error: 'Fayl hajmi 5 MB dan oshmasligi kerak' });
      }

      const storedName = `${crypto.randomUUID()}${ext}`;
      fs.writeFileSync(path.join(uploadsDir, storedName), buffer);
      res.status(201).json({
        url: `/uploads/${storedName}`,
        type: IMAGE_EXTS.has(ext) ? 'image' : 'file',
        fileName: path.basename(String(fileName)),
      });
    } catch (err) {
      res.status(500).json({ error: 'Fayl yuklashda xatolik: ' + err.message });
    }
  },
};

module.exports = { MediaController };
