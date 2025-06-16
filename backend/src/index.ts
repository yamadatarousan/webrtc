/**
 * WebRTCアプリケーション メインサーバーファイル
 * 
 * このファイルは、WebRTCビデオ通話アプリケーションのバックエンドサーバーを
 * 起動するメインエントリーポイントです。Express.jsとSocket.ioを使用して
 * WebRTCシグナリングサーバーとHTTP APIサーバーを提供します。
 * 
 * 主な機能：
 * - Express.js HTTPサーバーの設定
 * - Socket.io WebRTCシグナリングサーバーの起動
 * - セキュリティミドルウェア（Helmet、CORS）の設定
 * - ヘルスチェックAPIエンドポイントの提供
 * - デバッグ用API（ルーム・ユーザー情報）の提供
 * 
 * @fileoverview WebRTCアプリケーションのメインサーバー
 * @author WebRTCアプリケーション開発チーム
 * @version 1.0.0
 */

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { SocketHandler } from './socket/socketHandler';

// 環境変数の読み込み
dotenv.config();

/**
 * Express アプリケーションインスタンス
 * HTTPエンドポイントとミドルウェアを管理
 */
const app = express();

/**
 * HTTPサーバーインスタンス
 * Socket.ioサーバーと統合するためcreateServerを使用
 */
const server = createServer(app);

/**
 * Socket.ioサーバーインスタンス
 * WebRTCシグナリングとリアルタイム通信を担当
 */
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// ミドルウェアの設定

/**
 * セキュリティヘッダーの設定
 * Helmet.jsを使用してHTTPセキュリティヘッダーを自動設定
 */
app.use(helmet());

/**
 * CORS（Cross-Origin Resource Sharing）の設定
 * フロントエンドからのクロスオリジンリクエストを許可
 */
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true
}));

/**
 * JSONリクエストボディの解析
 * Express.js組み込みのJSONパーサーを使用
 */
app.use(express.json());

/**
 * Socket.ioハンドラーの初期化
 * WebRTCシグナリングとチャット機能を提供
 */
const socketHandler = new SocketHandler(io);

// APIエンドポイントの定義

/**
 * ヘルスチェックエンドポイント
 * 
 * サーバーの生存確認とステータス情報を提供します。
 * ロードバランサーやモニタリングツールで使用されます。
 * 
 * @route GET /health
 * @returns {Object} サーバーステータス情報
 * @returns {string} status - サーバーの状態（"OK"）
 * @returns {string} timestamp - レスポンス生成時刻（ISO 8601形式）
 * @returns {string} service - サービス名
 * 
 * @example
 * curl http://localhost:3001/health
 * // レスポンス:
 * // {
 * //   "status": "OK",
 * //   "timestamp": "2023-12-01T12:00:00.000Z",
 * //   "service": "WebRTC Signaling Server"
 * // }
 */
app.get('/health', (_req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'WebRTC Signaling Server'
  });
});

/**
 * ルーム情報取得APIエンドポイント（デバッグ用）
 * 
 * 現在アクティブなルーム一覧とその詳細情報を取得します。
 * 開発・デバッグ目的で使用され、本番環境では無効化を推奨します。
 * 
 * @route GET /api/rooms
 * @returns {Object} ルーム情報のレスポンス
 * @returns {boolean} success - 処理の成功/失敗
 * @returns {Array<Room>} rooms - アクティブなルーム一覧
 * @returns {string} [error] - エラーメッセージ（失敗時のみ）
 * 
 * @example
 * curl http://localhost:3001/api/rooms
 * // レスポンス:
 * // {
 * //   "success": true,
 * //   "rooms": [
 * //     {
 * //       "id": "room1",
 * //       "users": [...],
 * //       "maxUsers": 4,
 * //       "createdAt": "2023-12-01T12:00:00.000Z"
 * //     }
 * //   ]
 * // }
 */
app.get('/api/rooms', (_req, res) => {
  try {
    const rooms = socketHandler.getRooms();
    res.json({ success: true, rooms });
  } catch (error) {
    console.error('ルーム情報取得エラー:', error);
    res.status(500).json({ success: false, error: 'ルーム情報の取得に失敗しました' });
  }
});

/**
 * 接続中ユーザー情報取得APIエンドポイント（デバッグ用）
 * 
 * 現在Socket.ioサーバーに接続中のユーザー一覧を取得します。
 * 開発・デバッグ目的で使用され、本番環境では無効化を推奨します。
 * 
 * @route GET /api/users
 * @returns {Object} ユーザー情報のレスポンス
 * @returns {boolean} success - 処理の成功/失敗
 * @returns {Array<User>} users - 接続中のユーザー一覧
 * @returns {string} [error] - エラーメッセージ（失敗時のみ）
 * 
 * @example
 * curl http://localhost:3001/api/users
 * // レスポンス:
 * // {
 * //   "success": true,
 * //   "users": [
 * //     {
 * //       "id": "user-1234567890",
 * //       "name": "ユーザー太郎",
 * //       "socketId": "abc123def456",
 * //       "roomId": "room1"
 * //     }
 * //   ]
 * // }
 */
app.get('/api/users', (_req, res) => {
  try {
    const users = socketHandler.getConnectedUsers();
    res.json({ success: true, users });
  } catch (error) {
    console.error('ユーザー情報取得エラー:', error);
    res.status(500).json({ success: false, error: 'ユーザー情報の取得に失敗しました' });
  }
});

/**
 * サーバーポート番号
 * 環境変数PORT、または既定値3001を使用
 */
const PORT = process.env.PORT || 3001;

/**
 * サーバー起動処理
 * 
 * HTTPサーバーを指定ポートで起動し、Socket.ioサーバーも同時に開始します。
 * 起動完了後、各種エンドポイントのURLとステータス情報をコンソールに出力します。
 * 
 * @param {number} PORT - サーバーが待ち受けるポート番号
 * @callback 起動完了コールバック - サーバー起動時の処理
 * 
 * @example
 * // 環境変数での設定
 * PORT=3001 npm start
 * 
 * // 起動ログ例:
 * // 🚀 WebRTCシグナリングサーバーがポート 3001 で起動しました
 * // 📡 Socket.ioサーバーが準備完了
 * // 🌐 CORS設定: http://localhost:5173
 * // 📍 ヘルスチェック: http://localhost:3001/health
 * // 🔧 デバッグAPI: http://localhost:3001/api/rooms
 * // 👥 デバッグAPI: http://localhost:3001/api/users
 */
server.listen(PORT, () => {
  console.log(`🚀 WebRTCシグナリングサーバーがポート ${PORT} で起動しました`);
  console.log(`📡 Socket.ioサーバーが準備完了`);
  console.log(`🌐 CORS設定: ${process.env.FRONTEND_URL || "http://localhost:5173"}`);
  console.log(`📍 ヘルスチェック: http://localhost:${PORT}/health`);
  console.log(`🔧 デバッグAPI: http://localhost:${PORT}/api/rooms`);
  console.log(`👥 デバッグAPI: http://localhost:${PORT}/api/users`);
}); 