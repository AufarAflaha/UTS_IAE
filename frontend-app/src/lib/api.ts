import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'http://localhost:3000';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// API calls untuk Otentikasi
export const authApi = {
  login: (credentials: { email: string; password: string }) => 
    apiClient.post('/api/users/login', credentials),
    
  register: (userData: any) => // Ganti 'any' dengan tipe yang lebih spesifik
    apiClient.post('/api/users/register', userData),
    
  getUsers: () => apiClient.get('/api/users'), // Rute ini mungkin perlu token
};