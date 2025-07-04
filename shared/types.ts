// WebRTCアプリケーション用の共通型定義

// 独自のWebRTC型定義（ブラウザ環境とNode.js環境両方で使用可能）
export interface SessionDescriptionInit {
  type?: 'offer' | 'answer' | 'pranswer' | 'rollback';
  sdp?: string;
}

export interface IceCandidateInit {
  candidate?: string;
  sdpMLineIndex?: number | null;
  sdpMid?: string | null;
}

export interface MediaTrackConstraints {
  width?: number | { ideal: number; min?: number; max?: number };
  height?: number | { ideal: number; min?: number; max?: number };
  frameRate?: number | { ideal: number; min?: number; max?: number };
  echoCancellation?: boolean;
  noiseSuppression?: boolean;
  autoGainControl?: boolean;
}

// シグナリングメッセージの種類
export type SignalingMessageType = 
  | 'offer'
  | 'answer'
  | 'ice-candidate'
  | 'join-room'
  | 'leave-room'
  | 'user-joined'
  | 'user-left'
  | 'room-full'
  | 'error';

// シグナリングメッセージの基本構造
export interface SignalingMessage {
  type: SignalingMessageType;
  data?: any;
  from?: string;
  to?: string;
  roomId?: string;
  timestamp?: number;
}

// WebRTCオファー・アンサー用のメッセージ
export interface RTCOfferMessage extends SignalingMessage {
  type: 'offer';
  data: SessionDescriptionInit;
}

export interface RTCAnswerMessage extends SignalingMessage {
  type: 'answer';
  data: SessionDescriptionInit;
}

// ICE候補用のメッセージ
export interface RTCIceCandidateMessage extends SignalingMessage {
  type: 'ice-candidate';
  data: IceCandidateInit;
}

// ユーザー情報
export interface User {
  id: string;
  name: string;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  joinedAt: Date;
}

// ルーム情報
export interface Room {
  id: string;
  name: string;
  users: User[];
  maxUsers: number;
  createdAt: Date;
}

// 接続状態
export type ConnectionState = 
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'failed';

// WebRTC接続状態
export type WebRTCConnectionState = 
  | 'new'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'failed'
  | 'closed';

// メディアストリーム設定
export interface MediaStreamConfig {
  video: boolean | MediaTrackConstraints;
  audio: boolean | MediaTrackConstraints;
}

// エラー情報
export interface WebRTCError {
  code: string;
  message: string;
  details?: any;
}

// ルーム参加リクエスト
export interface JoinRoomRequest {
  roomId: string;
  userId: string;
  userName: string;
}

// ルーム参加レスポンス
export interface JoinRoomResponse {
  success: boolean;
  room?: Room;
  error?: WebRTCError;
}

// チャットメッセージの型定義
export interface ChatMessage {
  id: string;
  roomId: string;
  userId: string;
  userName: string;
  message: string;
  timestamp: Date;
  type: 'text' | 'system';
}

// チャットメッセージ送信リクエスト
export interface SendChatMessageRequest {
  roomId: string;
  message: string;
}

// チャットメッセージ受信レスポンス
export interface ChatMessageReceived {
  message: ChatMessage;
}

// Socket.ioイベント名の定数
export const SOCKET_EVENTS = {
  // 接続関連
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  
  // ルーム関連
  JOIN_ROOM: 'join-room',
  LEAVE_ROOM: 'leave-room',
  ROOM_JOINED: 'room-joined',
  ROOM_LEFT: 'room-left',
  USER_JOINED: 'user-joined',
  USER_LEFT: 'user-left',
  ROOM_FULL: 'room-full',
  
  // WebRTCシグナリング
  OFFER: 'offer',
  ANSWER: 'answer',
  ICE_CANDIDATE: 'ice-candidate',
  
  // チャット機能
  CHAT_MESSAGE: 'chat-message',
  CHAT_MESSAGE_RECEIVED: 'chat-message-received',
  
  // エラー
  ERROR: 'error',
} as const;

// STUN/TURNサーバー設定
export interface ICEServerConfig {
  urls: string | string[];
  username?: string;
  credential?: string;
}

// WebRTC設定
export interface WebRTCConfig {
  iceServers: ICEServerConfig[];
  iceCandidatePoolSize?: number;
}

// デフォルトのWebRTC設定
export const DEFAULT_WEBRTC_CONFIG: WebRTCConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
  iceCandidatePoolSize: 10,
};

// メディアストリームのデフォルト設定
export const DEFAULT_MEDIA_CONSTRAINTS: MediaStreamConfig = {
  video: {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30 },
  },
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
}; 