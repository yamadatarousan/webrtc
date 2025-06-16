// Socket.ioクライアント接続管理（型安全性を一時的に緩和）

/**
 * Socket.io接続を管理するサービスクラス
 */
export class SocketService {
  private socket: any = null;
  private serverUrl: string;

  constructor(serverUrl: string = 'http://localhost:3001') {
    this.serverUrl = serverUrl;
  }

  /**
   * サーバーに接続
   */
  async connect(): Promise<void> {
    // 動的インポートでSocket.ioを読み込み
    const { io } = await import('socket.io-client');
    
    return new Promise((resolve, reject) => {
      this.socket = io(this.serverUrl, {
        transports: ['websocket'],
        upgrade: false,
      });

      this.socket.on('connect', () => {
        console.log('✅ サーバーに接続しました');
        resolve();
      });

      this.socket.on('connect_error', (error: Error) => {
        console.error('❌ サーバー接続エラー:', error);
        reject(error);
      });

      this.socket.on('disconnect', (reason: string) => {
        console.log('🔌 サーバーから切断されました:', reason);
      });
    });
  }

  /**
   * サーバーから切断
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  /**
   * ルームに参加
   */
  joinRoom(roomId: string, userId: string): void {
    if (this.socket) {
      this.socket.emit('join-room', roomId, userId);
    }
  }

  /**
   * ルームから退出
   */
  leaveRoom(roomId: string, userId: string): void {
    if (this.socket) {
      this.socket.emit('leave-room', roomId, userId);
    }
  }

  /**
   * シグナリングメッセージを送信
   */
  sendSignal(message: any): void {
    if (this.socket) {
      this.socket.emit('signal', message);
    }
  }

  /**
   * ユーザー参加イベントリスナーを設定
   */
  onUserJoined(callback: (user: any) => void): void {
    if (this.socket) {
      this.socket.on('user-joined', callback);
    }
  }

  /**
   * ユーザー退出イベントリスナーを設定
   */
  onUserLeft(callback: (userId: string) => void): void {
    if (this.socket) {
      this.socket.on('user-left', callback);
    }
  }

  /**
   * シグナリングメッセージ受信イベントリスナーを設定
   */
  onSignal(callback: (message: any) => void): void {
    if (this.socket) {
      this.socket.on('signal', callback);
    }
  }

  /**
   * 接続状態を確認
   */
  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
} 