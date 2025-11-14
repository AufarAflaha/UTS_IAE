const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const crypto = require('crypto'); // <-- Diperlukan untuk Keygen

// --- PERBAIKAN PATH DI SINI ---
// Path './' sudah benar karena file-file ini ada di folder 'middleware'
// yang sejajar dengan 'server.js'
const { validateUser } = require('./middleware/validation'); 
const { errorHandler } = require('./middleware/errorHandler');
// ----------------------------

const userRoutes = require('./routes/users');

const app = express();
const PORT = process.env.PORT || 3001;

// --- Pembuatan Kunci Asimetris ---
// Di dunia nyata, ini akan disimpan di .env atau secret manager
// BUKAN di-generate setiap kali server start.
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { // <-- Tipe 'rsa' SUDAH BENAR
  modulusLength: 2048, // Standar keamanan yang baik
  publicKeyEncoding: {
    type: 'spki',
    format: 'pem'
  },
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'pem'
  }
});

console.log('Public Key Dibuat. API Gateway akan mengambil ini.');
// ---------------------------------

// Security middleware
app.use(helmet());
app.use(cors());

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// --- Rute Publik ---

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    service: 'REST API Service',
    timestamp: new Date().toISOString()
  });
});

// Endpoint untuk API Gateway mengambil public key
app.get('/public-key', (req, res) => {
  res.status(200).json({ publicKey: publicKey });
});

// --- Rute API ---
// Mengirim privateKey ke modul rute agar bisa menandatangani JWT
app.use('/api/users', userRoutes(privateKey));

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `Cannot ${req.method} ${req.originalUrl}`
  });
});

app.listen(PORT, () => {
  console.log(`🚀 User Service (REST) berjalan di port ${PORT}`);
  console.log(`🔑 Menyediakan Public Key di /public-key`);
});

module.exports = app;