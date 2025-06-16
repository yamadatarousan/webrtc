/**
 * WebRTCアプリケーション用Socket.ioハンドラークラス
 * 
 * このクラスは、WebRTCビデオ通話アプリケーションのリアルタイム通信を
 * 管理するSocket.ioサーバーのメインハンドラーです。以下の機能を提供します：
 * 
 * 主な機能：
 * - ルーム参加・退出の管理
 * - WebRTCシグナリング（Offer/Answer/ICE候補）の中継
 * - チャットメッセージの配信
 * - ユーザー接続状態の監視
 * - エラーハンドリングとログ記録
 * 
 * @fileoverview WebRTCアプリケーションのSocket.ioハンドラー
 * @author WebRTCアプリケーション開発チーム
 * @version 1.0.0
 */

import { Server, Socket } from 'socket.io';
import { 
  SignalingMessage, 
  User, 
  Room, 
  JoinRoomRequest, 
  JoinRoomResponse,
  WebRTCError,
  ChatMessage,
  SendChatMessageRequest,
  ChatMessageReceived,
  SOCKET_EVENTS 
} from '../types/webrtcTypes';

/**
 * 型安全なSocket.ioソケットインターフェース
 * 
 * TypeScriptでのSocket.ioイベントの型安全性を確保するため、
 * カスタムソケットインターフェースを定義します。
 * 
 * @interface TypedSocket
 */
interface TypedSocket extends Socket {
  /**
   * ソケットに関連付けられたユーザー情報。
   * ルーム参加時に設定され、退出時にクリアされます。
   */
  userData?: User;
}

/**
 * WebRTCアプリケーションのSocket.ioハンドラークラス
 * 
 * このクラスは、WebRTC通信のためのシグナリングサーバーとして機能し、
 * 複数のクライアント間でのリアルタイム通信を仲介します。
 * シングルトンパターンを採用し、サーバー全体で一つのインスタンスを共有します。
 * 
 * @class SocketHandler
 * @example
 * ```typescript
 * // Express サーバーでの初期化
 * const server = createServer(app);
 * const socketHandler = new SocketHandler(server);
 * 
 * // サーバー起動
 * server.listen(3001, () => {
 *   console.log('WebRTCシグナリングサーバーが起動しました');
 * });
 * ```
 */
export class SocketHandler {
  /**
   * Socket.ioサーバーインスタンス
   * クライアント接続とイベント管理を担当
   */
  private io: Server;
  
  /**
   * アクティブなルーム情報を格納するMap
   * Key: ルームID, Value: ルーム情報オブジェクト
   */
  private rooms: Map<string, Room> = new Map();
  
  /**
   * 接続中のユーザー情報を格納するMap
   * Key: ソケットID, Value: ユーザー情報オブジェクト
   */
  private users: Map<string, User> = new Map();

  /**
   * SocketHandlerのコンストラクター
   * 
   * Socket.ioサーバーを初期化し、必要なイベントハンドラーを設定します。
   * CORS設定とクライアント接続許可を含みます。
   * 
   * @param server - HTTP/HTTPSサーバーインスタンス
   * 
   * @example
   * ```typescript
   * import { createServer } from 'http';
   * import express from 'express';
   * 
   * const app = express();
   * const server = createServer(app);
   * const socketHandler = new SocketHandler(server);
   * ```
   */
  constructor(server: any) {
    this.io = new Server(server, {
      cors: {
        origin: process.env.CLIENT_URL || "http://localhost:5173",
        methods: ["GET", "POST"],
        credentials: true
      }
    });

    this.setupSocketHandlers();
    this.startCleanupTimer();
    
    console.log('🔌 Socket.ioハンドラーが初期化されました');
  }

