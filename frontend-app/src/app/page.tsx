'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, gql, useSubscription } from '@apollo/client';
import { authApi } from '@/lib/api';
import axios from 'axios'; // Diperlukan untuk type checking error

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

const TASK_UPDATED_SUBSCRIPTION = gql`
  subscription OnTaskUpdated {
    taskUpdated {
      id
      title
      status
    }
  }
`;
// -------------------------


export default function Home() {
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState('user@example.com');
  const [password, setPassword] = useState('password123');
  
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [notification, setNotification] = useState('');

  // Cek token di local storage saat mount
  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    if (storedToken) {
      setToken(storedToken);
    }
  }, []);

  // --- GraphQL Hooks ---
  const { data: tasksData, loading: tasksLoading, refetch: refetchTasks } = useQuery<{ myTasks: Task[] }>(GET_MY_TASKS, {
    skip: !token, // Jangan jalankan query jika belum login
    onError: (error) => {
      // Jika token expired
      if (error.message.includes('401') || error.message.includes('403')) {
        handleLogout();
        setNotification('Sesi Anda berakhir. Silakan login kembali.');
      }
    }
  });

  const [createTask] = useMutation(CREATE_TASK, {
    onCompleted: () => refetchTasks() // Ambil ulang data setelah mutasi
  });
  
  const [updateTaskStatus] = useMutation(UPDATE_TASK_STATUS, {
     onCompleted: () => refetchTasks()
  });

  // --- Subscription Hook ---
  useSubscription(TASK_UPDATED_SUBSCRIPTION, {
    skip: !token,
    onData: ({ data }) => {
      const task = data.data.taskUpdated;
      setNotification(`NOTIFIKASI: Task '${task.title}' diupdate ke status ${task.status}!`);
    },
    onError: (error) => { // Menambahkan error handling di subscription
      console.error('Subscription error:', error);
      setNotification(`Koneksi real-time error: ${error.message}`);
    }
  });
  // -------------------------

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotification('');
    try {
      const response = await authApi.login({ email, password });
      if (response.data.token) {
        localStorage.setItem('token', response.data.token);
        setToken(response.data.token);
        refetchTasks(); // Ambil tasks setelah login
      }
    } catch (error) {
      console.error('Error logging in:', error);
      // Cek jika ini AxiosError
      if (axios.isAxiosError(error)) {
        setNotification(error.response?.data?.error || 'Login gagal');
      } else if (error instanceof Error) {
        setNotification(error.message); // Fallback untuk error standar
      } else {
        setNotification('Terjadi error tidak dikenal saat login');
      }
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setNotification('Anda telah logout.');
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle) return;
    try {
      await createTask({ variables: { title: newTaskTitle } });
      setNewTaskTitle('');
    } catch (error) { // error di sini aslinya 'unknown'
      console.error('Error creating task:', error);
      // Tambahkan type checking
      if (error instanceof Error) {
        setNotification(`Gagal membuat task: ${error.message}`);
      } else {
        setNotification('Gagal membuat task: Terjadi error tidak dikenal');
      }
    }
  };
  
  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      await updateTaskStatus({ variables: { id, status: newStatus } });
    } catch (error) { // error di sini aslinya 'unknown'
      console.error('Error updating task:', error);
      // Tambahkan type checking
      if (error instanceof Error) {
        setNotification(`Gagal update task: ${error.message}`);
      } else {
        setNotification('Gagal update task: Terjadi error tidak dikenal');
      }
    }
  };


  // --- Render ---

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
            <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4">
              {notification}
            </div>
        )}

        {/* Create Task */}
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
              className="bg-green-500 text-white px-6 py-2 rounded-md hover:bg-green-600"
            >
              Tambah
            </button>
          </form>
        </div>

        {/* Task List */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Daftar Task</h2>
          {tasksLoading ? (
            <p>Loading tasks...</p>
          ) : (
            <div className="space-y-4">
              {tasksData?.myTasks.map((task: Task) => (
                <div key={task.id} className="flex justify-between items-center p-4 border rounded-md">
                  <div>
                    <p className="font-semibold text-lg">{task.title}</p>
                    <p className="text-gray-500 text-sm">
                      Assignee: {task.assignedTo || 'Belum ada'}
                    </p>
                  </div>
                  <select
                    value={task.status}
                    onChange={(e) => handleStatusChange(task.id, e.target.value)}
                    className="border rounded-md px-3 py-2"
                  >
                    <option value="TODO">To Do</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="DONE">Done</option>
                  </select>
                </div>
              ))}
              {tasksData?.myTasks.length === 0 && <p>Belum ada task di tim Anda.</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}