const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;
const REST_API_URL = process.env.REST_API_URL || 'http://rest-api:3001';
const GRAPHQL_API_URL = process.env.GRAPHQL_API_URL || 'http://graphql-api:4000';

let PUBLIC_KEY_CACHE = null;

// Fetch public key dari User Service
async function fetchPublicKey() {
  try {
    const response = await axios.get(`${REST_API_URL}/public-key`);
    if (response.data && response.data.publicKey) {
      PUBLIC_KEY_CACHE = response.data.publicKey;
      console.log('✅ Public key berhasil diambil dari User Service');
    } else {
      throw new Error('Format public key tidak valid');
    }
  } catch (error) {
    console.error(`❌ Gagal mengambil public key: ${error.message}`);
    console.log('Mencoba lagi dalam 5 detik...');
    setTimeout(fetchPublicKey, 5000);
  }
}

// Middleware autentikasi JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) {
    console.warn('[GW-AUTH] Token tidak ditemukan');
    return res.status(401).json({ error: 'Token tidak ditemukan' });
  }

  if (!PUBLIC_KEY_CACHE) {
    console.error('[GW-AUTH] Public key belum siap');
    return res.status(503).json({ error: 'Service belum siap, coba lagi.' });
  }

  jwt.verify(token, PUBLIC_KEY_CACHE, { algorithms: ['RS256'] }, (err, user) => {
    if (err) {
      console.warn(`[GW-AUTH] Token tidak valid: ${err.message}`);
      return res.status(403).json({ error: 'Token tidak valid' });
    }
    
    req.user = user;
    console.log(`[GW-AUTH] User ${user.email} terotentikasi.`);
    next();
  });
};

// Global middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    publicKeyCached: PUBLIC_KEY_CACHE != null
  });
});

// Public key endpoint
app.get('/public-key', (req, res) => {
  if (PUBLIC_KEY_CACHE) {
    res.json({ publicKey: PUBLIC_KEY_CACHE });
  } else {
    res.status(503).json({ error: 'Public key belum tersedia.' });
  }
});

// LOGIN - Public route (manual forward dengan axios)
app.post('/api/users/login', async (req, res) => {
  try {
    console.log(`[GW-LOGIN] Forwarding login request to ${REST_API_URL}/api/users/login`);
    const response = await axios.post(`${REST_API_URL}/api/users/login`, req.body, {
      headers: { 'Content-Type': 'application/json' }
    });
    console.log(`[GW-LOGIN] Login berhasil, returning token`);
    res.json(response.data);
  } catch (error) {
    console.error(`[GW-LOGIN] Error:`, error.message);
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(502).json({ error: 'REST service tidak tersedia' });
    }
  }
});

// REGISTER - Public route (manual forward dengan axios)
app.post('/api/users/register', async (req, res) => {
  try {
    console.log(`[GW-REGISTER] Forwarding register request to ${REST_API_URL}/api/users/register`);
    const response = await axios.post(`${REST_API_URL}/api/users/register`, req.body, {
      headers: { 'Content-Type': 'application/json' }
    });
    console.log(`[GW-REGISTER] Register berhasil`);
    res.status(response.status).json(response.data);
  } catch (error) {
    console.error(`[GW-REGISTER] Error:`, error.message);
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(502).json({ error: 'REST service tidak tersedia' });
    }
  }
});

// Protected REST API routes
app.use('/api', authenticateToken, async (req, res) => {
  try {
    const url = `${REST_API_URL}${req.url}`;
    console.log(`[GW-PROTECTED] Forwarding ${req.method} to ${url}`);
    
    const response = await axios({
      method: req.method,
      url: url,
      data: req.body,
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': req.user.sub
      }
    });
    
    res.status(response.status).json(response.data);
  } catch (error) {
    console.error(`[GW-PROTECTED] Error:`, error.message);
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(502).json({ error: 'REST service tidak tersedia' });
    }
  }
});

// GraphQL route
app.use('/graphql', authenticateToken, async (req, res) => {
  try {
    const url = `${GRAPHQL_API_URL}/graphql`;
    console.log(`[GW-GQL] Forwarding GraphQL ${req.method} to ${url}`);
    console.log(`[GW-GQL] Request body:`, JSON.stringify(req.body).substring(0, 100));
    console.log(`[GW-GQL] User:`, req.user.email);
    
    const response = await axios({
      method: req.method,
      url: url,
      data: req.body,
      headers: {
        'Content-Type': 'application/json',
        'x-user': encodeURIComponent(JSON.stringify(req.user))
      },
      timeout: 10000 // 10 second timeout
    });
    
    console.log(`[GW-GQL] Response status: ${response.status}`);
    console.log(`[GW-GQL] Response data:`, JSON.stringify(response.data).substring(0, 200));
    console.log(`[GW-GQL] Sending response back to client`);
    res.status(response.status).json(response.data);
    console.log(`[GW-GQL] Response sent successfully`);
  } catch (error) {
    console.error(`[GW-GQL] Error:`, error.message);
    console.error(`[GW-GQL] Error details:`, error.code, error.response?.status);
    if (error.response) {
      console.error(`[GW-GQL] Error response data:`, error.response.data);
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(502).json({ error: 'GraphQL service tidak tersedia', details: error.message });
    }
  }
});

// Server start
app.listen(PORT, () => {
  console.log(`🚀 API Gateway berjalan di port ${PORT}`);
  console.log(`📡 REST API: ${REST_API_URL}`);
  console.log(`📡 GraphQL API: ${GRAPHQL_API_URL}`);
  fetchPublicKey();
});
