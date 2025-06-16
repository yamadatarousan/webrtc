/**
 * WebRTCビデオ通話アプリケーションのメインコンポーネント
 * 
 * このコンポーネントは、WebRTCを使用したリアルタイムビデオ通話機能の
 * 完全な実装を提供します。以下の機能を含みます：
 * 
 * 主な機能：
 * - ルーム参加・退出の管理
 * - ローカルメディアストリーム（カメラ・マイク）の制御
 * - 複数ユーザーとのWebRTC接続確立
 * - リアルタイムチャット機能
 * - 音声・映像のミュート/アンミュート
 * - 接続状態の監視と表示
 * - レスポンシブなビデオレイアウト
 * 
 * @fileoverview WebRTCビデオ通話のメインコンポーネント
 * @author WebRTCアプリケーション開発チーム
 * @version 1.0.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { socketService } from '../services/socketService';
import { webrtcService } from '../services/webrtcService';
import { ChatPanel } from './ChatPanel';
import type { 
  JoinRoomRequest, 
  ConnectionState,
  User
} from '../types/webrtcTypes';
import { 
  DEFAULT_MEDIA_CONSTRAINTS 
} from '../types/webrtcTypes';

/**
 * VideoCallコンポーネントのプロパティインターフェース
 * 
 * 現在は外部プロパティを受け取らないため空ですが、
 * 将来的な拡張性を考慮して定義されています。
 * 
 * @interface VideoCallProps
 */
interface VideoCallProps {}

/**
 * WebRTCビデオ通話のメインUIコンポーネント
 * 
 * このコンポーネントはWebRTCを活用したリアルタイムビデオ通話の
 * 完全なユーザーインターフェースを提供します。Socket.ioを使用した
 * シグナリングサーバーとの通信により、複数ユーザー間での
 * 安定したP2P接続を実現します。
 * 
 * 技術仕様：
 * - WebRTC MediaStream API使用
 * - Socket.ioによるリアルタイム通信
 * - React Hooks による状態管理
 * - TypeScript による型安全性
 * - レスポンシブなCSS Grid レイアウト
 * 
 * ブラウザ対応：
 * - Chrome 70+ (推奨)
 * - Firefox 70+
 * - Safari 14+
 * - Edge 88+
 * 
 * @component
 * @returns {JSX.Element} ビデオ通話インターフェース
 * 
 * @example
 * ```tsx
 * import { VideoCall } from './components/VideoCall';
 * 
 * function App() {
 *   return (
 *     <div className="app">
 *       <VideoCall />
 *     </div>
 *   );
 * }
 * ```
 * 
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API} WebRTC API Documentation
 * @since 1.0.0
 */
