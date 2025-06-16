/**
 * WebRTCアプリケーション用のSocket.ioサービス（フロントエンド専用）
 * 
 * このサービスは、WebRTCシグナリングサーバーとの通信を管理します。
 * シングルトンパターンを採用し、アプリケーション全体で一つの接続を共有します。
 * 
 * 主な機能：
 * - Socket.io接続の管理（接続・切断・再接続）
 * - WebRTCシグナリングメッセージの送受信
 * - ルーム参加・退出の処理
 * - チャットメッセージの送受信
 * - 接続状態の監視とイベント通知
 * 
 * @fileoverview WebRTCシグナリング用Socket.ioサービス
 * @author WebRTCアプリケーション開発チーム  
 * @version 1.0.0
 */

import { io, Socket } from 'socket.io-client';
import type {
  SignalingMessage,
  User,
  Room,
  JoinRoomRequest,
  JoinRoomResponse,
  WebRTCError,
  ChatMessage,
  SendChatMessageRequest,
  ChatMessageReceived,
  ConnectionState
} from '../types/webrtcTypes';
import { SOCKET_EVENTS } from '../types/webrtcTypes';

/**
 * Socket.ioイベントのコールバック関数型
 * 
 * サーバーからのイベントを受信した際に実行される関数の型定義です。
 * 可変長引数を受け取り、戻り値は不要です。
 */
type EventCallback = (...args: any[]) => void;

/**
 * WebRTCシグナリングサーバーのSocket.io接続を管理するサービスクラス
 * 
 * このクラスは以下の機能を提供します：
 * - Socket.ioクライアントの接続管理
 * - WebRTCシグナリングメッセージの送受信
 * - ルーム参加・退出の処理
 * - チャットメッセージの送受信
 * - 接続状態の監視とエラーハンドリング
 * 
 * シングルトンパターンを採用しており、アプリケーション全体で1つのインスタンスを共有します。
 * 
 * @class SocketService
 * @example
 * ```typescript
 * // サービスの取得とルーム参加
 * const socketService = SocketService.getInstance();
 * await socketService.connect('http://localhost:3001');
 * socketService.joinRoom({ roomId: 'room1', userName: 'ユーザー1' });
 * 
 * // イベント監視
 * socketService.on('user-joined', (user) => {
 *   console.log('新しいユーザーが参加:', user);
 * });
 * ```
 * 
 * @since 1.0.0
 */
export class SocketService {
  /**
   * クラスの唯一のインスタンス（シングルトンパターン）
   * @private
   * @static
   */
  private static instance: SocketService | null = null;
  
  /**
   * Socket.io クライアントインスタンス
   * サーバーとの実際の通信を担当
   * @private
   */
  private socket: Socket | null = null;
  
  /**
   * 現在の接続状態
   * UI表示とエラーハンドリングに使用
   * @private
   */
  private isConnected: boolean = false;
  
  /**
   * 接続先サーバーのURL
   * 再接続時に使用
   * @private
   */
  private serverUrl: string = '';

  /**
   * 現在のユーザーID
   * ルーム参加時に設定される
   * @private
   */
  private currentUserId: string | null = null;

  /**
   * プライベートコンストラクタ（シングルトンパターン）
   * 
   * 外部からの直接インスタンス化を防ぎ、
   * getInstance() メソッドを通してのみアクセス可能にします。
   * 
   * @private
   */
  private constructor() {
    // シングルトンパターンのため、プライベートコンストラクタ
  }

  /**
   * SocketService のインスタンスを取得
   * 
   * シングルトンパターンを実装し、アプリケーション全体で
   * 一つのSocket.io接続を共有します。初回呼び出し時に
   * インスタンスを作成し、以降は同じインスタンスを返します。
   * 
   * @static
   * @returns {SocketService} SocketService のインスタンス
   * 
   * @example
   * ```typescript
   * // アプリケーション内のどこからでも同じインスタンスを取得
   * const socketService1 = SocketService.getInstance();
   * const socketService2 = SocketService.getInstance();
   * console.log(socketService1 === socketService2); // true
   * ```
   */
  public static getInstance(): SocketService {
    if (!SocketService.instance) {
      SocketService.instance = new SocketService();
    }
    return SocketService.instance;
  }

