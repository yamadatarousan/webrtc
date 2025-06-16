// WebRTCアプリケーション共通型定義

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
 * 通話の状態を表す型
 */
export type CallState = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';

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
 * ルーム情報の型定義
 */
export interface Room {
  id: string;
  name: string;
  users: User[];
  createdAt: number;
  maxUsers: number;
}

/**
 * WebRTC接続の状態を表す型
 */
export interface ConnectionState {
  iceConnectionState: RTCIceConnectionState;
  connectionState: RTCPeerConnectionState;
  signalingState: RTCSignalingState;
}

/**
 * メディアデバイス情報の型定義
 */
export interface MediaDevice {
  deviceId: string;
  kind: 'videoinput' | 'audioinput' | 'audiooutput';
  label: string;
  groupId: string;
}

/**
 * 通話設定の型定義
 */
export interface CallSettings {
  video: boolean;
  audio: boolean;
  resolution: 'low' | 'medium' | 'high';
  frameRate: number;
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

/**
 * WebRTC統計情報の型定義
 */
export interface WebRTCStats {
  bytesReceived: number;
  bytesSent: number;
  packetsReceived: number;
  packetsLost: number;
  jitter: number;
  roundTripTime: number;
  frameRate: number;
  resolution: {
    width: number;
    height: number;
  };
} 