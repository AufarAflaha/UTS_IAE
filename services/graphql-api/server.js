// 1. IMPORT (GAYA v4 + KEBUTUHAN ANDA)
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

// 2. DATA IN-MEMORY ANDA (SAMA SEPERTI FILE LAMA ANDA)
let posts = [
  {
    id: '1',
    title: 'Welcome to GraphQL',
    content: 'This is our first GraphQL post with subscriptions!',
    author: 'GraphQL Team',
    createdAt: new Date().toISOString(),
  },
  {
    id: '2',
    title: 'Real-time Updates',
    content: 'Watch this space for real-time updates using GraphQL subscriptions.',
    author: 'Development Team',
    createdAt: new Date().toISOString(),
  }
];

let comments = [
  {
    id: '1',
    postId: '1',
    content: 'Great introduction to GraphQL!',
    author: 'John Doe',
    createdAt: new Date().toISOString(),
  }
];


// 3. TYPEDEFS ANDA (SAMA SEPERTI FILE LAMA ANDA)
const typeDefs = `
  type Post {
    id: ID!
    title: String!
    content: String!
    author: String!
    createdAt: String!
    comments: [Comment!]!
  }

  type Comment {
    id: ID!
    postId: ID!
    content: String!
    author: String!
    createdAt: String!
  }

  type Query {
    posts: [Post!]!
    post(id: ID!): Post
    comments(postId: ID!): [Comment!]!
  }

  type Mutation {
    createPost(title: String!, content: String!, author: String!): Post!
    updatePost(id: ID!, title: String, content: String): Post!
    deletePost(id: ID!): Boolean!
    createComment(postId: ID!, content: String!, author: String!): Comment!
    deleteComment(id: ID!): Boolean!
  }

  type Subscription {
    postAdded: Post!
    commentAdded: Comment!
    postUpdated: Post!
    postDeleted: ID!
  }
`;

// 4. RESOLVERS ANDA (SAMA SEPERTI FILE LAMA ANDA)
const resolvers = {
  Query: {
    posts: () => posts,
    post: (_, { id }) => posts.find(post => post.id === id),
    comments: (_, { postId }) => comments.filter(comment => comment.postId === postId),
  },

  Post: {
    comments: (parent) => comments.filter(comment => comment.postId === parent.id),
  },

  Mutation: {
    createPost: (_, { title, content, author }) => {
      const newPost = {
        id: uuidv4(),
        title,
        content,
        author,
        createdAt: new Date().toISOString(),
      };
      posts.push(newPost);
      pubsub.publish('POST_ADDED', { postAdded: newPost });
      return newPost;
    },

    updatePost: (_, { id, title, content }) => {
      const postIndex = posts.findIndex(post => post.id === id);
      if (postIndex === -1) throw new Error('Post not found');
      const updatedPost = { ...posts[postIndex], ...(title && { title }), ...(content && { content }) };
      posts[postIndex] = updatedPost;
      pubsub.publish('POST_UPDATED', { postUpdated: updatedPost });
      return updatedPost;
    },

    deletePost: (_, { id }) => {
      const postIndex = posts.findIndex(post => post.id === id);
      if (postIndex === -1) return false;
      comments = comments.filter(comment => comment.postId !== id);
      posts.splice(postIndex, 1);
      pubsub.publish('POST_DELETED', { postDeleted: id });
      return true;
    },

    createComment: (_, { postId, content, author }) => {
      const post = posts.find(p => p.id === postId);
      if (!post) throw new Error('Post not found');
      const newComment = { id: uuidv4(), postId, content, author, createdAt: new Date().toISOString() };
      comments.push(newComment);
      pubsub.publish('COMMENT_ADDED', { commentAdded: newComment });
      return newComment;
    },

    deleteComment: (_, { id }) => {
      const commentIndex = comments.findIndex(comment => comment.id === id);
      if (commentIndex === -1) return false;
      comments.splice(commentIndex, 1);
      return true;
    },
  },

  Subscription: {
    postAdded: { subscribe: () => pubsub.asyncIterator(['POST_ADDED']) },
    commentAdded: { subscribe: () => pubsub.asyncIterator(['COMMENT_ADDED']) },
    postUpdated: { subscribe: () => pubsub.asyncIterator(['POST_UPDATED']) },
    postDeleted: { subscribe: () => pubsub.asyncIterator(['POST_DELETED']) },
  },
};

// 5. SERVER STARTUP (GAYA v4)
async function startServer() {
  const app = express();
  const httpServer = createServer(app);

  // Buat schema agar bisa dipakai di 2 tempat
  const schema = makeExecutableSchema({ typeDefs, resolvers });

  // Setup WebSocket Server untuk Subscriptions
  const wsServer = new WebSocketServer({
    server: httpServer,
    path: '/graphql', // Path yang sama dengan Apollo Server
  });
  const serverCleanup = useServer({ schema }, wsServer);

  // Setup Apollo Server untuk Query/Mutation
  const server = new ApolloServer({
    schema,
    context: ({ req }) => ({ req }), // Konteks Anda dari file lama
    plugins: [
      // 1. Plugin logging Anda dari file lama
      {
        requestDidStart() {
          return {
            willSendResponse(requestContext) {
              console.log(`GraphQL ${requestContext.request.operationName || 'Anonymous'} operation completed`);
            },
          };
        },
      },
      // 2. Plugin wajib v4 untuk shutdown WebSocket
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

  // Terapkan middleware (CORS dulu, baru Apollo)
  app.use(
    '/graphql',
    cors({ /* Opsi CORS Anda bisa ditaruh di sini jika perlu */ }),
    express.json(),
    expressMiddleware(server, {
        context: async ({ req }) => ({ req }), // Konteks juga bisa ditaruh di sini
    })
  );

  // Health check endpoint Anda dari file lama
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      service: 'graphql-api',
      timestamp: new Date().toISOString(),
      data: { posts: posts.length, comments: comments.length }
    });
  });
  
  // Error handling Anda dari file lama
  app.use((err, req, res, next) => {
    console.error('GraphQL API Error:', err);
    res.status(500).json({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
  });

  // Jalankan server gabungan
  const PORT = process.env.PORT || 4000;
  httpServer.listen(PORT, () => {
    console.log(`🚀 Query server ready at http://localhost:${PORT}/graphql`);
    console.log(`🚀 Subscription server ready at ws://localhost:${PORT}/graphql`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
  });

  // Graceful shutdown Anda dari file lama
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    httpServer.close(() => {
      console.log('Process terminated');
    });
  });
}

startServer().catch(error => {
  console.error('Failed to start GraphQL server:', error);
  process.exit(1);
});