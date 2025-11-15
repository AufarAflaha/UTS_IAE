import axios from 'axios';

const API_BASE_URL =
  ((globalThis as any).process?.env?.NEXT_PUBLIC_API_GATEWAY_URL as string | undefined) ||
  'http://localhost:3000';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor untuk menambahkan token otentikasi ke setiap request
apiClient.interceptors.request.use(
  (config) => {
    // Ambil token dari localStorage di sisi client
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// API calls untuk Otentikasi
export const authApi = {
  login: (credentials: { email: string; password: string }) => 
    apiClient.post('/api/users/login', credentials),
    
  register: (userData: any) => // Ganti 'any' dengan tipe yang lebih spesifik
    apiClient.post('/api/users/register', userData),
    
  getUsers: () => apiClient.get('/api/users'),
  deleteUser: (id: string) => apiClient.delete(`/api/users/${id}`), // Rute ini sekarang akan mengirimkan token
};