import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { SocketHandler } from './socket/socketHandler';

// 環境変数の読み込み
dotenv.config();

const app = express();
const server = createServer(app);

// Socket.ioサーバーの初期化
const io = new Server(server, {
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

// Socket.ioハンドラーを初期化
const socketHandler = new SocketHandler(io);

// 基本的なルート
app.get('/health', (_req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'WebRTC Signaling Server'
  });
});

// デバッグ用API: ルーム情報を取得
app.get('/api/rooms', (_req, res) => {
  try {
    const rooms = socketHandler.getRooms();
    res.json({ success: true, rooms });
  } catch (error) {
    console.error('ルーム情報取得エラー:', error);
    res.status(500).json({ success: false, error: 'ルーム情報の取得に失敗しました' });
  }
});

// デバッグ用API: 接続中のユーザー情報を取得
app.get('/api/users', (_req, res) => {
  try {
    const users = socketHandler.getConnectedUsers();
    res.json({ success: true, users });
  } catch (error) {
    console.error('ユーザー情報取得エラー:', error);
    res.status(500).json({ success: false, error: 'ユーザー情報の取得に失敗しました' });
  }
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`🚀 WebRTCシグナリングサーバーがポート ${PORT} で起動しました`);
  console.log(`📡 Socket.ioサーバーが準備完了`);
  console.log(`🌐 CORS設定: ${process.env.FRONTEND_URL || "http://localhost:5173"}`);
  console.log(`📍 ヘルスチェック: http://localhost:${PORT}/health`);
  console.log(`🔧 デバッグAPI: http://localhost:${PORT}/api/rooms`);
  console.log(`👥 デバッグAPI: http://localhost:${PORT}/api/users`);
}); 