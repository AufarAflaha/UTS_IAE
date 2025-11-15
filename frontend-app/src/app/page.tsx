'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { gql, useQuery, useMutation, useApolloClient, ApolloError } from '@apollo/client';
import { authApi } from '@/lib/api';
import axios from 'axios';

// --- Definisi Tipe ---
interface Task {
  id: string;
  title: string;
  status: 'TODO' | 'IN_PROGRESS' | 'DONE';
  team: string;
  assignedTo?: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  team: string;
}

// --- GraphQL Operations ---
const GET_MY_TASKS = gql`
  query GetMyTasks {
    myTasks {
      id
      title
      status
      team
      assignedTo
    }
  }
`;

const CREATE_TASK = gql`
  mutation CreateTask($title: String!) {
    createTask(title: $title) {
      id
      title
      status
    }
  }
`;

const UPDATE_TASK_STATUS = gql`
  mutation UpdateTaskStatus($id: ID!, $status: TaskStatus!) {
    updateTaskStatus(id: $id, status: $status) {
      id
      status
    }
  }
`;

// +++ TAMBAHKAN MUTASI DELETE +++
const DELETE_TASK = gql`
  mutation DeleteTask($id: ID!) {
    deleteTask(id: $id) {
      id
    }
  }
`;
// +++ AKHIR TAMBAHAN +++