  /**
   * Socket.ioイベントハンドラーの設定
   * 
   * クライアント接続時に呼ばれる各種イベントリスナーを設定します。
   * 接続、ルーム管理、WebRTCシグナリング、チャット機能、切断処理を含みます。
   * 
   * @private
   * @returns {void}
   */
  private setupSocketHandlers(): void {
    this.io.on('connection', (socket: TypedSocket) => {
      console.log(`👤 ユーザーが接続しました: ${socket.id}`);

      /**
       * ルーム参加リクエストの処理
       * 
       * クライアントからのルーム参加要求を受け取り、バリデーション後に
       * ユーザーをルームに追加します。満員の場合はエラーを返します。
       */
      socket.on(SOCKET_EVENTS.JOIN_ROOM, (request: JoinRoomRequest) => {
        this.handleJoinRoom(socket, request);
      });

      /**
       * ルーム退出リクエストの処理
       * 
       * ユーザーの明示的な退出要求、またはソケット切断時に
       * ユーザーをルームから削除し、他の参加者に通知します。
       */
      socket.on(SOCKET_EVENTS.LEAVE_ROOM, () => {
        this.handleLeaveRoom(socket);
      });

      /**
       * WebRTCオファーの中継処理
       * 
       * 接続開始側から送信されるWebRTCオファーを
       * 指定された相手に中継します。
       */
      socket.on(SOCKET_EVENTS.OFFER, (message: SignalingMessage) => {
        this.handleOffer(socket, message);
      });

      /**
       * WebRTCアンサーの中継処理
       * 
       * オファーに対する応答を送信元に中継し、
       * WebRTC接続の確立を支援します。
       */
      socket.on(SOCKET_EVENTS.ANSWER, (message: SignalingMessage) => {
        this.handleAnswer(socket, message);
      });

      /**
       * ICE候補の中継処理
       * 
       * NAT越えのための経路情報（ICE候補）を
       * 適切な相手に中継します。
       */
      socket.on(SOCKET_EVENTS.ICE_CANDIDATE, (message: SignalingMessage) => {
        this.handleIceCandidate(socket, message);
      });

      /**
       * チャットメッセージ送信の処理
       * 
       * ユーザーから送信されたチャットメッセージを
       * ルーム内の全参加者に配信します。
       */
      socket.on(SOCKET_EVENTS.CHAT_MESSAGE_SEND, (request: SendChatMessageRequest) => {
        this.handleChatMessage(socket, request);
      });

      /**
       * ソケット切断の処理
       * 
       * 予期しない切断やブラウザ終了時に
       * 自動的にユーザーをルームから削除します。
       */
      socket.on(SOCKET_EVENTS.DISCONNECT, () => {
        this.handleDisconnect(socket);
      });
    });
  }

  /**
   * ルーム参加要求の処理メソッド
   * 
   * クライアントからのルーム参加要求を検証し、参加可能な場合は
   * ユーザーをルームに追加します。満員や不正な要求の場合は
   * 適切なエラーメッセージを返します。
   * 
   * @private
   * @param socket - 参加要求を送信したソケット
   * @param request - ルーム参加要求データ
   * @returns {void}
   * 
   * @example
   * ```typescript
   * // クライアント側での使用例
   * socket.emit('join-room', {
   *   roomId: 'room1',
   *   userName: 'ユーザー太郎'
   * });
   * ```
   */
  private handleJoinRoom(socket: TypedSocket, request: JoinRoomRequest): void {
    try {
      const { roomId, userName } = request;

      // 入力値のバリデーション
      if (!roomId || !userName) {
        this.sendError(socket, 'INVALID_REQUEST', 'ルームIDとユーザー名は必須です');
        return;
      }

      if (roomId.length > 50 || userName.length > 50) {
        this.sendError(socket, 'INVALID_LENGTH', 'ルームIDとユーザー名は50文字以内で入力してください');
        return;
      }

      // ルームの取得または作成
      let room = this.rooms.get(roomId);
      if (!room) {
        room = this.createRoom(roomId);
      }

      // ルーム満員チェック
      if (room.users.length >= room.maxUsers) {
        this.sendError(socket, 'ROOM_FULL', 'ルームが満員です');
        socket.emit(SOCKET_EVENTS.ROOM_FULL, { 
          error: this.createError('ROOM_FULL', 'ルームが満員です') 
        });
        return;
      }

      // 新しいユーザーの作成
      const userId = this.generateUserId();
      const newUser: User = {
        id: userId,
        name: this.sanitizeInput(userName),
        socketId: socket.id,
        roomId: roomId
      };

      // ユーザーをルームに追加
      room.users.push(newUser);
      this.users.set(socket.id, newUser);
      socket.userData = newUser;

      // 既存参加者の情報を取得
      const existingUsers = room.users.filter(user => user.id !== userId);

      // 参加成功をクライアントに通知
      const response: JoinRoomResponse = {
        room: { ...room },
        user: newUser,
        existingUsers: existingUsers
      };

      socket.emit(SOCKET_EVENTS.ROOM_JOINED, response);

      // ルームの他の参加者に新規参加を通知
      existingUsers.forEach(user => {
        const userSocket = this.io.sockets.sockets.get(user.socketId);
        if (userSocket) {
          userSocket.emit(SOCKET_EVENTS.USER_JOINED, newUser);
        }
      });

      console.log(`✅ ユーザー ${newUser.name} がルーム ${roomId} に参加しました`);

    } catch (error) {
      console.error('❌ ルーム参加処理でエラーが発生:', error);
      this.sendError(socket, 'INTERNAL_ERROR', 'ルーム参加に失敗しました');
    }
  }

