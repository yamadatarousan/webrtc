# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a WebRTC video calling application built with React frontend and Node.js backend. The application enables real-time audio/video communication between multiple users in rooms, with integrated chat functionality.

## Architecture

### Technology Stack
- **Frontend**: React 18 + TypeScript 5 + Vite
- **Backend**: Node.js 20 + Express.js + Socket.io
- **WebRTC**: Browser native WebRTC APIs
- **Real-time Communication**: Socket.io for signaling
- **Testing**: Jest for both frontend and backend

### Project Structure
```
webrtc/
├── frontend/           # React application (port 5173)
│   ├── src/
│   │   ├── components/ # UI components (VideoCall, ChatPanel)
│   │   ├── services/   # WebRTC and Socket.io services
│   │   ├── hooks/      # Custom React hooks
│   │   └── types/      # TypeScript definitions
├── backend/            # Node.js server (port 3001)
│   ├── src/
│   │   ├── socket/     # Socket.io handlers
│   │   ├── services/   # Business logic
│   │   ├── routes/     # API endpoints
│   │   └── types/      # TypeScript definitions
└── shared/             # Common type definitions
```

## Development Commands

### Setup and Installation
```bash
# Install all dependencies (root + frontend + backend)
npm run install:all

# Start both frontend and backend concurrently
npm run dev

# Start services individually
npm run dev:frontend   # Port 5173
npm run dev:backend    # Port 3001
```

### Build Commands
```bash
# Build all projects
npm run build:all

# Build individually
npm run build:frontend
npm run build:backend
```

### Testing Commands
```bash
# Run all tests
npm run test:all

# Run tests individually
npm run test:frontend
npm run test:backend

# Watch mode for development
npm run test:watch
```

### Lint Commands
```bash
# Frontend linting
cd frontend && npm run lint

# Backend linting (if available)
npm run lint
```

## Core Services Architecture

### Frontend Services

#### WebRTCService (`frontend/src/services/webrtcService.ts`)
- Manages WebRTC peer connections and media streams
- Handles offer/answer exchange and ICE candidate management
- Integrates with Socket.io for signaling
- Key methods: `initiateCall()`, `handleOffer()`, `handleAnswer()`, `addIceCandidate()`

#### SocketService (`frontend/src/services/socketService.ts`)
- Manages Socket.io connection and event handling
- Handles room management and user presence
- Relays WebRTC signaling messages
- Manages chat functionality

### Backend Architecture

#### SocketHandler (`backend/src/socket/socketHandler.ts`)
- Centralized Socket.io event management
- Room management with in-memory storage (Map<string, Room>)
- User tracking and presence management
- WebRTC signaling relay (offer, answer, ICE candidates)
- Chat message broadcasting
- Automatic cleanup of empty rooms

#### Key Events
- Room: `join-room`, `leave-room`, `user-joined`, `user-left`
- WebRTC: `offer`, `answer`, `ice-candidate`  
- Chat: `chat-message-send`, `chat-message-received`

## WebRTC Flow

1. **Room Join**: User joins room via Socket.io, gets user list
2. **Media Setup**: Browser requests camera/microphone access
3. **Connection Initiation**: First user creates WebRTC offer
4. **Signaling**: Server relays offer/answer/ICE candidates between peers
5. **P2P Connection**: Direct media streaming between browsers
6. **Chat**: Text messages sent via Socket.io to all room participants

## Important Configuration

### Environment Variables (backend/.env)
```
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
STUN_SERVER=stun:stun.l.google.com:19302
```

### TypeScript Configuration
- Root tsconfig.json for shared types
- Frontend: ES modules, DOM types
- Backend: CommonJS, Node types
- Strict mode enabled across all projects

## Development Guidelines

### Working with WebRTC
- HTTPS required for WebRTC APIs (development exception for localhost)
- Always handle getUserMedia() errors gracefully
- Monitor connection states: `connecting`, `connected`, `disconnected`, `failed`
- Clean up peer connections and media streams on component unmount

### Socket.io Development
- Event names are defined in shared types
- Always validate incoming data on server side
- Handle connection/disconnection events properly
- Room capacity is configurable (default: 4 users)

### Testing Considerations
- WebRTC requires browser environment - use mocks for unit tests
- Socket.io tests need server instance setup
- Media streams require device permissions - mock in tests
- Use Jest setup files for common test configuration

## Debugging

### Key Debug Endpoints
- `GET /health` - Server health check
- `GET /api/rooms` - List active rooms (development only)
- `GET /api/users` - List connected users (development only)

### Common Issues
- **Camera/microphone not working**: Check browser permissions
- **Connection fails**: Verify STUN server accessibility
- **Socket disconnection**: Check CORS configuration and network
- **Build issues**: Ensure TypeScript configuration is consistent

### Logging
- Frontend: Browser console logs for WebRTC states
- Backend: Console logs for Socket.io events and room management
- Both services log connection states and errors extensively

## HTTPS Development (if needed)
```bash
# Install mkcert for local SSL certificates
brew install mkcert
mkcert -install
mkcert localhost
# Configure Vite and Express to use certificates
```