  /**
   * サーバーへの Socket.io 接続を確立
   * 
   * 指定されたURLのシグナリングサーバーに接続し、
   * 基本的なイベントリスナーを設定します。接続が既に存在する場合は
   * 既存の接続を切断してから新しい接続を確立します。
   * 
   * @param serverUrl - 接続先サーバーのURL
   * @returns {Promise<void>} 接続完了を示すPromise
   * 
   * @throws {Error} 接続に失敗した場合
   * 
   * @example
   * ```typescript
   * try {
   *   await socketService.connect('http://localhost:3001');
   *   console.log('サーバーに接続しました');
   * } catch (error) {
   *   console.error('接続に失敗:', error);
   * }
   * ```
   */
  public async connect(serverUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.serverUrl = serverUrl;
        
        // 既存の接続があれば切断
        if (this.socket) {
          this.disconnect();
        }

        // 新しいSocket.io接続を作成
        this.socket = io(serverUrl, {
          autoConnect: true,
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
          timeout: 10000
        });

        // 接続成功イベント
        this.socket.on(SOCKET_EVENTS.CONNECT, () => {
          this.isConnected = true;
          console.log('✅ Socket.io サーバーに接続しました');
          resolve();
        });

        // 接続エラーイベント
        this.socket.on('connect_error', (error: Error) => {
          this.isConnected = false;
          console.error('❌ Socket.io 接続エラー:', error);
          reject(error);
        });

        // 切断イベント
        this.socket.on(SOCKET_EVENTS.DISCONNECT, (reason: string) => {
          this.isConnected = false;
          console.log('🔌 Socket.io から切断されました:', reason);
        });

        // 再接続イベント
        this.socket.on('reconnect', (attemptNumber: number) => {
          this.isConnected = true;
          console.log(`🔄 Socket.io に再接続しました (試行回数: ${attemptNumber})`);
        });

      } catch (error) {
        console.error('❌ Socket.io 接続の初期化に失敗:', error);
        reject(error);
      }
    });
  }

  /**
   * サーバーとの接続を切断
   * 
   * 現在のSocket.io接続を適切に終了し、
   * リソースをクリーンアップします。ページを離れる際や
   * アプリケーション終了時に呼び出されます。
   * 
   * @returns {void}
   * 
   * @example
   * ```typescript
   * // React useEffect でのクリーンアップ
   * useEffect(() => {
   *   return () => {
   *     socketService.disconnect();
   *   };
   * }, []);
   * ```
   */
  public disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      console.log('🔌 Socket.io から切断しました');
    }
  }

  /**
   * ルーム参加リクエストを送信
   * 
   * 指定されたルームIDとユーザー名でビデオ通話ルームに参加します。
   * サーバー側での検証後、成功時には 'room-joined' イベントが発行されます。
   * 失敗時にはエラーイベントが発行されます。
   * 
   * @param request - ルーム参加要求データ
   * @returns {void}
   * 
   * @example
   * ```typescript
   * const joinRequest: JoinRoomRequest = {
   *   roomId: 'meeting-room-1',
   *   userName: 'ユーザー太郎'
   * };
   * 
   * // ルーム参加成功イベントのリスナー設定
   * socketService.on('room-joined', (response: JoinRoomResponse) => {
   *   console.log('ルーム参加成功:', response.room);
   *   setCurrentRoom(response.room);
   *   setCurrentUser(response.user);
   * });
   * 
   * // ルーム参加リクエスト送信
   * socketService.joinRoom(joinRequest);
   * ```
   */
  public joinRoom(request: JoinRoomRequest): void {
    if (!this.socket || !this.isConnected) {
      console.error('❌ Socket.io が接続されていません');
      return;
    }

    console.log(`🏠 ルーム参加リクエスト: [${request.roomId}] ユーザー名: "${request.userName}"`);
    this.socket.emit(SOCKET_EVENTS.JOIN_ROOM, request);
  }

  /**
   * ルーム退出リクエストを送信
   * 
   * 現在参加中のルームから退出し、WebRTC接続を終了します。
   * サーバー側ですべての関連データがクリーンアップされ、
   * 他の参加者に退出通知が送信されます。
   * 
   * @returns {void}
   * 
   * @example
   * ```typescript
   * // ユーザーが退出ボタンをクリックした際
   * const handleLeaveRoom = () => {
   *   socketService.leaveRoom();
   *   webrtcService.closeAllConnections();
   *   setIsInRoom(false);
   * };
   * ```
   */
  public leaveRoom(): void {
    if (!this.socket || !this.isConnected) {
      console.error('❌ Socket.io が接続されていません');
      return;
    }

    console.log('🚪 ルーム退出リクエスト送信');
    this.socket.emit(SOCKET_EVENTS.LEAVE_ROOM);
  }

  /**
   * WebRTCオファーメッセージを送信
   * 
   * 指定されたユーザーに対してWebRTC接続オファーを送信します。
   * このメッセージにはSDP（Session Description Protocol）情報が含まれ、
   * 受信者がアンサーを返すことでWebRTC接続が確立されます。
   * 
   * @param message - WebRTCオファーメッセージ
   * @returns {void}
   * 
   * @example
   * ```typescript
   * // WebRTCサービスからの使用例
   * const offerMessage: SignalingMessage = {
   *   fromUserId: currentUserId,
   *   toUserId: targetUserId,
   *   type: 'offer',
   *   data: {
   *     type: 'offer',
   *     sdp: offer.sdp
   *   }
   * };
   * 
   * socketService.sendOffer(offerMessage);
   * ```
   */
  public sendOffer(message: SignalingMessage): void {
    if (!this.socket || !this.isConnected) {
      console.error('❌ Socket.io が接続されていません');
      return;
    }

    console.log(`📤 WebRTCオファー送信: ${message.fromUserId} → ${message.toUserId}`);
    this.socket.emit(SOCKET_EVENTS.OFFER, message);
  }

  /**
   * WebRTCアンサーメッセージを送信
   * 
   * オファーに対する応答としてWebRTCアンサーを送信します。
   * このメッセージによりピア間でのメディア交換条件が合意され、
   * ICE候補の交換に進むことができます。
   * 
   * @param message - WebRTCアンサーメッセージ
   * @returns {void}
   * 
   * @example
   * ```typescript
   * // WebRTCサービスからの使用例
   * const answerMessage: SignalingMessage = {
   *   fromUserId: currentUserId,
   *   toUserId: offerSenderId,
   *   type: 'answer',
   *   data: {
   *     type: 'answer',
   *     sdp: answer.sdp
   *   }
   * };
   * 
   * socketService.sendAnswer(answerMessage);
   * ```
   */
  public sendAnswer(message: SignalingMessage): void {
    if (!this.socket || !this.isConnected) {
      console.error('❌ Socket.io が接続されていません');
      return;
    }

    console.log(`📤 WebRTCアンサー送信: ${message.fromUserId} → ${message.toUserId}`);
    this.socket.emit(SOCKET_EVENTS.ANSWER, message);
  }

  /**
   * ICE候補メッセージを送信
   * 
   * NAT越えのためのICE（Interactive Connectivity Establishment）候補を送信します。
   * 複数の候補が順次送信され、最適な通信経路が自動的に選択されます。
   * 
   * @param message - ICE候補メッセージ
   * @returns {void}
   * 
   * @example
   * ```typescript
   * // WebRTCサービスからの使用例
   * const iceCandidateMessage: SignalingMessage = {
   *   fromUserId: currentUserId,
   *   toUserId: targetUserId,
   *   type: 'ice-candidate',
   *   data: {
   *     candidate: event.candidate.candidate,
   *     sdpMLineIndex: event.candidate.sdpMLineIndex,
   *     sdpMid: event.candidate.sdpMid
   *   }
   * };
   * 
   * socketService.sendIceCandidate(iceCandidateMessage);
   * ```
   */
  public sendIceCandidate(message: SignalingMessage): void {
    if (!this.socket || !this.isConnected) {
      console.error('❌ Socket.io が接続されていません');
      return;
    }

    console.log(`📤 ICE候補送信: ${message.fromUserId} → ${message.toUserId}`);
    this.socket.emit(SOCKET_EVENTS.ICE_CANDIDATE, message);
  }

  /**
   * チャットメッセージを送信
   * 
   * 現在参加中のルームにチャットメッセージを送信します。
   * サーバー側でバリデーションされ、ルーム内の全参加者に配信されます。
   * 
   * @param request - チャットメッセージ送信要求
   * @returns {void}
   * 
   * @example
   * ```typescript
   * // チャット送信フォームのハンドラー
   * const handleSendMessage = (messageText: string) => {
   *   if (!messageText.trim()) return;
   *   
   *   const sendRequest: SendChatMessageRequest = {
   *     roomId: currentRoom.id,
   *     message: messageText.trim()
   *   };
   *   
   *   socketService.sendChatMessage(sendRequest);
   *   setInputMessage(''); // 入力フィールドをクリア
   * };
   * ```
   */
  public sendChatMessage(request: SendChatMessageRequest): void {
    if (!this.socket || !this.isConnected) {
      console.error('❌ Socket.io が接続されていません');
      return;
    }

    console.log(`💬 チャットメッセージ送信: [${request.roomId}] "${request.message}"`);
    this.socket.emit(SOCKET_EVENTS.CHAT_MESSAGE_SEND, request);
  }

  /**
   * Socket.io イベントリスナーを登録
   * 
   * 指定されたイベント名に対してコールバック関数を登録します。
   * サーバーからのリアルタイムイベントを受信するために使用されます。
   * 
   * @param eventName - 監視するイベント名
   * @param callback - イベント発生時に実行するコールバック関数
   * @returns {void}
   * 
   * @example
   * ```typescript
   * // React useEffect でのイベントリスナー設定
   * useEffect(() => {
   *   const handleUserJoined = (user: User) => {
   *     setRemoteUsers(prev => [...prev, user]);
   *     console.log('新しいユーザーが参加:', user.name);
   *   };
   *   
   *   const handleChatMessage = (data: ChatMessageReceived) => {
   *     setMessages(prev => [...prev, data.message]);
   *   };
   *   
   *   socketService.on('user-joined', handleUserJoined);
   *   socketService.on('chat-message-received', handleChatMessage);
   *   
   *   // クリーンアップ
   *   return () => {
   *     socketService.off('user-joined', handleUserJoined);
   *     socketService.off('chat-message-received', handleChatMessage);
   *   };
   * }, []);
   * ```
   */
  public on(eventName: string, callback: EventCallback): void {
    if (!this.socket) {
      console.error('❌ Socket.io が初期化されていません');
      return;
    }

    this.socket.on(eventName, callback);
    console.log(`👂 イベントリスナー登録: ${eventName}`);
  }

  /**
   * Socket.io イベントリスナーを削除
   * 
   * 指定されたイベント名のコールバック関数を削除します。
   * メモリリークを防ぐため、コンポーネントのアンマウント時に
   * 必ず呼び出すことを推奨します。
   * 
   * @param eventName - 削除するイベント名
   * @param callback - 削除するコールバック関数（省略時は全て削除）
   * @returns {void}
   * 
   * @example
   * ```typescript
   * // React useEffect のクリーンアップ関数内
   * useEffect(() => {
   *   const handleUserJoined = (user: User) => {
   *     // ユーザー参加処理
   *   };
   *   
   *   socketService.on('user-joined', handleUserJoined);
   *   
   *   // コンポーネントアンマウント時のクリーンアップ
   *   return () => {
   *     socketService.off('user-joined', handleUserJoined);
   *   };
   * }, []);
   * ```
   */
  public off(eventName: string, callback?: EventCallback): void {
    if (!this.socket) {
      console.error('❌ Socket.io が初期化されていません');
      return;
    }

    if (callback) {
      this.socket.off(eventName, callback);
      console.log(`🔇 特定のイベントリスナー削除: ${eventName}`);
    } else {
      this.socket.off(eventName);
      console.log(`🔇 全イベントリスナー削除: ${eventName}`);
    }
  }

  /**
   * Socket.io の接続状態を取得
   * 
   * 現在のSocket.io接続状態を返します。
   * UIでの接続状態表示やエラーハンドリングに使用されます。
   * 
   * @returns {boolean} 接続状態（true: 接続済み, false: 未接続）
   * 
   * @example
   * ```typescript
   * // React コンポーネントでの接続状態表示
   * const ConnectionStatus: React.FC = () => {
   *   const [isConnected, setIsConnected] = useState(socketService.getConnectionStatus());
   *   
   *   useEffect(() => {
   *     const interval = setInterval(() => {
   *       setIsConnected(socketService.getConnectionStatus());
   *     }, 1000);
   *     
   *     return () => clearInterval(interval);
   *   }, []);
   *   
   *   return (
   *     <div className={`status ${isConnected ? 'connected' : 'disconnected'}`}>
   *       {isConnected ? '🟢 接続済み' : '🔴 未接続'}
   *     </div>
   *   );
   * };
   * ```
   */
  public getConnectionStatus(): boolean {
    return this.isConnected && this.socket?.connected === true;
  }

  /**
   * Socket.io の詳細情報を取得
   * 
   * デバッグとモニタリング用に Socket.io の詳細情報を返します。
   * 開発時のトラブルシューティングに有用です。
   * 
   * @returns {object} Socket.io の詳細情報
   * 
   * @example
   * ```typescript
   * // 開発者コンソールでのデバッグ
   * const socketInfo = socketService.getSocketInfo();
   * console.log('Socket.io 詳細情報:', socketInfo);
   * 
   * // React DevTools での状態確認
   * const DebugPanel: React.FC = () => {
   *   const socketInfo = socketService.getSocketInfo();
   *   
   *   return (
   *     <div className="debug-panel">
   *       <h3>Socket.io デバッグ情報</h3>
   *       <pre>{JSON.stringify(socketInfo, null, 2)}</pre>
   *     </div>
   *   );
   * };
   * ```
   */
  public getSocketInfo(): object {
    if (!this.socket) {
      return {
        status: 'not_initialized',
        connected: false,
        serverUrl: this.serverUrl
      };
    }

    return {
      status: 'initialized',
      connected: this.socket.connected,
      id: this.socket.id,
      serverUrl: this.serverUrl,
      transport: this.socket.io.engine?.transport?.name || 'unknown'
    };
  }

  /**
   * 現在のユーザーIDを取得
   * 
   * ルーム参加時に設定される現在のユーザーIDを返します。
   * WebRTCシグナリングでの送信者識別に使用されます。
   * 
   * @returns {string | null} 現在のユーザーID（未設定の場合はnull）
   */
  public getCurrentUserId(): string | null {
    return this.currentUserId;
  }

  /**
   * 接続状態を取得（ConnectionState形式）
   * 
   * @returns {ConnectionState} 現在の接続状態
   */
  public getConnectionState(): ConnectionState {
    if (!this.socket) return 'disconnected';
    if (this.socket.connected && this.isConnected) return 'connected';
    if (this.socket.connecting) return 'connecting';
    return 'disconnected';
  }

  /**
   * 汎用メッセージ送信メソッド
   * 
   * @param eventName - 送信するイベント名
   * @param data - 送信するデータ
   */
  public sendMessage(eventName: string, data: any): void {
    if (!this.socket || !this.isConnected) {
      console.error('❌ Socket.io が接続されていません');
      return;
    }

    console.log(`📤 メッセージ送信: ${eventName}`, data);
    this.socket.emit(eventName, data);
  }

  /**
   * 接続状態の確認
   * 
   * @returns {boolean} 接続状態
   */
  public isSocketConnected(): boolean {
    return this.isConnected && this.socket?.connected === true;
  }
}

/**
 * SocketService のシングルトンインスタンス
 * 
 * アプリケーション全体で共有される Socket.io サービスインスタンスです。
 * このインスタンスを通じて WebRTC シグナリングとチャット機能を利用します。
 */
export const socketService = SocketService.getInstance();