  /**
   * ルーム退出処理メソッド
   * 
   * ユーザーをルームから削除し、他の参加者に退出を通知します。
   * ルームが空になった場合は自動的にルームを削除します。
   * 
   * @private
   * @param socket - 退出するユーザーのソケット
   * @returns {void}
   */
  private handleLeaveRoom(socket: TypedSocket): void {
    try {
      const user = socket.userData;
      if (!user) return;

      const room = this.rooms.get(user.roomId);
      if (!room) return;

      // ユーザーをルームから削除
      room.users = room.users.filter(u => u.id !== user.id);
      this.users.delete(socket.id);
      delete socket.userData;

      // 他の参加者に退出を通知
      room.users.forEach(remainingUser => {
        const userSocket = this.io.sockets.sockets.get(remainingUser.socketId);
        if (userSocket) {
          userSocket.emit(SOCKET_EVENTS.USER_LEFT, user);
        }
      });

      // ルームが空の場合は削除
      if (room.users.length === 0) {
        this.rooms.delete(user.roomId);
        console.log(`🗑️  空のルーム ${user.roomId} を削除しました`);
      }

      // 退出完了をクライアントに通知
      socket.emit(SOCKET_EVENTS.ROOM_LEFT, { success: true });

      console.log(`👋 ユーザー ${user.name} がルーム ${user.roomId} から退出しました`);

    } catch (error) {
      console.error('❌ ルーム退出処理でエラーが発生:', error);
    }
  }

  /**
   * WebRTCオファーの中継処理
   * 
   * 接続開始側から送信されるSDP（Session Description Protocol）オファーを
   * 指定された相手ユーザーに中継します。WebRTC接続確立の第一段階です。
   * 
   * @private
   * @param socket - オファーを送信したソケット
   * @param message - WebRTCオファーメッセージ
   * @returns {void}
   */
  private handleOffer(socket: TypedSocket, message: SignalingMessage): void {
    try {
      const targetUser = this.findUserById(message.toUserId);
      if (!targetUser) {
        this.sendError(socket, 'USER_NOT_FOUND', '指定されたユーザーが見つかりません');
        return;
      }

      const targetSocket = this.io.sockets.sockets.get(targetUser.socketId);
      if (!targetSocket) {
        this.sendError(socket, 'USER_OFFLINE', 'ユーザーがオフラインです');
        return;
      }

      // オファーを対象ユーザーに中継
      targetSocket.emit(SOCKET_EVENTS.OFFER, message);
      console.log(`📞 オファーを中継: ${message.fromUserId} → ${message.toUserId}`);

    } catch (error) {
      console.error('❌ オファー中継でエラーが発生:', error);
      this.sendError(socket, 'RELAY_ERROR', 'オファーの中継に失敗しました');
    }
  }

  /**
   * WebRTCアンサーの中継処理
   * 
   * オファーに対する応答（SDP Answer）を送信元ユーザーに中継します。
   * WebRTC接続確立の第二段階として機能します。
   * 
   * @private
   * @param socket - アンサーを送信したソケット
   * @param message - WebRTCアンサーメッセージ
   * @returns {void}
   */
  private handleAnswer(socket: TypedSocket, message: SignalingMessage): void {
    try {
      const targetUser = this.findUserById(message.toUserId);
      if (!targetUser) {
        this.sendError(socket, 'USER_NOT_FOUND', '指定されたユーザーが見つかりません');
        return;
      }

      const targetSocket = this.io.sockets.sockets.get(targetUser.socketId);
      if (!targetSocket) {
        this.sendError(socket, 'USER_OFFLINE', 'ユーザーがオフラインです');
        return;
      }

      // アンサーを対象ユーザーに中継
      targetSocket.emit(SOCKET_EVENTS.ANSWER, message);
      console.log(`📞 アンサーを中継: ${message.fromUserId} → ${message.toUserId}`);

    } catch (error) {
      console.error('❌ アンサー中継でエラーが発生:', error);
      this.sendError(socket, 'RELAY_ERROR', 'アンサーの中継に失敗しました');
    }
  }

