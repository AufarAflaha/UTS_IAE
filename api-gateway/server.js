const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const axios = require('axios'); // Pastikan axios diinstal di package.json

const app = express();
const PORT = process.env.PORT || 3000;
const REST_API_URL = process.env.REST_API_URL || 'http://rest-api:3001';
const GRAPHQL_API_URL = process.env.GRAPHQL_API_URL || 'http://graphql-api:4000';

let PUBLIC_KEY_CACHE = null;

/**
 * Mengambil public key dari User Service.
 * Akan mencoba lagi setiap 5 detik jika gagal.
 */
async function fetchPublicKey() {
  try {
    // Gunakan nama service Docker 'rest-api' untuk komunikasi internal
    const response = await axios.get(`${REST_API_URL}/public-key`);
    if (response.data && response.data.publicKey) {
      PUBLIC_KEY_CACHE = response.data.publicKey;
      console.log('✅ Public key berhasil diambil dari User Service');
    } else {
      throw new Error('Format public key tidak valid');
    }
  } catch (error) {
    console.error(`❌ Gagal mengambil public key dari ${REST_API_URL}: ${error.message}`);
    console.log('Mencoba lagi dalam 5 detik...');
    setTimeout(fetchPublicKey, 5000); // Coba lagi setelah 5 detik
  }
}

/**
 * Middleware Otentikasi untuk memverifikasi JWT.
 */
const authenticateToken = (req, res, next) => {
  // Izinkan query Introspection GraphQL untuk lolos
  if (req.body && req.body.operationName === 'IntrospectionQuery') {
    return next();
  }
  
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Format: Bearer TOKEN

  if (token == null) {
    console.warn('[GW-AUTH] Token tidak ditemukan');
    return res.status(401).json({ error: 'Token tidak ditemukan' });
  }

  if (!PUBLIC_KEY_CACHE) {
    console.error('[GW-AUTH] Public key belum siap, otentikasi gagal.');
    return res.status(503).json({ error: 'Service belum siap, coba lagi.' });
  }

  // Verifikasi token menggunakan public key
  jwt.verify(token, PUBLIC_KEY_CACHE, { algorithms: ['RS256'] }, (err, user) => {
    if (err) {
      console.warn(`[GW-AUTH] Token tidak valid: ${err.message}`);
      return res.status(403).json({ error: 'Token tidak valid' });
    }
    
    // Teruskan data user ke service di belakangnya via header
    req.user = user;
    req.headers['x-user-id'] = user.sub; // 'sub' (subject) adalah ID user
    req.headers['x-user-email'] = user.email;
    req.headers['x-user-team'] = user.team;
    
    console.log(`[GW-AUTH] User ${user.email} terotentikasi.`);
    next();
  });
};

// --- Global Middleware ---
app.use(cors()); // Aktifkan CORS untuk semua rute
app.use(express.json()); // Body parser untuk JSON

// --- Rute Publik (Tidak Perlu Token) ---

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    publicKeyCached: PUBLIC_KEY_CACHE != null
  });
});

// Endpoint untuk frontend mengambil public key (jika diperlukan)
app.get('/public-key', (req, res) => {
  if (PUBLIC_KEY_CACHE) {
    res.json({ publicKey: PUBLIC_KEY_CACHE });
  } else {
    res.status(503).json({ error: 'Public key belum tersedia.' });
  }
});

// --- Definisi Proxy ---

const restApiProxy = createProxyMiddleware({
  target: REST_API_URL,
  changeOrigin: true,
  onProxyReq: (proxyReq, req, res) => {
    console.log(`[GW-REST] Meneruskan rute: ${req.method} ${req.path}`);
  },
  onError: (err, req, res) => {
    console.error('REST Proxy Error:', err);
    res.status(502).json({ error: 'REST service tidak tersedia.' });
  }
});

const graphqlApiProxy = createProxyMiddleware({
  target: GRAPHQL_API_URL,
  changeOrigin: true,
  ws: true, // WAJIB untuk subscriptions
  onProxyReq: (proxyReq, req, res) => {
    // Teruskan header user yang sudah terotentikasi ke service GraphQL
    if (req.headers['x-user-id']) {
      proxyReq.setHeader('x-user-id', req.headers['x-user-id']);
      proxyReq.setHeader('x-user-email', req.headers['x-user-email']);
      proxyReq.setHeader('x-user-team', req.headers['x-user-team']);
    }
    console.log(`[GW-GQL] Meneruskan rute GraphQL: ${req.body?.operationName || 'WebSocket'}`);
  },
  onError: (err, req, res) => {
    console.error('GraphQL Proxy Error:', err);
    res.status(502).json({ error: 'GraphQL service tidak tersedia.' });
  }
});

// --- Routing Table ---
// Penting: Rute publik yang spesifik HARUS didefinisikan SEBELUM rute terproteksi

// 1. Rute Publik (tanpa autentikasi)
// Menggunakan app.post agar spesifik dan tidak "jatuh" ke middleware /api di bawah
app.post('/api/users/login', restApiProxy);
app.post('/api/users/register', restApiProxy);

// 2. Rute Terproteksi (memerlukan token)
app.use('/api', authenticateToken, restApiProxy); // Melindungi semua rute /api lainnya
app.use('/graphql', authenticateToken, graphqlApiProxy); // Melindungi semua rute /graphql

// --- Server Start ---
app.listen(PORT, () => {
  console.log(`🚀 API Gateway berjalan di port ${PORT}`);
  // Ambil public key saat startup
  fetchPublicKey();
});