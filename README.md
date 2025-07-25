# Streaming Service

A real-time event streaming service built with Node.js, TypeScript, and Express. This service manages live sports events, handles client connections, and broadcasts event updates in real-time using Server-Sent Events (SSE).

## 🚀 Features

- **Real-time Event Streaming**: Broadcast live event updates to connected clients
- **Multi-Game Support**: Handle multiple games simultaneously (2001, 2002, 2003)
- **Event Lifecycle Management**: Manage event phases (Schedule, Odds, Video, Results)
- **Job Scheduling**: Automated scheduling of event updates and transitions
- **Client Connection Management**: Handle multiple client connections per game
- **RESTful API**: Health checks and authentication endpoints
- **Dependency Injection**: Clean architecture with proper separation of concerns

## 🏗️ Architecture

The service follows a clean, layered architecture with clear separation of concerns:

### Core Services

- **EventManagementService**: Orchestrates the overall event management flow
- **EventSchedulerService**: Handles job scheduling and timing for event updates
- **EventStateManager**: Manages business logic for event state transitions
- **EventStreamService**: Handles client connections and real-time broadcasting
- **OddsFeedService**: External API integration for event data
- **JobScheduler**: Manages scheduled tasks and timeouts

### Data Layer

- **EventState**: Pure data store for current events
- **EventStateManager**: Business logic layer for state management

### Communication

- **Server-Sent Events (SSE)**: Real-time client communication
- **REST API**: Health checks and authentication
- **WebSocket-like**: Persistent connections for live updates

## 📋 Prerequisites

- Node.js (v16 or higher)
- Yarn package manager
- Access to external odds feed API

## 🛠️ Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd streaming-service
   ```

2. **Install dependencies**

   ```bash
   yarn install
   ```

3. **Configure environment**

   ```bash
   cp configs/app-configs.LOCAL.js configs/app-configs.js
   # Edit configs/app-configs.js with your settings
   ```

4. **Build the project**
   ```bash
   yarn build
   ```

## 🚀 Usage

### Development

```bash
# Start development server
yarn dev

# Run tests
yarn test

# Run tests in watch mode
yarn test:watch

# Lint code
yarn lint
```

### Production

```bash
# Build for production
yarn build

# Start production server
yarn start
```

### Docker

```bash
# Build Docker image
docker build -t streaming-service .

# Run container
docker run -p 3000:3000 streaming-service
```

## 📡 API Endpoints

### Health Check

```
GET /health
```

Returns service health status and uptime information.

### Event Stream

```
GET /events/:gameId/stream
```

Establishes SSE connection for real-time event updates.

**Headers Required:**

- `Authorization: Bearer <jwt-token>`

**Response Format:**

```json
{
  "gameId": "2001",
  "eventId": 123456,
  "eventDetailIndex": 0,
  "playlist": "https://example.com/video.m3u8",
  "liveTimeMs": 45000,
  "liveScore": "1:0",
  "videoLength": 0,
  "currentPhase": "UpdateVideoInfo",
  "result": "1-0",
  "message": "Broadcasted updated data"
}
```

### Authentication

```
POST /auth/login
```

Authenticates users and returns JWT tokens.

## 🔧 Configuration

### App Settings (`src/app-settings.ts`)

```typescript
export const appSettings = {
  gameIds: ["2001", "2002", "2003"],
  scheduleDelay: {
    "2001": 10 * 1000, // 10 seconds
    "2002": 10 * 1000,
    "2003": 10 * 1000,
  },
};
```

### Environment Configuration

Create `configs/app-configs.js` based on `configs/app-configs.LOCAL.js`:

```javascript
module.exports = {
  port: process.env.PORT || 3000,
  oddsFeedUrl: process.env.ODDS_FEED_URL,
  jwtSecret: process.env.JWT_SECRET,
  // ... other configuration
};
```

## 🏛️ Project Structure

```
src/
├── app.ts                 # Application entry point
├── app-settings.ts        # Application settings
├── configuration.ts       # Configuration management
├── container-registry.ts  # Dependency injection container
├── controllers/           # HTTP request handlers
│   ├── auth-controller.ts
│   ├── event-stream-controller.ts
│   └── health-controller.ts
├── helpers/              # Utility functions
│   ├── id-helper.ts
│   └── retry-helper.ts
├── middlewares/          # Express middlewares
│   └── verify-jwt.ts
├── models/               # Data models
│   └── operators.ts
├── routes/               # API route definitions
│   └── index.ts
├── services/             # Business logic services
│   ├── authenticate-service.ts
│   ├── event-management-service.ts
│   ├── event-scheduler-service.ts
│   ├── event-stream-service.ts
│   ├── job-scheduler.ts
│   └── odds-feed-service.ts
├── stores/               # Data storage
│   ├── event-state.ts
│   └── event-state-manager.ts
└── types/                # TypeScript type definitions
    └── index.ts
```

## 🔄 Event Lifecycle

The service manages events through different phases:

1. **ScheduleEvent**: Event is scheduled and initialized
2. **UpdateOdds**: Odds become available for betting
3. **UpdateVideoInfo**: Video stream becomes available
4. **UpdateResult**: Event results are published

Each phase triggers:

- State updates in EventStateManager
- Broadcasting to connected clients
- Scheduling of next phase transitions

## 🧪 Testing

```bash
# Run all tests
yarn test

# Run tests with coverage
yarn test:coverage

# Run specific test file
yarn test event-management-service.test.ts
```

## 📊 Monitoring

The service includes built-in monitoring:

- **Health Check Endpoint**: `/health`
- **Client Connection Counts**: Available via EventStreamService
- **Event State Monitoring**: Track current events per game
- **Job Scheduling Status**: Monitor scheduled tasks

## 🔒 Security

- **JWT Authentication**: Required for event stream access
- **Input Validation**: All inputs are validated
- **Error Handling**: Comprehensive error handling without exposing internals
- **Rate Limiting**: Built-in protection against abuse

## 🚀 Deployment

### Environment Variables

```bash
PORT=3000
NODE_ENV=production
ODDS_FEED_URL=https://api.example.com/odds
JWT_SECRET=your-secret-key
```

### Docker Deployment

```bash
# Build image
docker build -t streaming-service .

# Run with environment variables
docker run -d \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e ODDS_FEED_URL=https://api.example.com/odds \
  -e JWT_SECRET=your-secret-key \
  streaming-service
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow TypeScript best practices
- Write unit tests for new features
- Maintain clean architecture principles
- Use dependency injection for services
- Follow the existing code style

## 📝 License

This project is proprietary and confidential.

## 🆘 Support

For support and questions:

- Create an issue in the repository
- Contact the development team
- Check the logs for debugging information

## 🔮 Roadmap

- [ ] Implement event persistence and recovery
- [ ] Add metrics and monitoring dashboard
- [ ] Support for additional game types
- [ ] Enhanced error recovery and resilience
- [ ] Performance optimization for high-load scenarios
