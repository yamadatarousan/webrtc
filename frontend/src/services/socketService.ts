import io from 'socket.io-client';
import type { 
  SignalingMessage, 
  ConnectionState,
  JoinRoomRequest,
  JoinRoomResponse,
  User,
  WebRTCError
} from '../types/webrtcTypes';
import { SOCKET_EVENTS } from '../types/webrtcTypes';

export class SocketService {
  private socket: any | null = null;
  private connectionState: ConnectionState = 'disconnected';
  private listeners: Map<string, Function[]> = new Map();

  constructor() {
    this.connect();
  }

  private connect(): void {
    const serverUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
    
    this.socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      timeout: 20000,
    });

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('🔌 Socket.io接続成功');
      this.connectionState = 'connected';
      this.emit('connection-state-changed', this.connectionState);
    });

    this.socket.on('disconnect', (reason: any) => {
      console.log('🔌 Socket.io切断:', reason);
      this.connectionState = 'disconnected';
      this.emit('connection-state-changed', this.connectionState);
    });

    this.socket.on('connect_error', (error: any) => {
      console.error('🔌 Socket.io接続エラー:', error);
      this.connectionState = 'failed';
      this.emit('connection-state-changed', this.connectionState);
    });

    this.socket.on('reconnect', () => {
      console.log('🔌 Socket.io再接続成功');
      this.connectionState = 'connected';
      this.emit('connection-state-changed', this.connectionState);
    });

    this.socket.on('reconnecting', () => {
      console.log('🔌 Socket.io再接続中...');
      this.connectionState = 'reconnecting';
      this.emit('connection-state-changed', this.connectionState);
    });

    // WebRTCシグナリングイベント
    this.socket.on(SOCKET_EVENTS.ROOM_JOINED, (response: JoinRoomResponse) => {
      console.log('🏠 ルーム参加成功:', response);
      this.emit('room-joined', response);
    });

    this.socket.on(SOCKET_EVENTS.USER_JOINED, (data: { user: User }) => {
      console.log('👤 新しいユーザーが参加:', data.user);
      this.emit('user-joined', data.user);
    });

    this.socket.on(SOCKET_EVENTS.USER_LEFT, (data: { userId: string }) => {
      console.log('👤 ユーザーが退出:', data.userId);
      this.emit('user-left', data.userId);
    });

    this.socket.on(SOCKET_EVENTS.OFFER, (message: SignalingMessage) => {
      console.log('📡 Offer受信:', message);
      this.emit('offer', message);
    });

    this.socket.on(SOCKET_EVENTS.ANSWER, (message: SignalingMessage) => {
      console.log('📡 Answer受信:', message);
      this.emit('answer', message);
    });

    this.socket.on(SOCKET_EVENTS.ICE_CANDIDATE, (message: SignalingMessage) => {
      console.log('🧊 ICE候補受信:', message);
      this.emit('ice-candidate', message);
    });

    this.socket.on(SOCKET_EVENTS.ROOM_FULL, (data: { error: WebRTCError }) => {
      console.warn('🏠 ルーム満員:', data.error);
      this.emit('room-full', data.error);
    });

    this.socket.on(SOCKET_EVENTS.ERROR, (data: { error: WebRTCError }) => {
      console.error('❌ WebRTCエラー:', data.error);
      this.emit('error', data.error);
    });
  }

  // ルームに参加
  public joinRoom(request: JoinRoomRequest): void {
    if (!this.socket) {
      throw new Error('Socket.ioが接続されていません');
    }

    console.log('🏠 ルーム参加要求:', request);
    this.socket.emit(SOCKET_EVENTS.JOIN_ROOM, request);
  }

  // ルームから退出
  public leaveRoom(): void {
    if (this.socket && this.socket.connected) {
      this.socket.emit(SOCKET_EVENTS.LEAVE_ROOM);
      console.log('🚪 ルーム退出リクエスト送信');
    }
  }

  // Offerを送信
  public sendOffer(message: SignalingMessage): void {
    if (!this.socket) return;

    console.log('📡 Offer送信:', message);
    this.socket.emit(SOCKET_EVENTS.OFFER, message);
  }

  // Answerを送信
  public sendAnswer(message: SignalingMessage): void {
    if (!this.socket) return;

    console.log('📡 Answer送信:', message);
    this.socket.emit(SOCKET_EVENTS.ANSWER, message);
  }

  // ICE候補を送信
  public sendIceCandidate(message: SignalingMessage): void {
    if (!this.socket) return;

    console.log('🧊 ICE候補送信:', message);
    this.socket.emit(SOCKET_EVENTS.ICE_CANDIDATE, message);
  }

  // イベントリスナーを追加
  public on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  // イベントリスナーを削除
  public off(event: string, callback?: Function): void {
    if (!this.listeners.has(event)) return;

    if (callback) {
      const callbacks = this.listeners.get(event)!;
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    } else {
      this.listeners.delete(event);
    }
  }

  // イベントを発火
  private emit(event: string, data?: any): void {
    if (!this.listeners.has(event)) return;

    this.listeners.get(event)!.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`イベント ${event} のコールバック実行エラー:`, error);
      }
    });
  }

  // 接続状態を取得
  public getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  // 接続しているかどうかを確認
  public isConnected(): boolean {
    return this.socket?.connected === true;
  }

  // Socket.ioにメッセージを送信（汎用）
  public sendMessage(event: string, data?: any): void {
    if (this.socket && this.socket.connected) {
      this.socket.emit(event, data);
    }
  }

  // 現在のユーザーIDを取得
  public getCurrentUserId(): string {
    return this.socket?.id || '';
  }

  // Socket.ioサービスの破棄
  public disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connectionState = 'disconnected';
    }
  }
}

// シングルトンインスタンスをエクスポート
export const socketService = new SocketService(); 