  /**
   * ICE候補の中継処理
   * 
   * NAT（Network Address Translation）越えのための経路情報（ICE候補）を
   * 適切な相手に中継します。WebRTC接続の最適な通信経路確立に使用されます。
   * 
   * @private
   * @param socket - ICE候補を送信したソケット
   * @param message - ICE候補メッセージ
   * @returns {void}
   */
  private handleIceCandidate(socket: TypedSocket, message: SignalingMessage): void {
    try {
      const targetUser = this.findUserById(message.toUserId);
      if (!targetUser) {
        console.warn(`⚠️  ICE候補送信: ユーザー ${message.toUserId} が見つかりません`);
        return;
      }

      const targetSocket = this.io.sockets.sockets.get(targetUser.socketId);
      if (!targetSocket) {
        console.warn(`⚠️  ICE候補送信: ユーザー ${message.toUserId} がオフラインです`);
        return;
      }

      // ICE候補を対象ユーザーに中継
      targetSocket.emit(SOCKET_EVENTS.ICE_CANDIDATE, message);
      console.log(`🧊 ICE候補を中継: ${message.fromUserId} → ${message.toUserId}`);

    } catch (error) {
      console.error('❌ ICE候補中継でエラーが発生:', error);
    }
  }

  /**
   * チャットメッセージ送信の処理
   * 
   * ユーザーから送信されたチャットメッセージをバリデーション後、
   * ルーム内の全参加者にリアルタイムで配信します。
   * システムメッセージの生成と不正なメッセージのフィルタリングを含みます。
   * 
   * @private
   * @param socket - メッセージを送信したソケット
   * @param request - チャットメッセージ送信要求
   * @returns {void}
   */
  private handleChatMessage(socket: TypedSocket, request: SendChatMessageRequest): void {
    try {
      const user = socket.userData;
      if (!user) {
        this.sendError(socket, 'NOT_IN_ROOM', 'ルームに参加していません');
        return;
      }

      const { roomId, message } = request;

      // メッセージのバリデーション
      if (!message || !message.trim()) {
        this.sendError(socket, 'EMPTY_MESSAGE', 'メッセージが空です');
        return;
      }

      if (message.length > 500) {
        this.sendError(socket, 'MESSAGE_TOO_LONG', 'メッセージは500文字以内で入力してください');
        return;
      }

      if (roomId !== user.roomId) {
        this.sendError(socket, 'ROOM_MISMATCH', '参加していないルームにメッセージを送信できません');
        return;
      }

      // チャットメッセージオブジェクトの作成
      const chatMessage: ChatMessage = {
        id: this.generateMessageId(),
        roomId: roomId,
        userId: user.id,
        userName: user.name,
        message: this.sanitizeInput(message.trim()),
        timestamp: new Date(),
        type: 'text'
      };

      // ルーム内の全参加者にメッセージを配信
      const room = this.rooms.get(roomId);
      if (room) {
        room.users.forEach(roomUser => {
          const userSocket = this.io.sockets.sockets.get(roomUser.socketId);
          if (userSocket) {
            const messageData: ChatMessageReceived = { message: chatMessage };
            userSocket.emit(SOCKET_EVENTS.CHAT_MESSAGE_RECEIVED, messageData);
          }
        });

        console.log(`💬 チャットメッセージ配信: ${user.name} in ${roomId}: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`);
      }

    } catch (error) {
      console.error('❌ チャットメッセージ処理でエラーが発生:', error);
      this.sendError(socket, 'MESSAGE_ERROR', 'メッセージの送信に失敗しました');
    }
  }

