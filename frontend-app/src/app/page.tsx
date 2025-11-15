'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { gql, useQuery, useMutation, useApolloClient } from '@apollo/client';
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

export default function Home() {
  const apolloClient = useApolloClient();
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState('user@example.com');
  const [password, setPassword] = useState('password123');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [notification, setNotification] = useState('');

  const handleLogout = useCallback(() => {
    console.log('[LOGOUT] Logging out user...');
    localStorage.removeItem('token');
    window.dispatchEvent(new Event('tokenChanged'));
    setToken(null);
    setNotification('Anda telah logout.');
    apolloClient.clearStore();
  }, [apolloClient]);

  useEffect(() => {
    console.log('[MOUNT] Checking stored token...');
    const storedToken = localStorage.getItem('token');
    if (storedToken) {
      console.log('[MOUNT] Token found');
      setToken(storedToken);
    }
  }, []);

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
      setNotification('');
    }
  }, [tasksError, tasksData, token, handleLogout]);

  const [createTask] = useMutation(CREATE_TASK, {
    onCompleted: () => {
      console.log('[MUTATION] Task created');
      refetchTasks();
    },
    onError: (error) => {
      console.error('[MUTATION] Create error:', error);
      setNotification(`Gagal membuat task: ${error.message}`);
    }
  });
  
  const [updateTaskStatus] = useMutation(UPDATE_TASK_STATUS, {
    onCompleted: () => {
      console.log('[MUTATION] Task updated');
      refetchTasks();
    },
    onError: (error) => {
      console.error('[MUTATION] Update error:', error);
      setNotification(`Gagal update task: ${error.message}`);
    }
  });

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
          console.log('[LOGIN] Fetching tasks with new client...');
          refetchTasks();
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
    try {
      await createTask({ variables: { title: newTaskTitle } });
      setNewTaskTitle('');
    } catch (error) {
      console.error('[CREATE-TASK] Error:', error);
    }
  };
  
  const handleStatusChange = async (id: string, newStatus: string) => {
    console.log('[UPDATE-TASK] Updating', id, 'to', newStatus);
    try {
      await updateTaskStatus({ variables: { id, status: newStatus } });
    } catch (error) {
      console.error('[UPDATE-TASK] Error:', error);
    }
  };

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
            My Tasks ({tasksData?.myTasks[0]?.team || '...'})
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
              : 'bg-blue-100 border border-blue-400 text-blue-700'
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
                    <select
                      value={task.status}
                      onChange={(e) => handleStatusChange(task.id, e.target.value)}
                      className="border rounded-md px-3 py-2 bg-white"
                    >
                      <option value="TODO">To Do</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="DONE">Done</option>
                    </select>
                  </div>
                ))
              ) : (
                <p className="text-gray-500">Belum ada task di tim Anda.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
