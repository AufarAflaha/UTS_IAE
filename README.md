# Microservices Demo Application

This project demonstrates a microservices architecture with:
- REST API service for user management
- GraphQL API service for posts/comments with subscriptions
- API Gateway for routing requests
- Next.js frontend application

## Architecture

```
Frontend (Next.js) → API Gateway → REST API Service
                                → GraphQL API Service
```

## Services

### 1. REST API Service (Port 3001)
- Express.js server
- User CRUD operations
- Endpoints: `/api/users`

### 2. GraphQL API Service (Port 4000)
- Apollo Server with Express
- Posts and comments management
- Supports queries, mutations, and subscriptions
- Endpoint: `/graphql`

### 3. API Gateway (Port 3000)
- Routes requests to appropriate services
- Rate limiting and CORS handling
- Proxy for REST API: `/api/*`
- Proxy for GraphQL: `/graphql`

### 4. Frontend App (Port 3002)
- Next.js with TypeScript
- Apollo Client for GraphQL
- Axios for REST API calls
- Tailwind CSS for styling

## Quick Start

### Using Docker (Recommended)

**Windows Users:**
Simply double-click `start.bat` and choose an option from the menu!

**Or use command line:**

1. **Development mode (with hot-reload):**
   ```bash
   npm run dev
   # or
   docker-compose -f docker-compose.dev.yml up --build
   ```

2. **Production mode:**
   ```bash
   npm start
   # or
   docker-compose up --build
   ```

3. **Stop all services:**
   ```bash
   npm run stop
   # or
   docker-compose down
   ```

### Manual Setup

1. **Install dependencies for all services:**
   ```bash
   npm run install:all
   ```

2. **Start each service individually:**
   ```bash
   # Terminal 1 - REST API
   cd services/rest-api
   npm run dev

   # Terminal 2 - GraphQL API
   cd services/graphql-api
   npm run dev

   # Terminal 3 - API Gateway
   cd api-gateway
   npm run dev

   # Terminal 4 - Frontend
   cd frontend-app
   npm run dev
   ```

## URLs

- Frontend: http://localhost:3002
- API Gateway: http://localhost:3000
- REST API: http://localhost:3001
- GraphQL API: http://localhost:4000/graphql

## API Examples

### REST API (Users)

```bash
# Get all users
curl http://localhost:3000/api/users

# Create user
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"name": "John Doe", "email": "john@example.com"}'

# Get user by ID
curl http://localhost:3000/api/users/1

# Update user
curl -X PUT http://localhost:3000/api/users/1 \
  -H "Content-Type: application/json" \
  -d '{"name": "John Smith", "email": "johnsmith@example.com"}'

# Delete user
curl -X DELETE http://localhost:3000/api/users/1
```

### GraphQL API (Posts)

```graphql
# Query all posts
query {
  posts {
    id
    title
    content
    author
    createdAt
  }
}

# Create a post
mutation {
  createPost(title: "Hello World", content: "This is my first post", author: "John Doe") {
    id
    title
    content
    author
    createdAt
  }
}

# Subscribe to new posts
subscription {
  postAdded {
    id
    title
    content
    author
    createdAt
  }
}
```

## Environment Variables

### API Gateway
- `PORT`: Server port (default: 3000)
- `REST_API_URL`: REST API service URL (default: http://localhost:3001)
- `GRAPHQL_API_URL`: GraphQL API service URL (default: http://localhost:4000)

### Frontend
- `NEXT_PUBLIC_API_GATEWAY_URL`: API Gateway URL (default: http://localhost:3000)
- `NEXT_PUBLIC_GRAPHQL_URL`: GraphQL endpoint URL (default: http://localhost:4000/graphql)

## Project Structure

```
more-complex/
├── api-gateway/                # API Gateway service
│   ├── package.json
│   ├── server.js
│   └── Dockerfile
├── services/
│   ├── rest-api/              # REST API service
│   │   ├── package.json
│   │   ├── server.js
│   │   ├── middleware/
│   │   ├── routes/
│   │   └── Dockerfile
│   └── graphql-api/           # GraphQL API service
│       ├── package.json
│       ├── server.js
│       └── Dockerfile
├── frontend-app/              # Next.js frontend
│   ├── package.json
│   ├── next.config.js
│   ├── src/
│   └── Dockerfile
├── docker-compose.yml         # Production compose
├── docker-compose.dev.yml     # Development compose
└── package.json              # Root package.json
```

## Development Notes

- The frontend uses Apollo Client for GraphQL operations and Axios for REST API calls
- All services include hot-reload in development mode
- Docker volumes are configured for development to enable live code changes
- CORS is properly configured for cross-origin requests
- The API Gateway handles routing and acts as a single entry point

## Features Demonstrated

- **Microservices Architecture**: Separate services for different domains
- **API Gateway Pattern**: Single entry point for all API requests
- **GraphQL Subscriptions**: Real-time updates for posts
- **REST API**: Traditional HTTP API for user management
- **Modern Frontend**: React/Next.js with TypeScript
- **Containerization**: Docker setup for easy deployment
- **Development Environment**: Hot-reload and volume mounting for development