  /**
   * ソケット切断処理
   * 
   * 予期しない切断やブラウザ終了時に自動的に呼ばれ、
   * ユーザーをルームから削除し、リソースをクリーンアップします。
   * 
   * @private
   * @param socket - 切断されたソケット
   * @returns {void}
   */
  private handleDisconnect(socket: TypedSocket): void {
    console.log(`👤 ユーザーが切断しました: ${socket.id}`);
    this.handleLeaveRoom(socket);
  }

  // ============= ユーティリティメソッド =============

  /**
   * 新しいルームを作成
   * 
   * 指定されたIDで新しいルームを作成し、デフォルト設定を適用します。
   * 作成されたルームは内部のMapに保存されます。
   * 
   * @private
   * @param roomId - 作成するルームのID
   * @returns {Room} 作成されたルームオブジェクト
   */
  private createRoom(roomId: string): Room {
    const room: Room = {
      id: roomId,
      users: [],
      maxUsers: 4, // デフォルト最大参加者数
      createdAt: new Date()
    };

    this.rooms.set(roomId, room);
    console.log(`🏠 新しいルーム ${roomId} を作成しました`);
    return room;
  }

  /**
   * ユニークなユーザーIDを生成
   * 
   * タイムスタンプベースの一意なユーザーIDを生成します。
   * フォーマット: 'user-' + Unix時刻
   * 
   * @private
   * @returns {string} 生成されたユーザーID
   */
  private generateUserId(): string {
    return `user-${Date.now()}`;
  }

  /**
   * ユニークなメッセージIDを生成
   * 
   * タイムスタンプとランダム文字列を組み合わせた
   * 一意なメッセージIDを生成します。
   * 
   * @private
   * @returns {string} 生成されたメッセージID
   */
  private generateMessageId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * ユーザーIDによるユーザー検索
   * 
   * 接続中のユーザーから指定されたIDのユーザーを検索します。
   * WebRTCシグナリングメッセージの送信先決定に使用されます。
   * 
   * @private
   * @param userId - 検索するユーザーID
   * @returns {User | undefined} 見つかったユーザー、または undefined
   */
  private findUserById(userId: string): User | undefined {
    for (const user of this.users.values()) {
      if (user.id === userId) {
        return user;
      }
    }
    return undefined;
  }

