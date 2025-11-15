const express = require('express');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs'); // <-- Ganti dari bcryptsdo
const jwt = require('jsonwebtoken');
// Hapus validateUser, kita akan validasi manual sederhana
const { validateUserUpdate } = require('../middleware/validation');

// --- DATABASE SEMENTARA ---
const users = [
  {
    id: '1',
    name: 'User Utama',
    email: 'user@example.com',
    passwordHash: bcrypt.hashSync('password123', 10), // Enkripsi password
    team: 'Team Avengers', // <-- GANTI TIM
    role: 'admin',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];
// ----------------------------

// Modul ini sekarang menerima privateKey sebagai argumen
module.exports = (privateKey) => {
  const router = express.Router();

  // --- RUTE OTENTIKASI (BARU) ---

  // POST /api/users/register
  // Hapus middleware validateUser agar lebih mudah untuk form baru
  router.post('/register', async (req, res) => {
    // Validasi sederhana
    const { name, email, password, team } = req.body;
    if (!name || !email || !password || !team) {
      return res.status(400).json({ error: 'Name, email, password, dan team diperlukan' });
    }
    
    const existingUser = users.find(u => u.email === email);
    if (existingUser) {
      return res.status(409).json({ error: 'Email sudah terdaftar' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = {
      id: uuidv4(),
      name,
      email,
      passwordHash,
      team,
      role: 'user', // Default role
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    users.push(newUser);
    
    console.log(`[AUTH] User baru terdaftar: ${email}`);
    res.status(201).json({
      message: 'User berhasil didaftarkan',
      user: { id: newUser.id, name: newUser.name, email: newUser.email, team: newUser.team }
    });
  });

  // POST /api/users/login
  router.post('/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      
      const user = users.find(u => u.email === email);
      if (!user) {
        return res.status(401).json({ error: 'Email atau password salah' });
      }

      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (!isMatch) {
        return res.status(401).json({ error: 'Email atau password salah' });
      }

      const payload = {
        sub: user.id,
        email: user.email,
        team: user.team,
        role: user.role,
        name: user.name 
      };

      // Tandatangani token dengan PRIVATE KEY
      const token = jwt.sign(payload, privateKey, { 
        algorithm: 'RS256', // <-- Algoritma 'RS256' SUDAH BENAR
        expiresIn: '1h' 
      });
      
      console.log(`[AUTH] User login berhasil: ${email}`);
      res.json({
        message: 'Login berhasil',
        token: token,
        user: { id: user.id, name: user.name, email: user.email, team: user.team }
      });
    } catch (err) {
      console.error('[AUTH] Error saat login:', err);
      res.status(500).json({ error: 'Internal server error saat login' });
    }
  });


  // --- RUTE CRUD USER (TERPROTEKSI) ---

  // GET /api/users - Get all users
  router.get('/', (req, res) => {
    const authUserId = req.headers['x-user-id'];
    console.log(`[USERS] /api/users diakses oleh user: ${authUserId}`);
    
    const safeUsers = users.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      team: u.team
    }));
    res.json(safeUsers);
  });

  // GET /api/users/:id - Get user by ID
  router.get('/:id', (req, res) => {
    const user = users.find(u => u.id === req.params.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      team: user.team
    });
  });
  
  // +++ TAMBAHKAN RUTE DELETE /api/users/:id +++
  router.delete('/:id', (req, res) => {
    const authUserId = req.headers['x-user-id'];
    const userIdToDelete = req.params.id;

    // Cek admin (atau logika bisnis lainnya)
    const adminUser = users.find(u => u.id === authUserId);
    if (!adminUser || adminUser.role !== 'admin') {
      return res.status(403).json({ error: 'Akses ditolak: Hanya admin yang bisa menghapus user' });
    }
    
    // Jangan biarkan user menghapus dirinya sendiri
    if (authUserId === userIdToDelete) {
      return res.status(400).json({ error: 'Tidak dapat menghapus diri sendiri' });
    }
    
    const userIndex = users.findIndex(u => u.id === userIdToDelete);
    if (userIndex === -1) {
      return res.status(404).json({ error: 'User not found' });
    }

    const [deletedUser] = users.splice(userIndex, 1);
    console.log(`[USERS] User ${deletedUser.email} dihapus oleh ${adminUser.email}`);
    
    res.json({ message: 'User berhasil dihapus', id: deletedUser.id });
  });
  // +++ AKHIR TAMBAHAN +++

  return router;
};