export const VideoCall: React.FC<VideoCallProps> = () => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [isInRoom, setIsInRoom] = useState(false);
  const [roomId, setRoomId] = useState('room1');
  const [userName, setUserName] = useState('');
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [remoteUsers, setRemoteUsers] = useState<User[]>([]);

  const localVideoRef = useRef<HTMLVideoElement>(null);

  // Socket.ioの初期化を最初に実行
  useEffect(() => {
    const initializeSocket = async () => {
      try {
        console.log('🔌 Socket.io初期化を開始...');
        await socketService.connect('http://localhost:3001');
        console.log('✅ Socket.io初期化完了');
        
        // Socket.io初期化後にWebRTCServiceのリスナーを設定
        console.log('📡 WebRTCServiceリスナー初期化を開始...');
        webrtcService.initializeSocketListeners();
        console.log('✅ WebRTCServiceリスナー初期化完了');
        
        // 接続状態を手動で更新
        console.log('🔄 接続状態を更新中...');
        setConnectionState(socketService.getConnectionState());
        console.log('✅ 接続状態更新完了:', socketService.getConnectionState());
      } catch (error) {
        console.error('❌ Socket.io初期化エラー:', error);
        setConnectionState('disconnected');
      }
    };

    initializeSocket();
  }, []);

  // 接続状態の定期チェック
  useEffect(() => {
    const checkConnectionState = () => {
      const currentState = socketService.getConnectionState();
      setConnectionState(currentState);
    };

    // 初回実行
    checkConnectionState();

    // 1秒間隔で接続状態をチェック
    const interval = setInterval(checkConnectionState, 1000);

    return () => clearInterval(interval);
  }, []);

  // 状態管理
  const [isChatVisible, setIsChatVisible] = useState<boolean>(false);

  // Refs
  const remoteVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());

  // Socket.ioイベントリスナーの設定
  useEffect(() => {
    const handleConnectionStateChange = (state: ConnectionState) => {
      setConnectionState(state);
      console.log('接続状態変更:', state);
    };

    const handleRoomJoined = async (response: any) => {
      console.log('ルーム参加成功:', response);
      setIsInRoom(true);
      
      // 既存のユーザーがいる場合、リモートユーザーリストを設定
      if (response.room && response.room.users) {
        const currentUserId = socketService.getCurrentUserId();
        console.log('🔍 現在のユーザーID:', currentUserId);
        console.log('🔍 ルーム内の全ユーザー:', response.room.users);
        
        const existingUsers = response.room.users.filter((user: User) => {
          const isNotSelf = user.id !== currentUserId;
          console.log(`🔍 ユーザー ${user.id} は自分ではない: ${isNotSelf}`);
          return isNotSelf;
        });
        
        setRemoteUsers(existingUsers);
        console.log('🔍 フィルタ後の既存ユーザー:', existingUsers);
      }

      // ルーム参加成功後にメディアストリームを取得
      try {
        console.log('📹 ルーム参加成功、メディアストリーム取得開始...');
        // 少し待ってからメディアストリームを取得（DOM要素がレンダリングされるまで）
        setTimeout(async () => {
          try {
            await startLocalStream();
          } catch (error) {
            console.error('❌ メディアストリーム取得失敗:', error);
            alert('カメラ・マイクの取得に失敗しました。ルームから退出します。');
            leaveRoom();
          }
        }, 100);
      } catch (error) {
        console.error('❌ メディアストリーム初期化失敗:', error);
      }
    };

    const handleUserJoined = (user: User) => {
      const currentUserId = socketService.getCurrentUserId();
      console.log('🔍 新しいユーザーが参加:', user);
      console.log('🔍 現在のユーザーID:', currentUserId);
      console.log('🔍 参加したユーザーは自分ではない:', user.id !== currentUserId);
      
      // 自分自身の場合は処理をスキップ
      if (user.id === currentUserId) {
        console.log('🔍 自分自身の参加通知のためスキップ');
        return;
      }
      
      setRemoteUsers(prev => [...prev, user]);
      console.log('🔍 リモートユーザーリストに追加完了、接続は useEffect で処理されます');
    };

    const handleUserLeft = (userId: string) => {
      console.log('ユーザーが退出:', userId);
      setRemoteUsers(prev => prev.filter(user => user.id !== userId));
      // 接続済みユーザーリストからも削除
      connectedUsersRef.current.delete(userId);
    };

    const handleError = (error: any) => {
      console.error('エラー:', error);
      
      // エラーの詳細な内容を確認
      if (error && error.error) {
        const { code, message } = error.error;
        console.error('詳細エラー:', { code, message });
        
        if (code === 'USER_NOT_FOUND') {
          alert(`WebRTC接続エラー: ${message}\n\n接続相手が見つかりません。ページを再読み込みしてみてください。`);
        } else {
          alert(`エラー (${code}): ${message}`);
        }
      } else {
        alert(`エラー: ${error.message || 'unknown error'}`);
      }
    };

    // イベントリスナーを登録
    socketService.on('connection-state-changed', handleConnectionStateChange);
    socketService.on('room-joined', handleRoomJoined);
    socketService.on('user-joined', handleUserJoined);
    socketService.on('user-left', handleUserLeft);
    socketService.on('error', handleError);

    // 初期接続状態を設定
    setConnectionState(socketService.getConnectionState());

    // クリーンアップ
    return () => {
      socketService.off('connection-state-changed', handleConnectionStateChange);
      socketService.off('room-joined', handleRoomJoined);
      socketService.off('user-joined', handleUserJoined);
      socketService.off('user-left', handleUserLeft);
      socketService.off('error', handleError);
    };
  }, []); // 依存配列は空のままでOK - イベントハンドラー自体はlocalStreamに依存しない

  // WebRTCイベントリスナーの設定
  useEffect(() => {
    const handleRemoteStream = ({ userId, stream }: { userId: string; stream: MediaStream }) => {
      console.log('📥 リモートストリーム受信:', userId, stream);
      console.log('📥 ストリーム詳細:', {
        streamId: stream.id,
        videoTracks: stream.getVideoTracks().length,
        audioTracks: stream.getAudioTracks().length,
        active: stream.active
      });
      
      setRemoteStreams(prev => {
        const newStreams = new Map(prev);
        newStreams.set(userId, stream);
        console.log('📥 リモートストリーム状態更新:', Array.from(newStreams.keys()));
        
        // ストリームのトラック情報を詳細にログ出力
        stream.getVideoTracks().forEach((track, index) => {
          console.log(`📥 リモートビデオトラック ${index}:`, {
            id: track.id,
            kind: track.kind,
            enabled: track.enabled,
            readyState: track.readyState,
            label: track.label
          });
        });
        
        stream.getAudioTracks().forEach((track, index) => {
          console.log(`📥 リモートオーディオトラック ${index}:`, {
            id: track.id,
            kind: track.kind,
            enabled: track.enabled,
            readyState: track.readyState,
            label: track.label
          });
        });
        
        return newStreams;
      });
    };

    const handleRemoteStreamRemoved = ({ userId }: { userId: string }) => {
      console.log('📤 リモートストリーム削除:', userId);
      setRemoteStreams(prev => {
        const newStreams = new Map(prev);
        newStreams.delete(userId);
        return newStreams;
      });
    };

    // WebRTCイベントリスナーを登録
    webrtcService.on('remote-stream', handleRemoteStream);
    webrtcService.on('remote-stream-removed', handleRemoteStreamRemoved);

    // クリーンアップ
    return () => {
      webrtcService.off('remote-stream', handleRemoteStream);
      webrtcService.off('remote-stream-removed', handleRemoteStreamRemoved);
    };
  }, []);

  // 接続済みユーザーを追跡するためのRef
  const connectedUsersRef = useRef<Set<string>>(new Set());

  // 接続開始の共通処理
  const tryStartConnections = useCallback(() => {
    if (!localStream || !isInRoom || remoteUsers.length === 0) {
      console.log('🔗 接続開始の条件が満たされていません:', {
        hasLocalStream: !!localStream,
        isInRoom,
        remoteUsersCount: remoteUsers.length
      });
      return;
    }

    console.log('🔗 接続条件確認:', {
      hasLocalStream: !!localStream,
      isInRoom,
      remoteUsersCount: remoteUsers.length,
      connectedUsersCount: connectedUsersRef.current.size
    });
    
    remoteUsers.forEach((user: User) => {
      // まだ接続していないユーザーとのみ接続を開始
      if (!connectedUsersRef.current.has(user.id)) {
        console.log('🔗 未接続ユーザーとの接続を開始:', user.id);
        webrtcService.initiateCall(user.id);
        connectedUsersRef.current.add(user.id);
      } else {
        console.log('🔗 既に接続済みのユーザー:', user.id);
      }
    });
  }, [localStream, isInRoom, remoteUsers]);

  // ローカルストリームが設定された後、未接続ユーザーとの接続を開始
  useEffect(() => {
    tryStartConnections();
  }, [tryStartConnections]);

  // ローカルメディアストリームを取得
  const startLocalStream = async () => {
    try {
      console.log('📹 メディアストリーム取得開始...');
      console.log('📹 使用する制約:', DEFAULT_MEDIA_CONSTRAINTS);
      
      // デバイス一覧を確認
      const devices = await navigator.mediaDevices.enumerateDevices();
      console.log('📹 利用可能なデバイス:', devices);
      
      const stream = await navigator.mediaDevices.getUserMedia(DEFAULT_MEDIA_CONSTRAINTS);
      console.log('📹 メディアストリーム取得成功:', stream);
      console.log('📹 ストリームID:', stream.id);
      console.log('📹 ビデオトラック数:', stream.getVideoTracks().length);
      console.log('📹 オーディオトラック数:', stream.getAudioTracks().length);
      
      // すべてのトラックの状態をログ出力
      stream.getVideoTracks().forEach((track, index) => {
        console.log(`📹 ビデオトラック ${index}:`, {
          id: track.id,
          kind: track.kind,
          enabled: track.enabled,
          readyState: track.readyState,
          label: track.label,
          settings: track.getSettings()
        });
      });
      
      stream.getAudioTracks().forEach((track, index) => {
        console.log(`🎤 オーディオトラック ${index}:`, {
          id: track.id,
          kind: track.kind,
          enabled: track.enabled,
          readyState: track.readyState,
          label: track.label,
          settings: track.getSettings()
        });
      });
      
      setLocalStream(stream);
      
      // WebRTCサービスにローカルストリームを設定
      console.log('📹 WebRTCサービスにローカルストリームを設定...');
      webrtcService.setLocalStream(stream);
      
      // ビデオ要素にストリームを設定 - DOM要素の存在を確認してから設定
      const setVideoStream = () => {
        if (localVideoRef.current) {
          console.log('📹 ローカルビデオ要素の参照:', localVideoRef.current);
          localVideoRef.current.srcObject = stream;
          console.log('📹 ローカルビデオ要素にストリーム設定完了');
          console.log('📹 ビデオ要素のsrcObject:', localVideoRef.current.srcObject);
          
          // ビデオの読み込み完了を待つ
          localVideoRef.current.onloadedmetadata = () => {
            console.log('📹 ビデオメタデータ読み込み完了');
            console.log('📹 ビデオサイズ:', {
              videoWidth: localVideoRef.current?.videoWidth,
              videoHeight: localVideoRef.current?.videoHeight
            });
            if (localVideoRef.current) {
              localVideoRef.current.play().then(() => {
                console.log('📹 ビデオ再生開始成功');
              }).catch(e => {
                console.warn('📹 ビデオ自動再生失敗:', e);
              });
            }
          };
          
          // エラーハンドリング
          localVideoRef.current.onerror = (e) => {
            console.error('📹 ビデオ要素エラー:', e);
          };
          
          // ビデオの再生試行
          if (localVideoRef.current.readyState >= HTMLMediaElement.HAVE_METADATA) {
            localVideoRef.current.play().catch(e => {
              console.warn('📹 ビデオ再生失敗:', e);
            });
          }
        } else {
          console.warn('📹 ローカルビデオ要素の参照が見つかりません、DOM要素のレンダリングを待機中...');
          // DOM要素がまだレンダリングされていない場合、短時間待機してリトライ
          setTimeout(setVideoStream, 100);
        }
      };

      // ビデオストリーム設定を実行
      setVideoStream();
      
      console.log('✅ ローカルストリーム設定完了');
    } catch (error) {
      console.error('❌ メディアアクセスエラー:', error);
      // より詳細なエラー情報を表示
      if (error instanceof DOMException) {
        let errorMessage = '';
        switch (error.name) {
          case 'NotAllowedError':
            errorMessage = 'カメラ・マイクのアクセスが拒否されました。ブラウザの設定から許可してください。';
            break;
          case 'NotFoundError':
            errorMessage = 'カメラまたはマイクが見つかりません。デバイスが接続されているか確認してください。';
            break;
          case 'NotReadableError':
            errorMessage = 'カメラまたはマイクが他のアプリケーションで使用中です。';
            break;
          default:
            errorMessage = `カメラ・マイクのアクセスに失敗しました: ${error.message}`;
        }
        alert(errorMessage);
      } else {
        alert(`メディアアクセスエラー: ${error instanceof Error ? error.message : String(error)}`);
      }
      throw error;
    }
  };

  // ローカルメディアストリームを停止
  const stopLocalStream = () => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }
    }
  };

  // ルームに参加
  const joinRoom = async () => {
    if (!roomId.trim() || !userName.trim()) {
      alert('ルームIDとユーザー名を入力してください');
      return;
    }

    if (!socketService.isSocketConnected()) {
      alert('サーバーに接続されていません。少し待ってから再試行してください。');
      return;
    }

    try {
      // まずルーム参加リクエストを送信（メディアストリーム取得は後で行う）
      const request: JoinRoomRequest = {
        roomId: roomId.trim(),
        userName: userName.trim(),
      };

      console.log('🏠 ルーム参加リクエスト送信...');
      socketService.joinRoom(request);
    } catch (error) {
      console.error('ルーム参加エラー:', error);
      alert('ルームへの参加に失敗しました');
    }
  };

  // ルームから退出
  const leaveRoom = () => {
    socketService.leaveRoom();
    webrtcService.closeAllConnections();
    stopLocalStream();
    setIsInRoom(false);
    setRemoteUsers([]);
    setRemoteStreams(new Map());
  };

  // 音声のON/OFF切り替え
  const toggleAudio = () => {
    if (localStream) {
      const audioTracks = localStream.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !isAudioEnabled;
      });
      setIsAudioEnabled(!isAudioEnabled);
    }
  };

  // ビデオのON/OFF切り替え
  const toggleVideo = () => {
    if (localStream) {
      const videoTracks = localStream.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = !isVideoEnabled;
      });
      setIsVideoEnabled(!isVideoEnabled);
    }
  };

  // 接続状態の表示用スタイル
  const getConnectionStateClass = () => {
    switch (connectionState) {
      case 'connected':
        return 'text-secondary bg-secondary/10 border-secondary/20';
      case 'connecting':
      case 'reconnecting':
        return 'text-accent bg-accent/10 border-accent/20';
      case 'disconnected':
      case 'failed':
        return 'text-danger bg-danger/10 border-danger/20';
      default:
        return 'text-gray-500 bg-gray-100 border-gray-200';
    }
  };

  const getConnectionStateText = () => {
    switch (connectionState) {
      case 'connected':
        return '✅ 接続中';
      case 'connecting':
        return '🔄 接続中...';
      case 'reconnecting':
        return '🔄 再接続中...';
      case 'failed':
        return '❌ 接続失敗';
      default:
        return '⚫ 切断済み';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
      {/* ヘッダー */}
      <div className="bg-white/10 backdrop-blur-md border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text text-transparent">
              🎥 WebRTC ビデオ通話
            </h1>
            
            {/* 接続状態表示 */}
            <div className={`px-4 py-2 rounded-full border backdrop-blur-sm ${getConnectionStateClass()}`}>
              <span className="text-sm font-medium">
                {getConnectionStateText()}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!isInRoom ? (
          /* ルーム参加フォーム */
          <div className="max-w-md mx-auto">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-8 shadow-2xl">
              <div className="text-center mb-8">
                <div className="mx-auto w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">ルームに参加</h2>
                <p className="text-gray-300">ルームIDと名前を入力してビデオ通話を開始</p>
              </div>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    ルームID
                  </label>
                  <input
                    type="text"
                    placeholder="例: room1"
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value)}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent backdrop-blur-sm"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    あなたの名前
                  </label>
                  <input
                    type="text"
                    placeholder="名前を入力"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent backdrop-blur-sm"
                  />
                </div>
                
                <button
                  onClick={joinRoom}
                  disabled={connectionState !== 'connected'}
                  className={`w-full py-3 px-6 rounded-xl font-medium text-white transition-all duration-200 ${
                    connectionState === 'connected'
                      ? 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 transform hover:scale-105 shadow-lg hover:shadow-xl'
                      : 'bg-gray-600 cursor-not-allowed opacity-50'
                  }`}
                >
                  🚀 ルームに参加
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* ビデオ通話画面 */
          <div className="space-y-8">
            {/* ルーム情報とコントロール */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-6">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-2">📍 ルーム: {roomId}</h2>
                  <p className="text-gray-300">👥 {remoteUsers.length + 1}人が参加中</p>
                </div>
                
                {/* コントロールボタン */}
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={toggleAudio}
                    className={`px-6 py-3 rounded-xl font-medium transition-all duration-200 transform hover:scale-105 ${
                      isAudioEnabled
                        ? 'bg-secondary text-white shadow-lg hover:shadow-xl'
                        : 'bg-danger text-white shadow-lg hover:shadow-xl'
                    }`}
                  >
                    {isAudioEnabled ? '🎤 音声ON' : '🔇 音声OFF'}
                  </button>
                  <button
                    onClick={toggleVideo}
                    className={`px-6 py-3 rounded-xl font-medium transition-all duration-200 transform hover:scale-105 ${
                      isVideoEnabled
                        ? 'bg-secondary text-white shadow-lg hover:shadow-xl'
                        : 'bg-danger text-white shadow-lg hover:shadow-xl'
                    }`}
                  >
                    {isVideoEnabled ? '📹 ビデオON' : '📷 ビデオOFF'}
                  </button>
                  <button
                    onClick={leaveRoom}
                    className="px-6 py-3 bg-danger text-white rounded-xl font-medium transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl"
                  >
                    🚪 退出
                  </button>
                </div>
              </div>
            </div>

            {/* ビデオグリッド */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {/* ローカルビデオ */}
              <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-4 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">👤 {userName}</h3>
                  <span className="px-3 py-1 bg-secondary/20 text-secondary text-xs font-medium rounded-full">
                    あなた
                  </span>
                </div>
                <div className="relative aspect-video rounded-xl overflow-hidden bg-gray-900 border-2 border-secondary/30">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  {!isVideoEnabled && (
                    <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
                      <div className="text-center">
                        <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-2">
                          <svg className="w-8 h-8 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <p className="text-gray-400 text-sm">カメラOFF</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* リモートビデオ */}
              {Array.from(remoteStreams.entries()).map(([userId, stream]) => {
                const user = remoteUsers.find(u => u.id === userId);
                return (
                  <div key={userId} className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-4 shadow-xl">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-white">👤 {user?.name || 'ユーザー'}</h3>
                      <span className="px-3 py-1 bg-primary/20 text-primary text-xs font-medium rounded-full">
                        リモート
                      </span>
                    </div>
                    <div className="relative aspect-video rounded-xl overflow-hidden bg-gray-900 border-2 border-primary/30">
                      <video
                        ref={(video) => {
                          if (video) {
                            video.srcObject = stream;
                            remoteVideoRefs.current.set(userId, video);
                          }
                        }}
                        autoPlay
                        playsInline
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 参加者一覧 */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-6">
              <h3 className="text-xl font-bold text-white mb-4">👥 参加者一覧</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="flex items-center space-x-3 p-3 bg-secondary/10 rounded-xl border border-secondary/20">
                  <div className="w-10 h-10 bg-secondary rounded-full flex items-center justify-center">
                    <span className="text-white font-medium text-sm">
                      {userName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-white font-medium">{userName}</p>
                    <p className="text-secondary text-sm">あなた</p>
                  </div>
                </div>
                
                {remoteUsers.map(user => (
                  <div key={user.id} className="flex items-center space-x-3 p-3 bg-primary/10 rounded-xl border border-primary/20">
                    <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                      <span className="text-white font-medium text-sm">
                        {user.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="text-white font-medium">{user.name}</p>
                      <p className="text-primary text-sm">リモートユーザー</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* チャット機能 */}
      {isInRoom && (
        <ChatPanel
          roomId={roomId}
          isVisible={isChatVisible}
          onToggleVisibility={() => setIsChatVisible(!isChatVisible)}
        />
      )}
    </div>
  );
}; 