  /**
   * 入力値のサニタイゼーション
   * 
   * XSS攻撃を防ぐため、HTMLタグや特殊文字をエスケープします。
   * ユーザー名やチャットメッセージの安全性確保に使用されます。
   * 
   * @private
   * @param input - サニタイズする文字列
   * @returns {string} サニタイズされた文字列
   */
  private sanitizeInput(input: string): string {
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  /**
   * エラーオブジェクトの作成
   * 
   * 統一されたフォーマットでエラーオブジェクトを作成します。
   * ログ記録とクライアント通知の両方で使用されます。
   * 
   * @private
   * @param code - エラーコード
   * @param message - エラーメッセージ
   * @param details - エラーの詳細情報（オプション）
   * @returns {WebRTCError} 作成されたエラーオブジェクト
   */
  private createError(code: string, message: string, details?: string): WebRTCError {
    return {
      code,
      message,
      details,
      timestamp: new Date()
    };
  }

  /**
   * クライアントにエラーを送信
   * 
   * エラーが発生した際に、適切なフォーマットで
   * クライアントに通知を送信します。
   * 
   * @private
   * @param socket - エラーを送信するソケット
   * @param code - エラーコード
   * @param message - エラーメッセージ
   * @param details - エラーの詳細情報（オプション）
   * @returns {void}
   */
  private sendError(socket: TypedSocket, code: string, message: string, details?: string): void {
    const error = this.createError(code, message, details);
    socket.emit(SOCKET_EVENTS.ERROR, { error });
    console.error(`❌ エラー [${code}]: ${message}`);
  }

  /**
   * 定期的なクリーンアップタイマーの開始
   * 
   * 古いルームや非アクティブなユーザーを定期的に削除し、
   * メモリリークを防ぎます。10分間隔で実行されます。
   * 
   * @private
   * @returns {void}
   */
  private startCleanupTimer(): void {
    setInterval(() => {
      this.cleanupInactiveRooms();
    }, 10 * 60 * 1000); // 10分間隔
  }

  /**
   * 非アクティブなルームのクリーンアップ
   * 
   * 24時間以上使用されていないルームを自動削除します。
   * サーバーリソースの効率的な管理に貢献します。
   * 
   * @private
   * @returns {void}
   */
  private cleanupInactiveRooms(): void {
    const now = new Date();
    const cleanupThreshold = 24 * 60 * 60 * 1000; // 24時間

    for (const [roomId, room] of this.rooms.entries()) {
      const roomAge = now.getTime() - room.createdAt.getTime();
      
      if (room.users.length === 0 && roomAge > cleanupThreshold) {
        this.rooms.delete(roomId);
        console.log(`🧹 非アクティブなルーム ${roomId} をクリーンアップしました`);
      }
    }
  }

  /**
   * 現在の統計情報を取得
   * 
   * アクティブなルーム数、接続ユーザー数などの
   * サーバー統計情報を返します。モニタリングに使用されます。
   * 
   * @public
   * @returns {object} サーバー統計情報
   * @returns {number} returns.activeRooms - アクティブなルーム数
   * @returns {number} returns.connectedUsers - 接続中のユーザー数
   * @returns {number} returns.totalConnections - 総Socket.io接続数
   * 
   * @example
   * ```typescript
   * const stats = socketHandler.getStats();
   * console.log(`アクティブルーム数: ${stats.activeRooms}`);
   * console.log(`接続ユーザー数: ${stats.connectedUsers}`);
   * console.log(`総接続数: ${stats.totalConnections}`);
   * ```
   */
  public getStats(): { activeRooms: number; connectedUsers: number; totalConnections: number } {
    return {
      activeRooms: this.rooms.size,
      connectedUsers: this.users.size,
      totalConnections: this.io.engine.clientsCount
    };
  }

  /**
   * 全ルーム情報を取得（デバッグ用）
   * 
   * 現在サーバーに存在する全ルームの詳細情報を取得します。
   * 開発・デバッグ目的で使用され、本番環境では認証が必要です。
   * 各ルームのユーザー一覧、作成日時、設定情報が含まれます。
   * 
   * @public
   * @returns {Room[]} 全ルーム情報の配列
   * 
   * @throws {Error} 内部エラーが発生した場合
   * 
   * @example
   * ```typescript
   * try {
   *   const rooms = socketHandler.getRooms();
   *   rooms.forEach(room => {
   *     console.log(`ルーム ${room.id}: ${room.users.length}/${room.maxUsers} 人`);
   *   });
   * } catch (error) {
   *   console.error('ルーム情報取得エラー:', error);
   * }
   * ```
   * 
   * @since 1.0.0
   */
  public getRooms(): Room[] {
    try {
      return Array.from(this.rooms.values()).map(room => ({
        ...room,
        users: room.users.map(user => ({
          ...user,
          // セキュリティのため、Socket IDは含めない
          socketId: ''
        }))
      }));
    } catch (error) {
      console.error('❌ ルーム情報取得でエラーが発生:', error);
      throw new Error('ルーム情報の取得に失敗しました');
    }
  }

  /**
   * 接続中の全ユーザー情報を取得（デバッグ用）
   * 
   * 現在Socket.ioサーバーに接続している全ユーザーの情報を取得します。
   * 開発・デバッグ目的で使用され、本番環境では適切な認証が必要です。
   * プライベート情報は除外され、公開可能な情報のみ返されます。
   * 
   * @public
   * @returns {User[]} 接続中ユーザー情報の配列（Socket ID除外済み）
   * 
   * @throws {Error} 内部エラーが発生した場合
   * 
   * @example
   * ```typescript
   * try {
   *   const users = socketHandler.getConnectedUsers();
   *   console.log(`現在の接続ユーザー数: ${users.length}`);
   *   users.forEach(user => {
   *     console.log(`- ${user.name} (${user.id}) in ${user.roomId}`);
   *   });
   * } catch (error) {
   *   console.error('ユーザー情報取得エラー:', error);
   * }
   * ```
   * 
   * @since 1.0.0
   */
  public getConnectedUsers(): User[] {
    try {
      return Array.from(this.users.values()).map(user => ({
        ...user,
        // セキュリティのため、Socket IDは公開しない
        socketId: ''
      }));
    } catch (error) {
      console.error('❌ ユーザー情報取得でエラーが発生:', error);
      throw new Error('ユーザー情報の取得に失敗しました');
    }
  }
} 