import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { ClientToServerEvents, ServerToClientEvents } from './types';

// 環境変数の読み込み
dotenv.config();

const app = express();
const server = createServer(app);

// Socket.ioサーバーの初期化（型安全）
const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// ミドルウェアの設定
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true
}));
app.use(express.json());

// 基本的なルート
app.get('/health', (_req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'WebRTC Video Call Backend'
  });
});

// Socket.ioイベントハンドラー
io.on('connection', (socket) => {
  console.log(`ユーザーが接続しました: ${socket.id}`);

  // ルーム参加
  socket.on('join-room', (roomId: string, userId: string) => {
    socket.join(roomId);
    socket.to(roomId).emit('user-joined', {
      id: userId,
      name: userId, // 仮の実装
      isHost: false,
      joinedAt: Date.now()
    });
    console.log(`ユーザー ${userId} がルーム ${roomId} に参加しました`);
  });

  // ルーム退出
  socket.on('leave-room', (roomId: string, userId: string) => {
    socket.leave(roomId);
    socket.to(roomId).emit('user-left', userId);
    console.log(`ユーザー ${userId} がルーム ${roomId} から退出しました`);
  });

  // シグナリング
  socket.on('signal', (message) => {
    socket.to(message.roomId).emit('signal', message);
  });

  // メディア切り替え
  socket.on('toggle-media', (roomId: string, userId: string, type: 'video' | 'audio', enabled: boolean) => {
    socket.to(roomId).emit('user-joined', {
      id: userId,
      name: userId,
      isHost: false,
      joinedAt: Date.now()
    });
    console.log(`ユーザー ${userId} が ${type} を ${enabled ? '有効' : '無効'} にしました`);
  });

  // 切断処理
  socket.on('disconnect', () => {
    console.log(`ユーザーが切断しました: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`🚀 WebRTCサーバーがポート ${PORT} で起動しました`);
  console.log(`📡 Socket.ioサーバーが準備完了`);
  console.log(`🌐 CORS設定: ${process.env.FRONTEND_URL || "http://localhost:5173"}`);
}); 