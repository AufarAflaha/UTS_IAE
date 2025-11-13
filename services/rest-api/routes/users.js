const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { validateUser, validateUserUpdate } = require('../middleware/validation');

const router = express.Router();

// In-memory database (replace with real database in production)
let users = [
  {
    id: '1',
    name: 'John Doe',
    email: 'john@example.com',
    age: 30,
    role: 'admin',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: '2',
    name: 'Jane Smith',
    email: 'jane@example.com',
    age: 25,
    role: 'user',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

// GET /api/users - Get all users
router.get('/', (req, res) => {
  const { page, limit, role, search } = req.query;
  
  let filteredUsers = [...users];
  
  // Filter by role
  if (role) {
    filteredUsers = filteredUsers.filter(user => user.role === role);
  }
  
  // Search by name or email
  if (search) {
    filteredUsers = filteredUsers.filter(user => 
      user.name.toLowerCase().includes(search.toLowerCase()) ||
      user.email.toLowerCase().includes(search.toLowerCase())
    );
  }
  
  // If pagination params provided, return paginated response
  if (page && limit) {
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedUsers = filteredUsers.slice(startIndex, endIndex);
    
    return res.json({
      users: paginatedUsers,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(filteredUsers.length / limit),
        totalUsers: filteredUsers.length,
        hasNext: endIndex < filteredUsers.length,
        hasPrev: startIndex > 0
      }
    });
  }
  
  // Otherwise return all users as simple array
  res.json(filteredUsers);
});

// GET /api/users/:id - Get user by ID
router.get('/:id', (req, res) => {
  const user = users.find(u => u.id === req.params.id);
  
  if (!user) {
    return res.status(404).json({
      error: 'User not found',
      message: `User with ID ${req.params.id} does not exist`
    });
  }
  
  res.json(user);
});

// POST /api/users - Create new user
router.post('/', validateUser, (req, res) => {
  const { name, email, age, role = 'user' } = req.body;
  
  // Check if email already exists
  const existingUser = users.find(u => u.email === email);
  if (existingUser) {
    return res.status(409).json({
      error: 'Email already exists',
      message: 'A user with this email already exists'
    });
  }
  
  const newUser = {
    id: uuidv4(),
    name,
    email,
    age,
    role,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  users.push(newUser);
  
  res.status(201).json({
    message: 'User created successfully',
    user: newUser
  });
});

// PUT /api/users/:id - Update user
router.put('/:id', validateUserUpdate, (req, res) => {
  const userIndex = users.findIndex(u => u.id === req.params.id);
  
  if (userIndex === -1) {
    return res.status(404).json({
      error: 'User not found',
      message: `User with ID ${req.params.id} does not exist`
    });
  }
  
  const { name, email, age, role } = req.body;
  
  // Check if email already exists (excluding current user)
  if (email) {
    const existingUser = users.find(u => u.email === email && u.id !== req.params.id);
    if (existingUser) {
      return res.status(409).json({
        error: 'Email already exists',
        message: 'A user with this email already exists'
      });
    }
  }
  
  const updatedUser = {
    ...users[userIndex],
    ...(name && { name }),
    ...(email && { email }),
    ...(age && { age }),
    ...(role && { role }),
    updatedAt: new Date().toISOString()
  };
  
  users[userIndex] = updatedUser;
  
  res.json({
    message: 'User updated successfully',
    user: updatedUser
  });
});

// DELETE /api/users/:id - Delete user
router.delete('/:id', (req, res) => {
  const userIndex = users.findIndex(u => u.id === req.params.id);
  
  if (userIndex === -1) {
    return res.status(404).json({
      error: 'User not found',
      message: `User with ID ${req.params.id} does not exist`
    });
  }
  
  const deletedUser = users.splice(userIndex, 1)[0];
  
  res.json({
    message: 'User deleted successfully',
    user: deletedUser
  });
});

module.exports = router;