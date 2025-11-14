// 1. IMPORT
const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@apollo/server/express4');
const { createServer } = require('http');
const { WebSocketServer } = require('ws');
const { useServer } = require('graphql-ws/lib/use/ws');
const { makeExecutableSchema } = require('@graphql-tools/schema');
const express = require('express');
const cors = require('cors');
const { PubSub } = require('graphql-subscriptions');
const { v4: uuidv4 } = require('uuid');

const pubsub = new PubSub();

// 2. DATA IN-MEMORY (Diganti menjadi Tasks)
let tasks = [
  {
    id: '1',
    title: 'Desain Arsitektur Microservices',
    status: 'IN_PROGRESS',
    team: 'Team Avengers',
    assignedTo: 'user@example.com',
    createdAt: new Date().toISOString(),
  },
  {
    id: '2',
    title: 'Implementasi JWT (Asymmetric)',
    status: 'TODO',
    team: 'Team Avengers',
    assignedTo: null,
    createdAt: new Date().toISOString(),
  },
  {
    id: '3',
    title: 'Setup Frontend CI/CD',
    status: 'TODO',
    team: 'Team JusticeLeague',
    assignedTo: null,
    createdAt: new Date().toISOString(),
  }
];

// 3. TYPEDEFS (Diganti menjadi Tasks)
const typeDefs = `
  enum TaskStatus {
    TODO
    IN_PROGRESS
    DONE
  }

  type Task {
    id: ID!
    title: String!
    status: TaskStatus!
    team: String!
    assignedTo: String
    createdAt: String!
  }

  type Query {
    # Mengambil task berdasarkan tim dari user yang login
    myTasks: [Task!]!
    allTasks: [Task!]!
  }

  type Mutation {
    createTask(title: String!): Task!
    updateTaskStatus(id: ID!, status: TaskStatus!): Task!
  }

  type Subscription {
    # Notifikasi real-time untuk task baru di tim Anda
    taskAdded: Task!
    # Notifikasi real-time untuk update status
    taskUpdated: Task!
  }
`;

// 4. RESOLVERS (Diganti menjadi Tasks)
const resolvers = {
  Query: {
    // 'context.user' akan dikirim oleh API Gateway
    myTasks: (parent, args, context) => {
      if (!context.user) {
        throw new Error('401 - Anda harus login untuk melihat task');
      }
      return tasks.filter(task => task.team === context.user.team);
    },
    allTasks: () => tasks,
  },

  Mutation: {
    createTask: (parent, { title }, context) => {
      if (!context.user) {
        throw new Error('401 - Anda harus login untuk membuat task');
      }
      
      const newTask = {
        id: uuidv4(),
        title,
        status: 'TODO',
        team: context.user.team, // Otomatis set tim dari user
        assignedTo: context.user.email,
        createdAt: new Date().toISOString(),
      };
      tasks.push(newTask);
      
      // Publish notifikasi
      pubsub.publish('TASK_ADDED', { taskAdded: newTask });
      console.log('Task baru dibuat:', newTask.title);
      
      return newTask;
    },

    updateTaskStatus: (parent, { id, status }, context) => {
      if (!context.user) {
        throw new Error('401 - Anda harus login untuk update task');
      }
      
      const taskIndex = tasks.findIndex(task => task.id === id);
      if (taskIndex === -1) {
        throw new Error('404 - Task tidak ditemukan');
      }
      
      // Pastikan user hanya bisa update task di timnya
      if (tasks[taskIndex].team !== context.user.team) {
         throw new Error('403 - Akses ditolak: Anda tidak berada di tim ini');
      }

      tasks[taskIndex].status = status;
      const updatedTask = tasks[taskIndex];
      
      // Publish notifikasi
      pubsub.publish('TASK_UPDATED', { taskUpdated: updatedTask });
      console.log('Task diupdate:', updatedTask.title);

      return updatedTask;
    },
  },

  Subscription: {
    taskAdded: {
      subscribe: () => pubsub.asyncIterator(['TASK_ADDED']),
      // TODO: Filter notifikasi di sini berdasarkan tim user
    },
    taskUpdated: {
      subscribe: () => pubsub.asyncIterator(['TASK_UPDATED']),
    },
  },
};

// 5. SERVER STARTUP (GAYA v4)
async function startServer() {
  const app = express();
  const httpServer = createServer(app);

  const schema = makeExecutableSchema({ typeDefs, resolvers });

  // Setup WebSocket Server
  const wsServer = new WebSocketServer({
    server: httpServer,
    path: '/graphql',
  });
  
  // 'useServer' membutuhkan 'context' untuk koneksi WebSocket
  const serverCleanup = useServer({ 
    schema,
    context: async (ctx) => {
      // Otentikasi WebSocket dari API Gateway
      // Gateway akan meneruskan header 'x-user'
      try {
        const userJson = ctx.extra.request.headers['x-user'];
        const user = userJson ? JSON.parse(decodeURIComponent(userJson)) : null;
        if (!user) throw new Error('User tidak terautentikasi');
        console.log(`[WS] User terhubung: ${user.email}`);
        return { user };
      } catch (err) {
        console.error('[WS] Gagal autentikasi:', err.message);
        // Menutup koneksi jika tidak valid
        // Kode 1008 = Policy Violation
        return new Error(err.message, { code: 1008 });
      }
    }
  }, wsServer);

  // Setup Apollo Server
  const server = new ApolloServer({
    schema,
    plugins: [
      {
        async serverWillStart() {
          return {
            async drainServer() {
              await serverCleanup.dispose();
            },
          };
        },
      },
    ],
  });

  await server.start();

  // Terapkan middleware
  app.use(
    '/graphql',
    cors(),
    express.json(),
    // 'context' akan menerima info user dari header 'x-user' yang di-set oleh Gateway
    expressMiddleware(server, {
      context: async ({ req }) => {
        try {
          // Ambil user data yang sudah diverifikasi oleh Gateway
          const userJson = req.headers['x-user'];
          const user = userJson ? JSON.parse(decodeURIComponent(userJson)) : null;
          return { user };
        } catch (err) {
          console.error('Error parsing user data from gateway:', err.message);
          return {};
        }
      },
    })
  );

  // Health check
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      service: 'task-service',
      timestamp: new Date().toISOString(),
    });
  });
  
  // Error handling
  app.use((err, req, res, next) => {
    console.error('Task Service Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  // Jalankan server
  const PORT = process.env.PORT || 4000;
  httpServer.listen(PORT, () => {
    console.log(`🚀 Task Service (GraphQL) berjalan di http://localhost:${PORT}/graphql`);
    console.log(`🚀 Subscriptions berjalan di ws://localhost:${PORT}/graphql`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    httpServer.close(() => {
      console.log('Process terminated');
    });
  });
}

startServer().catch(error => {
  console.error('Failed to start Task server:', error);
  process.exit(1);
});