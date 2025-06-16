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
  'join-room': (data: JoinRoomData) => void;
  'offer': (data: WebRTCSignalData) => void;
  'answer': (data: WebRTCSignalData) => void;
  'ice-candidate': (data: ICECandidateData) => void;
  'signal': (message: SignalingMessage) => void;
}

/**
 * Socket.ioイベントの型定義（サーバー→クライアント）
 */
export interface ServerToClientEvents {
  'user-joined': (user: ConnectedUser) => void;
  'user-left': (user: DisconnectedUser) => void;
  'room-users': (users: ConnectedUser[]) => void;
  'offer': (data: WebRTCOfferData) => void;
  'answer': (data: WebRTCAnswerData) => void;
  'ice-candidate': (data: ICECandidateReceiveData) => void;
  'signal': (message: SignalingMessage) => void;
  'error': (error: { message: string }) => void;
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

// ユーザー関連の型
export interface ConnectedUser {
  id: string;
  name: string;
  roomId: string;
}

export interface DisconnectedUser {
  userId: string;
  userName: string;
}

export interface JoinRoomData {
  roomId: string;
  userName: string;
}

// WebRTC関連の型
export interface WebRTCSignalData {
  target: string;
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
}

export interface WebRTCOfferData {
  from: string;
  offer: RTCSessionDescriptionInit;
}

export interface WebRTCAnswerData {
  from: string;
  answer: RTCSessionDescriptionInit;
}

export interface ICECandidateData {
  target: string;
  candidate: RTCIceCandidateInit;
}

export interface ICECandidateReceiveData {
  from: string;
  candidate: RTCIceCandidateInit;
}

export interface Room {
  id: string;
  name: string;
  users: User[];
  createdAt: number;
}

// WebRTC型定義（Node.js環境用）
export interface RTCSessionDescriptionInit {
  type: 'offer' | 'answer' | 'pranswer' | 'rollback';
  sdp?: string;
}

export interface RTCIceCandidateInit {
  candidate?: string;
  sdpMLineIndex?: number | null;
  sdpMid?: string | null;
  usernameFragment?: string | null;
} 