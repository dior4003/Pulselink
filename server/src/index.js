require('dotenv').config();
const fs = require('fs');
const http = require('http');
const path = require('path');
const { exec } = require('child_process');
const express = require('express');
const cors = require('cors');
const { WebSocketServer } = require('ws');
const { initDatabase } = require('./config/db');
const { MediaController } = require('./controllers/MediaController');
const { attachWebSocket } = require('./controllers/SocketController');
const { authMiddleware } = require('./middleware/authMiddleware');
const apiRoutes = require('./routes/apiRoutes');

const PORT = process.env.PORT || 3000;
const app = express();

if (process.env.TRUST_PROXY) {
  app.set('trust proxy', Number(process.env.TRUST_PROXY) || 1);
}

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : true;

app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: '8mb' }));

// Authenticated & XSS-hardened media serving
app.use(
  '/uploads',
  authMiddleware,
  (_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'");
    next();
  },
  express.static(MediaController.uploadsDir)
);

app.use('/api', apiRoutes);

// Serve built React Native Web bundle (client/dist) on the same port
const clientDistDir = path.join(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(path.join(clientDistDir, 'index.html'))) {
  app.use(express.static(clientDistDir));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDistDir, 'index.html'));
  });
} else {
  app.get('*', (_req, res) => {
    res.status(200).send(
      '<html><body style="font-family:sans-serif;background:#0A0E17;color:#F1F5F9;padding:40px">' +
        '<h2>PulseLink Backend Ishlayapti</h2>' +
        '<p>Frontend hali build qilinmagan. <code>client/</code> papkasida <code>npm install && npm run build:web</code> buyrug‘ini bajaring.</p>' +
        '</body></html>'
    );
  });
}

function openBrowser(url) {
  if (process.env.NODE_ENV === 'production' || process.env.AUTO_OPEN === 'false') return;
  const cmd = process.env.TERMUX_VERSION
    ? `termux-open-url "${url}"`
    : process.platform === 'darwin'
    ? `open "${url}"`
    : process.platform === 'win32'
    ? `cmd /c start "" "${url}"`
    : `xdg-open "${url}"`;
  exec(cmd, () => {});
}

const server = http.createServer(app);
const wss = new WebSocketServer({ server });
attachWebSocket(wss);

initDatabase()
  .then(() => {
    server.listen(PORT, () => {
      const url = `http://localhost:${PORT}`;
      console.log(`PulseLink MVC Server running on ${url} (MySQL/MariaDB)`);
      openBrowser(url);
    });
  })
  .catch((err) => {
    console.error('Database connection failed:', err.message);
    process.exit(1);
  });
