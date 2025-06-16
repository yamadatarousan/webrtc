// WebRTCアプリケーション型定義（バックエンド用）

/**
 * シグナリングメッセージの型定義
 */
export interface SignalingMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'join' | 'leave' | 'user-joined' | 'user-left';
  payload: any;
  roomId: string;
  userId: string;
  timestamp: number;
}

/**
 * ユーザー情報の型定義
 */
export interface User {
  id: string;
  name: string;
  isHost: boolean;
  joinedAt: number;
}

/**
 * エラー情報の型定義
 */
export interface WebRTCError {
  code: string;
  message: string;
  details?: any;
  timestamp: number;
}

/**
 * Socket.ioイベントの型定義（クライアント→サーバー）
 */
export interface ClientToServerEvents {
  'join-room': (roomId: string, userId: string) => void;
  'leave-room': (roomId: string, userId: string) => void;
  'signal': (message: SignalingMessage) => void;
  'toggle-media': (roomId: string, userId: string, type: 'video' | 'audio', enabled: boolean) => void;
}

/**
 * Socket.ioイベントの型定義（サーバー→クライアント）
 */
export interface ServerToClientEvents {
  'user-joined': (user: User) => void;
  'user-left': (userId: string) => void;
  'signal': (message: SignalingMessage) => void;
  'room-users': (users: User[]) => void;
  'error': (error: WebRTCError) => void;
}

// バックエンド固有の型定義
export interface ServerConfig {
  port: number;
  frontendUrl: string;
  environment: 'development' | 'production' | 'test';
}

export interface RoomManager {
  rooms: Map<string, Set<string>>;
  addUser: (roomId: string, userId: string) => void;
  removeUser: (roomId: string, userId: string) => void;
  getRoomUsers: (roomId: string) => string[];
} 