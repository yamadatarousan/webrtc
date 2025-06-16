/**
 * WebRTCアプリケーション用の型定義（バックエンド専用）
 * 
 * このファイルには、Node.js + Express + Socket.ioで構築された
 * WebRTCシグナリングサーバーで使用される型定義が含まれています。
 * 
 * 主な機能領域：
 * - WebRTCシグナリングメッセージ
 * - ユーザー・ルーム管理
 * - チャット機能
 * - エラーハンドリング
 * 
 * @fileoverview WebRTCアプリケーションのバックエンド型定義
 * @author WebRTCアプリケーション開発チーム
 * @version 1.0.0
 */

/**
 * WebRTCシグナリングメッセージの種類を定義する列挙型
 */
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

/**
 * WebRTCシグナリングメッセージの基底インターフェース
 */
export interface SignalingMessage {
  fromUserId: string;
  toUserId: string;
  type: 'offer' | 'answer' | 'ice-candidate';
  data: any;
}

/**
 * WebRTC Session Description（ブラウザ互換）
 */
export interface SessionDescription {
  type: 'offer' | 'answer';
  sdp: string;
}

/**
 * WebRTC ICE Candidate（ブラウザ互換）
 */
export interface IceCandidate {
  candidate: string;
  sdpMLineIndex: number | null;
  sdpMid: string | null;
}

/**
 * WebRTCオファーメッセージ
 */
export interface RTCOfferMessage extends SignalingMessage {
  type: 'offer';
  data: SessionDescription;
}

/**
 * WebRTCアンサーメッセージ
 */
export interface RTCAnswerMessage extends SignalingMessage {
  type: 'answer';
  data: SessionDescription;
}

/**
 * ICE候補メッセージ
 */
export interface RTCIceCandidateMessage extends SignalingMessage {
  type: 'ice-candidate';
  data: IceCandidate;
}

/**
 * ビデオ通話参加ユーザーの情報
 */
export interface User {
  id: string;
  name: string;
  socketId: string;
  roomId: string;
}

/**
 * ビデオ通話ルームの情報
 */
export interface Room {
  id: string;
  users: User[];
  maxUsers: number;
  createdAt: Date;
}

/**
 * WebRTC接続状態
 */
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';

/**
 * WebRTC接続状態の詳細版
 */
export type WebRTCConnectionState = 
  | 'new'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'failed'
  | 'closed';

/**
 * メディアトラック制約
 */
export interface MediaTrackConstraints {
  width?: number | { ideal?: number; min?: number; max?: number };
  height?: number | { ideal?: number; min?: number; max?: number };
  frameRate?: number | { ideal?: number; min?: number; max?: number };
  echoCancellation?: boolean;
  noiseSuppression?: boolean;
  autoGainControl?: boolean;
  deviceId?: string;
}

/**
 * メディアストリーム設定
 */
export interface MediaStreamConfig {
  video: boolean | MediaTrackConstraints;
  audio: boolean | MediaTrackConstraints;
}

/**
 * WebRTCアプリケーションで発生するエラーの詳細情報
 */
export interface WebRTCError {
  code: string;
  message: string;
  details?: string;
  timestamp: Date;
}

/**
 * ルーム参加リクエストのデータ構造
 */
export interface JoinRoomRequest {
  roomId: string;
  userName: string;
}

/**
 * ルーム参加成功時のレスポンスデータ
 */
export interface JoinRoomResponse {
  room: Room;
  user: User;
  existingUsers: User[];
}

/**
 * チャットメッセージの完全な情報
 */
export interface ChatMessage {
  id: string;
  roomId: string;
  userId: string;
  userName: string;
  message: string;
  timestamp: Date;
  type: 'text' | 'system';
}

/**
 * チャットメッセージ送信リクエストの構造
 */
export interface SendChatMessageRequest {
  roomId: string;
  message: string;
}

/**
 * チャットメッセージ受信時のイベントデータ
 */
export interface ChatMessageReceived {
  message: ChatMessage;
}

/**
 * Socket.ioイベント名の定数定義
 */
export const SOCKET_EVENTS = {
  // 基本接続イベント
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  
  // ルーム管理イベント
  JOIN_ROOM: 'join-room',
  LEAVE_ROOM: 'leave-room',
  ROOM_JOINED: 'room-joined',
  ROOM_LEFT: 'room-left',
  USER_JOINED: 'user-joined',
  USER_LEFT: 'user-left',
  ROOM_FULL: 'room-full',
  
  // WebRTCシグナリングイベント
  OFFER: 'offer',
  ANSWER: 'answer',
  ICE_CANDIDATE: 'ice-candidate',
  
  // チャット機能イベント
  CHAT_MESSAGE_SEND: 'chat-message-send',
  CHAT_MESSAGE_RECEIVED: 'chat-message-received',
  
  // エラーハンドリングイベント
  ERROR: 'error'
} as const;

/**
 * STUN/TURNサーバー設定
 */
export interface ICEServerConfig {
  urls: string | string[];
  username?: string;
  credential?: string;
}

/**
 * WebRTC設定
 */
export interface WebRTCConfig {
  iceServers: ICEServerConfig[];
  iceCandidatePoolSize?: number;
}

/**
 * デフォルトのWebRTC設定
 */
export const DEFAULT_WEBRTC_CONFIG: WebRTCConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
  iceCandidatePoolSize: 10,
};

/**
 * メディアストリームのデフォルト設定
 */
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