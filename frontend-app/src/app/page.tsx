'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, gql } from '@apollo/client';
import { userApi } from '@/lib/api';

// GraphQL queries and mutations
const GET_POSTS = gql`
  query GetPosts {
    posts {
      id
      title
      content
      author
      createdAt
    }
  }
`;

const CREATE_POST = gql`
  mutation CreatePost($title: String!, $content: String!, $author: String!) {
    createPost(title: $title, content: $content, author: $author) {
      id
      title
      content
      author
      createdAt
    }
  }
`;

export default function Home() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newUser, setNewUser] = useState({ name: '', email: '', age: '' });
  const [newPost, setNewPost] = useState({ title: '', content: '', author: '' });

  // GraphQL queries
  const { data: postsData, loading: postsLoading, refetch: refetchPosts } = useQuery(GET_POSTS);
  const [createPost] = useMutation(CREATE_POST);

  // Fetch users from REST API
  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await userApi.getUsers();
      setUsers(response.data);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await userApi.createUser({
        name: newUser.name,
        email: newUser.email,
        age: parseInt(newUser.age)
      });
      setNewUser({ name: '', email: '', age: '' });
      fetchUsers();
    } catch (error) {
      console.error('Error creating user:', error);
    }
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createPost({
        variables: newPost,
      });
      setNewPost({ title: '', content: '', author: '' });
      refetchPosts();
    } catch (error) {
      console.error('Error creating post:', error);
    }
  };

  const handleDeleteUser = async (id: string) => {
    try {
      await userApi.deleteUser(id);
      fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-center text-gray-900 mb-12">
          Microservices Demo App
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Users Section (REST API) */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Users (REST API)</h2>
            
            {/* Create User Form */}
            <form onSubmit={handleCreateUser} className="mb-6">
              <div className="grid grid-cols-1 gap-4">
                <input
                  type="text"
                  placeholder="Name"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  className="border rounded-md px-3 py-2"
                  required
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="border rounded-md px-3 py-2"
                  required
                />
                <input
                  type="number"
                  placeholder="Age"
                  value={newUser.age}
                  onChange={(e) => setNewUser({ ...newUser, age: e.target.value })}
                  className="border rounded-md px-3 py-2"
                  min="1"
                  max="150"
                  required
                />
                <button
                  type="submit"
                  className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
                >
                  Add User
                </button>
              </div>
            </form>

            {/* Users List */}
            {loading ? (
              <p>Loading users...</p>
            ) : (
              <div className="space-y-4">
                {users.map((user: any) => (
                  <div key={user.id} className="flex justify-between items-center p-3 border rounded">
                    <div>
                      <p className="font-semibold">{user.name}</p>
                      <p className="text-gray-600 text-sm">{user.email}</p>
                      <p className="text-gray-500 text-xs">Age: {user.age} • {user.role}</p>
                    </div>
                    <button
                      onClick={() => handleDeleteUser(user.id)}
                      className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Posts Section (GraphQL) */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Posts (GraphQL)</h2>
            
            {/* Create Post Form */}
            <form onSubmit={handleCreatePost} className="mb-6">
              <div className="grid grid-cols-1 gap-4">
                <input
                  type="text"
                  placeholder="Title"
                  value={newPost.title}
                  onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
                  className="border rounded-md px-3 py-2"
                  required
                />
                <textarea
                  placeholder="Content"
                  value={newPost.content}
                  onChange={(e) => setNewPost({ ...newPost, content: e.target.value })}
                  className="border rounded-md px-3 py-2 h-24"
                  required
                />
                <input
                  type="text"
                  placeholder="Author"
                  value={newPost.author}
                  onChange={(e) => setNewPost({ ...newPost, author: e.target.value })}
                  className="border rounded-md px-3 py-2"
                  required
                />
                <button
                  type="submit"
                  className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600"
                >
                  Add Post
                </button>
              </div>
            </form>

            {/* Posts List */}
            {postsLoading ? (
              <p>Loading posts...</p>
            ) : (
              <div className="space-y-4">
                {postsData?.posts.map((post: any) => (
                  <div key={post.id} className="p-4 border rounded">
                    <h3 className="font-semibold text-lg">{post.title}</h3>
                    <p className="text-gray-600 mt-2">{post.content}</p>
                    <div className="flex justify-between items-center mt-3 text-sm text-gray-500">
                      <span>By: {post.author}</span>
                      <span>{new Date(post.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}