export default function Home() {
  const apolloClient = useApolloClient();
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState('user@example.com');
  const [password, setPassword] = useState('password123');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [notification, setNotification] = useState('');

  // State untuk users
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);
  
  // State untuk form user baru
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserTeam, setNewUserTeam] = useState('Team Avengers');


  const handleLogout = useCallback(() => {
    console.log('[LOGOUT] Logging out user...');
    localStorage.removeItem('token');
    window.dispatchEvent(new Event('tokenChanged'));
    setToken(null);
    setNotification('Anda telah logout.');
    apolloClient.clearStore();
    setTeamMembers([]);
  }, [apolloClient]);

  useEffect(() => {
    console.log('[MOUNT] Checking stored token...');
    const storedToken = localStorage.getItem('token');
    if (storedToken) {
      console.log('[MOUNT] Token found');
      setToken(storedToken);
    }
  }, []);

  // --- GraphQL Data Fetching (Tasks) ---
  const { data: tasksData, loading: tasksLoading, refetch: refetchTasks, error: tasksError } = useQuery<{ myTasks: Task[] }>(GET_MY_TASKS, {
    skip: !token,
    fetchPolicy: 'network-only',
  });

  useEffect(() => {
    if (tasksError && token) {
      console.error('[GRAPHQL-ERROR] Error:', tasksError);
      const statusCode = (tasksError.networkError as any)?.statusCode;
      
      if (statusCode === 401 || statusCode === 403) {
        console.warn('[GRAPHQL-ERROR] Auth error, logging out');
        handleLogout();
        setNotification('Sesi Anda berakhir. Silakan login kembali.');
      } else {
        console.warn('[GRAPHQL-ERROR] Non-auth error, staying logged in');
        setNotification(`⚠️ Gagal memuat tasks: ${tasksError.message}`);
      }
    } else if (tasksData) {
      console.log('[GRAPHQL-SUCCESS] Tasks loaded:', tasksData.myTasks.length);
      if (notification.includes('Route not found')) {
        setNotification('');
      }
    }
  }, [tasksError, tasksData, token, handleLogout, notification]);

  // --- REST API Data Fetching (Users) ---
  const fetchTeamMembers = useCallback(async () => {
    if (!token) return;

    console.log('[REST-FETCH] Fetching team members...');
    setUsersLoading(true);
    setUsersError(null);
    try {
      const response = await authApi.getUsers();
      console.log('[REST-FETCH] Users loaded:', response.data.length);
      setTeamMembers(response.data);
      if (notification.includes('Route not found')) {
         setNotification('');
      }
    } catch (error) {
      console.error('[REST-FETCH] Failed:', error);
      let errorMsg = 'Gagal memuat anggota tim.';
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401 || error.response?.status === 403) {
          errorMsg = 'Sesi berakhir. Login kembali.';
          handleLogout();
        } else {
          errorMsg = error.response?.data?.error || errorMsg;
        }
      }
      setUsersError(errorMsg);
      if (errorMsg !== 'Sesi berakhir. Login kembali.') {
        setNotification(`⚠️ ${errorMsg}`);
      }
    } finally {
      setUsersLoading(false);
    }
  }, [token, handleLogout, notification]); 

  useEffect(() => {
    if(token) {
      fetchTeamMembers();
    }
  }, [token, fetchTeamMembers]);

  // --- MUTATIONS ---
  const [createTask] = useMutation(CREATE_TASK, {
    onCompleted: () => {
      console.log('[MUTATION] Task created');
      refetchTasks();
    },
    onError: (error: ApolloError) => { 
      console.error('[MUTATION] Create error:', error);
      setNotification(`Gagal membuat task: ${error.message}`);
    }
  });
  
  const [updateTaskStatus] = useMutation(UPDATE_TASK_STATUS, {
    onCompleted: () => {
      console.log('[MUTATION] Task updated');
      refetchTasks();
    },
    onError: (error: ApolloError) => { 
      console.error('[MUTATION] Update error:', error);
      setNotification(`Gagal update task: ${error.message}`);
    }
  });

  // +++ TAMBAHKAN HOOK MUTASI DELETE +++
  const [deleteTask] = useMutation(DELETE_TASK, {
    onCompleted: (data) => {
      console.log('[MUTATION] Task deleted:', data.deleteTask.id);
      setNotification('Task berhasil dihapus.');
      refetchTasks();
    },
    onError: (error: ApolloError) => { 
      console.error('[MUTATION] Delete error:', error);
      setNotification(`Gagal menghapus task: ${error.message}`);
    }
  });
  // +++ AKHIR TAMBAHAN +++

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotification('');
    console.log('[LOGIN] Attempting login...');
    
    try {
      const response = await authApi.login({ email, password });
      console.log('[LOGIN] Success!');
      
      if (response.data.token) {
        localStorage.setItem('token', response.data.token);
        console.log('[LOGIN] Dispatching tokenChanged event');
        window.dispatchEvent(new Event('tokenChanged'));
        setToken(response.data.token);
        setNotification('Login berhasil!');
        
        setTimeout(() => {
          console.log('[LOGIN] Fetching tasks and users with new client...');
          refetchTasks();
          fetchTeamMembers();
        }, 100);
      }
    } catch (error) {
      console.error('[LOGIN] Failed:', error);
      if (axios.isAxiosError(error)) {
        setNotification(error.response?.data?.error || 'Login gagal');
      } else {
        setNotification('Login gagal');
      }
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    
    console.log('[CREATE-TASK] Creating:', newTaskTitle);
    setNotification('');
    try {
      await createTask({ variables: { title: newTaskTitle } });
      setNewTaskTitle('');
    } catch (error) {
      console.error('[CREATE-TASK] Error:', error);
    }
  };
  
  const handleStatusChange = async (id: string, newStatus: string) => {
    console.log('[UPDATE-TASK] Updating', id, 'to', newStatus);
    setNotification('');
    try {
      await updateTaskStatus({ variables: { id, status: newStatus } });
    } catch (error) {
      console.error('[UPDATE-TASK] Error:', error);
    }
  };

  // +++ TAMBAHKAN HANDLER DELETE +++
  const handleDeleteTask = async (id: string) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus task ini?')) {
      return;
    }
    console.log('[DELETE-TASK] Deleting', id);
    setNotification('');
    try {
      await deleteTask({ variables: { id } });
    } catch (error) {
      console.error('[DELETE-TASK] Error:', error);
    }
  };
  // +++ AKHIR TAMBAHAN +++

  // +++ HANDLER UNTUK CREATE & DELETE USER +++
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotification('');
    console.log('[CREATE-USER] Creating:', newUserEmail);
    try {
      await authApi.register({ 
        name: newUserName, 
        email: newUserEmail, 
        password: newUserPassword,
        team: newUserTeam
      });
      setNotification('User baru berhasil dibuat.');
      // Reset form
      setNewUserName('');
      setNewUserEmail('');
      setNewUserPassword('');
      // Refresh list
      fetchTeamMembers();
    } catch (error) {
      console.error('[CREATE-USER] Failed:', error);
      if (axios.isAxiosError(error)) {
        setNotification(`⚠️ ${error.response?.data?.error || 'Gagal membuat user'}`);
      } else {
        setNotification('⚠️ Gagal membuat user');
      }
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus user ini?')) {
      return;
    }
    console.log('[DELETE-USER] Deleting', id);
    setNotification('');
    try {
      await authApi.deleteUser(id);
      setNotification('User berhasil dihapus.');
      fetchTeamMembers();
    } catch (error) {
      console.error('[DELETE-USER] Failed:', error);
       if (axios.isAxiosError(error)) {
        setNotification(`⚠️ ${error.response?.data?.error || 'Gagal menghapus user'}`);
      } else {
        setNotification('⚠️ Gagal menghapus user');
      }
    }
  };
  // +++ AKHIR HANDLER +++


  if (!token) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
         <div className="bg-white shadow rounded-lg p-8 max-w-md w-full">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-6">
            Login Task Management
          </h2>
          {notification && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {notification}
            </div>
          )}
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border rounded-md px-3 py-2 w-full"
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border rounded-md px-3 py-2 w-full"
              required
            />
            <button
              type="submit"
              className="w-full bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
            >
              Login
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900">
            My Tasks ({tasksData?.myTasks[0]?.team || teamMembers[0]?.team || '...'})
          </h1>
          <button
            onClick={handleLogout}
            className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600"
          >
            Logout
          </button>
        </div>
        
        {notification && (
          <div className={`px-4 py-3 rounded mb-4 ${
            notification.includes('⚠️') || notification.includes('Gagal')
              ? 'bg-yellow-100 border border-yellow-400 text-yellow-700'
              : 'bg-green-100 border border-green-400 text-green-700'
          }`}>
            {notification}
          </div>
        )}

        <div className="bg-white shadow rounded-lg p-6 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Buat Task Baru</h2>
          <form onSubmit={handleCreateTask} className="flex gap-4">
            <input
              type="text"
              placeholder="Judul task baru..."
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              className="border rounded-md px-3 py-2 w-full"
              required
            />
            <button
              type="submit"
              className="bg-green-500 text-white px-6 py-2 rounded-md hover:bg-green-600 whitespace-nowrap"
            >
              Tambah
            </button>
          </form>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* --- KARTU DAFTAR TASK --- */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Daftar Task</h2>
            {tasksLoading ? (
              <p className="text-gray-500">Loading tasks...</p>
            ) : tasksError ? (
              <p className="text-red-500">Error loading tasks. Please try refreshing the page.</p>
            ) : (
              <div className="space-y-4">
                {tasksData?.myTasks && tasksData.myTasks.length > 0 ? (
                  tasksData.myTasks.map((task: Task) => (
                    <div key={task.id} className="flex justify-between items-center p-4 border rounded-md hover:bg-gray-50">
                      <div>
                        <p className="font-semibold text-lg">{task.title}</p>
                        <p className="text-gray-500 text-sm">
                          Assignee: {task.assignedTo || 'Belum ada'}
                        </p>
                      </div>
                      
                      {/* +++ GROUPING TOMBOL KANAN +++ */}
                      <div className="flex items-center gap-2">
                        <select
                          value={task.status}
                          onChange={(e) => handleStatusChange(task.id, e.target.value)}
                          className="border rounded-md px-3 py-2 bg-white"
                        >
                          <option value="TODO">To Do</option>
                          <option value="IN_PROGRESS">In Progress</option>
                          <option value="DONE">Done</option>
                        </select>
                        {/* +++ TOMBOL DELETE +++ */}
                        <button
                          onClick={() => handleDeleteTask(task.id)}
                          className="text-red-500 hover:text-red-700 font-bold text-xl px-2 py-1"
                          title="Hapus task"
                        >
                          &times;
                        </button>
                        {/* +++ AKHIR TOMBOL DELETE +++ */}
                      </div>
                      {/* +++ AKHIR GROUPING +++ */}
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500">Belum ada task di tim Anda.</p>
                )}
              </div>
            )}
          </div>

          {/* --- KARTU ANGGOTA TIM (DENGAN CRUD) --- */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">User Accounts (Tim Anda)</h2>
            
            {/* +++ FORM BUAT USER BARU +++ */}
            <form onSubmit={handleCreateUser} className="space-y-4 mb-6 pb-6 border-b">
              <input
                type="text"
                placeholder="Nama Lengkap"
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                className="border rounded-md px-3 py-2 w-full"
                required
              />
              <input
                type="email"
                placeholder="Email"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                className="border rounded-md px-3 py-2 w-full"
                required
              />
              <input
                type="password"
                placeholder="Password"
                value={newUserPassword}
                onChange={(e) => setNewUserPassword(e.target.value)}
                className="border rounded-md px-3 py-2 w-full"
                required
              />
              <input
                type="text"
                placeholder="Team"
                value={newUserTeam}
                onChange={(e) => setNewUserTeam(e.target.value)}
                className="border rounded-md px-3 py-2 w-full"
                required
              />
              <button
                type="submit"
                className="w-full bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
              >
                Buat User Baru
              </button>
            </form>
            {/* +++ AKHIR FORM +++ */}
            
            {usersLoading ? (
              <p className="text-gray-500">Loading anggota tim...</p>
            ) : usersError ? (
              <p className="text-red-500">{usersError}</p>
            ) : (
              <div className="space-y-4">
                {teamMembers.length > 0 ? (
                  teamMembers.map((user: User) => (
                    <div key={user.id} className="flex justify-between items-center p-4 border rounded-md">
                      <div>
                        <p className="font-semibold text-lg">{user.name}</p>
                        <p className="text-gray-500 text-sm">Email: {user.email}</p>
                        <p className="text-gray-500 text-sm">Tim: {user.team}</p>
                      </div>
                      {/* +++ TOMBOL DELETE USER +++ */}
                      <button
                        onClick={() => handleDeleteUser(user.id)}
                        className="text-red-500 hover:text-red-700 font-bold text-xl px-2 py-1"
                        title="Hapus user"
                      >
                        &times;
                      </button>
                      {/* +++ AKHIR TOMBOL +++ */}
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500">Tidak dapat menemukan anggota tim.</p>
                )}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}