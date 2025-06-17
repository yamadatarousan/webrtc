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
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
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

  // 接続状態の監視（イベント駆動）
  useEffect(() => {
    const updateConnectionState = () => {
      const currentState = socketService.getConnectionState();
      setConnectionState(currentState);
    };

    // 初回実行
    updateConnectionState();

    // 接続状態変更イベントを監視
    socketService.on('connection-state-changed', updateConnectionState);

    return () => {
      socketService.off('connection-state-changed', updateConnectionState);
    };
  }, []);

  // 状態管理
  const [isChatVisible, setIsChatVisible] = useState<boolean>(false);

  // Refs
  const remoteVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());

  // ローカルメディアストリームを停止
  const stopLocalStream = useCallback(() => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }
    }
  }, [localStream]);

  // ルームから退出
  const leaveRoom = useCallback(() => {
    socketService.leaveRoom();
    webrtcService.closeAllConnections();
    stopLocalStream();
    setIsInRoom(false);
    setRemoteUsers([]);
    setRemoteStreams(new Map());
  }, [stopLocalStream]);

  // Socket.ioイベントリスナーの設定
  useEffect(() => {
    const handleConnectionStateChange = (state: ConnectionState) => {
      setConnectionState(state);
      console.log('接続状態変更:', state);
    };

    const handleRoomJoined = async (response: { room: { users: User[] } }) => {
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
      console.log('📹 ルーム参加成功、メディアストリーム取得開始...');
      // 少し待ってからメディアストリームを取得（DOM要素がレンダリングされるまで）
      setTimeout(async () => {
        try {
          await startLocalStream();
        } catch (error: unknown) {
          console.error('❌ メディアストリーム取得失敗:', error);
          
          // エラーの種類を特定してユーザーに適切なメッセージを表示
          let errorMessage = 'カメラ・マイクの取得に失敗しました。';
          if (error instanceof Error) {
            if (error.name === 'NotAllowedError') {
              errorMessage = 'カメラ・マイクのアクセス許可が必要です。ブラウザの設定を確認してください。';
            } else if (error.name === 'NotFoundError') {
              errorMessage = 'カメラまたはマイクが見つかりません。デバイスが接続されているか確認してください。';
            } else if (error.name === 'NotReadableError') {
              errorMessage = 'カメラまたはマイクが他のアプリケーションで使用中の可能性があります。';
            }
          }
          
          alert(errorMessage + 'ルームから退出します。');
          leaveRoom();
        }
      }, 100);
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

    const handleError = (error: { error?: { code: string; message: string } }) => {
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
  }, [leaveRoom]); // leaveRoomの依存関係を追加

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
      
      // WebRTCサービスにローカルストリームを設定（接続開始前に必須）
      console.log('📹 WebRTCサービスにローカルストリームを設定...');
      webrtcService.setLocalStream(stream);
      
      // ストリーム設定後、少し待機してから接続処理を継続
      await new Promise(resolve => setTimeout(resolve, 100));
      
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
    const connectedUsersCount = connectedUsersRef.current.size;
    const totalRemoteUsers = remoteUsers.length;
    
    switch (connectionState) {
      case 'connected':
        if (isInRoom && totalRemoteUsers > 0) {
          return `✅ 接続中 (${connectedUsersCount}/${totalRemoteUsers}人)`;
        }
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
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-950 text-white relative overflow-hidden">
      {/* 背景の装飾要素 */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-cyan-500/5 rounded-full blur-2xl"></div>
      </div>
      
      {/* ヘッダー */}
      <div className="relative bg-white/5 backdrop-blur-xl border-b border-white/10 shadow-2xl">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
                  WebRTC Studio
                </h1>
                <p className="text-slate-400 text-sm mt-1">プロフェッショナルビデオ通話プラットフォーム</p>
              </div>
            </div>
            
            {/* 接続状態表示 */}
            <div className={`px-6 py-3 rounded-2xl border backdrop-blur-xl shadow-lg transition-all duration-300 ${getConnectionStateClass()}`}>
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${connectionState === 'connected' ? 'bg-green-400' : connectionState === 'connecting' ? 'bg-yellow-400 animate-pulse' : 'bg-red-400'}`}></div>
                <span className="text-sm font-semibold">
                  {getConnectionStateText()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="relative max-w-7xl mx-auto px-6 lg:px-8 py-12">
        {!isInRoom ? (
          /* ルーム参加フォーム */
          <div className="max-w-lg mx-auto">
            <div className="bg-white/5 backdrop-blur-2xl rounded-3xl border border-white/10 p-10 shadow-2xl relative overflow-hidden">
              {/* フォーム内の装飾要素 */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl"></div>
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-purple-500/10 rounded-full blur-xl"></div>
              
              <div className="relative text-center mb-10">
                <div className="mx-auto w-24 h-24 bg-gradient-to-r from-blue-500 via-purple-500 to-cyan-500 rounded-3xl flex items-center justify-center mb-6 shadow-2xl transform rotate-3 hover:rotate-0 transition-transform duration-300">
                  <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
                <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-3">
                  ルームに参加
                </h2>
                <p className="text-slate-300/80 text-lg">ルームIDと名前を入力してプロフェッショナルなビデオ通話を開始しましょう</p>
              </div>
              
              <div className="relative space-y-8">
                <div className="group">
                  <label className="block text-sm font-semibold text-slate-300 mb-3 group-focus-within:text-blue-400 transition-colors">
                    <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M10.5 3L12 2l1.5 1M21 3l-1 1h-4l-1-1M21 3v4a2 2 0 01-2 2H5a2 2 0 01-2-2V3" />
                    </svg>
                    ルームID
                  </label>
                  <input
                    type="text"
                    placeholder="room-12345"
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value)}
                    className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-slate-400/70 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 backdrop-blur-xl transition-all duration-300 hover:bg-white/10 text-lg"
                  />
                </div>
                
                <div className="group">
                  <label className="block text-sm font-semibold text-slate-300 mb-3 group-focus-within:text-purple-400 transition-colors">
                    <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    あなたの名前
                  </label>
                  <input
                    type="text"
                    placeholder="田中太郎"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-slate-400/70 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 backdrop-blur-xl transition-all duration-300 hover:bg-white/10 text-lg"
                  />
                </div>
                
                <button
                  onClick={joinRoom}
                  disabled={connectionState !== 'connected'}
                  className={`group relative w-full py-5 px-8 rounded-2xl font-bold text-white text-lg transition-all duration-300 overflow-hidden ${
                    connectionState === 'connected'
                      ? 'bg-gradient-to-r from-blue-600 via-purple-600 to-cyan-600 hover:from-blue-700 hover:via-purple-700 hover:to-cyan-700 transform hover:scale-[1.02] shadow-2xl hover:shadow-blue-500/25 active:scale-[0.98]'
                      : 'bg-slate-700 cursor-not-allowed opacity-50'
                  }`}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-400 via-purple-400 to-cyan-400 opacity-0 group-hover:opacity-20 transition-opacity duration-300"></div>
                  <div className="relative flex items-center justify-center space-x-3">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <span>ルームに参加する</span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* ビデオ通話画面 */
          <div className="space-y-6">
            {/* ルーム情報とコントロール */}
            <div className="bg-white/5 backdrop-blur-2xl rounded-3xl border border-white/10 p-8 shadow-2xl">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                <div className="flex items-center space-x-4">
                  <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center shadow-xl">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
                      {roomId}
                    </h2>
                    <div className="text-slate-300 text-lg">
                      <span className="inline-flex items-center">
                        <span className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse inline-block"></span>
                        {remoteUsers.length + 1}人が参加中
                      </span>
                    </div>
                  </div>
                </div>
                
                {/* コントロールボタン */}
                <div className="flex flex-wrap gap-4">
                  <button
                    onClick={toggleAudio}
                    className={`group relative px-6 py-4 rounded-2xl font-bold transition-all duration-300 transform hover:scale-105 active:scale-95 shadow-lg ${
                      isAudioEnabled
                        ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-green-500/25 hover:shadow-green-500/40'
                        : 'bg-gradient-to-r from-red-500 to-pink-500 text-white shadow-red-500/25 hover:shadow-red-500/40'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {isAudioEnabled ? (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                        )}
                      </svg>
                      <span>{isAudioEnabled ? 'ミュート解除' : 'ミュート'}</span>
                    </div>
                  </button>
                  
                  <button
                    onClick={toggleVideo}
                    className={`group relative px-6 py-4 rounded-2xl font-bold transition-all duration-300 transform hover:scale-105 active:scale-95 shadow-lg ${
                      isVideoEnabled
                        ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-blue-500/25 hover:shadow-blue-500/40'
                        : 'bg-gradient-to-r from-red-500 to-pink-500 text-white shadow-red-500/25 hover:shadow-red-500/40'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {isVideoEnabled ? (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18 21l-7-4m0 0L5 21l.001-.001m6.999-4L18 21z" />
                        )}
                      </svg>
                      <span>{isVideoEnabled ? 'カメラOFF' : 'カメラON'}</span>
                    </div>
                  </button>
                  
                  <button
                    onClick={leaveRoom}
                    className="group relative px-6 py-4 bg-gradient-to-r from-red-600 to-pink-600 text-white rounded-2xl font-bold transition-all duration-300 transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-red-500/40"
                  >
                    <div className="flex items-center space-x-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      <span>退出</span>
                    </div>
                  </button>
                </div>
              </div>
            </div>

            {/* ビデオグリッド */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
              {/* ローカルビデオ */}
              <div className="group bg-white/5 backdrop-blur-2xl rounded-3xl border border-white/10 p-6 shadow-2xl hover:shadow-blue-500/10 transition-all duration-300 relative overflow-hidden">
                {/* カード内の装飾要素 */}
                <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/10 rounded-full blur-xl"></div>
                
                <div className="relative flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center shadow-lg">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-bold text-white">{userName}</h3>
                  </div>
                  <div className="px-4 py-2 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border border-blue-500/30 text-blue-300 text-sm font-bold rounded-xl backdrop-blur-sm">
                    You
                  </div>
                </div>
                
                <div className="relative aspect-video rounded-2xl overflow-hidden bg-gradient-to-br from-slate-800 to-slate-900 shadow-2xl border border-white/10">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  {!isVideoEnabled && (
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
                      <div className="text-center">
                        <div className="w-20 h-20 bg-gradient-to-r from-slate-600 to-slate-700 rounded-full flex items-center justify-center mx-auto mb-4 shadow-xl">
                          <svg className="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18 21l-7-4m0 0L5 21l.001-.001m6.999-4L18 21z" />
                          </svg>
                        </div>
                        <p className="text-slate-300 font-semibold">カメラがオフです</p>
                        <p className="text-slate-400 text-sm mt-1">カメラをオンにして参加者に表示</p>
                      </div>
                    </div>
                  )}
                  
                  {/* ステータスインジケーター */}
                  <div className="absolute bottom-4 left-4 flex space-x-2">
                    <div className={`px-3 py-1 rounded-full text-xs font-bold backdrop-blur-sm ${
                      isAudioEnabled 
                        ? 'bg-green-500/80 text-white' 
                        : 'bg-red-500/80 text-white'
                    }`}>
                      {isAudioEnabled ? '🎤' : '🔇'}
                    </div>
                    <div className={`px-3 py-1 rounded-full text-xs font-bold backdrop-blur-sm ${
                      isVideoEnabled 
                        ? 'bg-blue-500/80 text-white' 
                        : 'bg-red-500/80 text-white'
                    }`}>
                      {isVideoEnabled ? '📹' : '📷'}
                    </div>
                  </div>
                </div>
              </div>

              {/* リモートビデオ */}
              {Array.from(remoteStreams.entries()).map(([userId, stream]) => {
                const user = remoteUsers.find(u => u.id === userId);
                return (
                  <div key={userId} className="group bg-white/5 backdrop-blur-2xl rounded-3xl border border-white/10 p-6 shadow-2xl hover:shadow-purple-500/10 transition-all duration-300 relative overflow-hidden">
                    {/* カード内の装飾要素 */}
                    <div className="absolute top-0 right-0 w-20 h-20 bg-purple-500/10 rounded-full blur-xl"></div>
                    
                    <div className="relative flex items-center justify-between mb-6">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-lg">
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                        <h3 className="text-xl font-bold text-white">{user?.name || 'ユーザー'}</h3>
                      </div>
                      <div className="px-4 py-2 bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 text-purple-300 text-sm font-bold rounded-xl backdrop-blur-sm">
                        Remote
                      </div>
                    </div>
                    
                    <div className="relative aspect-video rounded-2xl overflow-hidden bg-gradient-to-br from-slate-800 to-slate-900 shadow-2xl border border-white/10">
                      <video
                        ref={(video) => {
                          if (video) {
                            video.srcObject = stream;
                            remoteVideoRefs.current.set(userId, video);
                          } else {
                            // video要素がunmountされる際のクリーンアップ
                            const existingVideo = remoteVideoRefs.current.get(userId);
                            if (existingVideo) {
                              existingVideo.srcObject = null;
                              remoteVideoRefs.current.delete(userId);
                            }
                          }
                        }}
                        autoPlay
                        playsInline
                        className="w-full h-full object-cover"
                      />
                      
                      {/* 接続状態インジケーター */}
                      <div className="absolute top-4 right-4">
                        <div className="px-3 py-1 bg-green-500/80 text-white text-xs font-bold rounded-full backdrop-blur-sm flex items-center space-x-1">
                          <div className="w-2 h-2 bg-green-300 rounded-full animate-pulse"></div>
                          <span>接続中</span>
                        </div>
                      </div>
                      
                      {/* ユーザー名オーバーレイ */}
                      <div className="absolute bottom-4 left-4 right-4">
                        <div className="bg-black/50 backdrop-blur-sm rounded-xl p-3">
                          <p className="text-white font-semibold text-sm">{user?.name || 'ユーザー'}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 参加者一覧とチャット */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 参加者一覧 */}
              <div className="bg-white/5 backdrop-blur-2xl rounded-3xl border border-white/10 p-8 shadow-2xl">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="w-12 h-12 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl flex items-center justify-center shadow-lg">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">参加者</h3>
                    <p className="text-slate-300">{remoteUsers.length + 1}人がアクティブ</p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  {/* 自分 */}
                  <div className="flex items-center space-x-4 p-4 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 rounded-2xl border border-blue-500/20 backdrop-blur-sm">
                    <div className="relative">
                      <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center shadow-lg">
                        <span className="text-white font-bold text-lg">
                          {userName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white"></div>
                    </div>
                    <div className="flex-1">
                      <p className="text-white font-semibold text-lg">{userName}</p>
                      <p className="text-blue-300 text-sm font-medium">あなた (ホスト)</p>
                    </div>
                    <div className="flex space-x-1">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center ${isAudioEnabled ? 'bg-green-500' : 'bg-red-500'}`}>
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          {isAudioEnabled ? (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                          ) : (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                          )}
                        </svg>
                      </div>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center ${isVideoEnabled ? 'bg-blue-500' : 'bg-red-500'}`}>
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          {isVideoEnabled ? (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          ) : (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18 21l-7-4m0 0L5 21l.001-.001m6.999-4L18 21z" />
                          )}
                        </svg>
                      </div>
                    </div>
                  </div>
                  
                  {/* リモートユーザー */}
                  {remoteUsers.map(user => (
                    <div key={user.id} className="flex items-center space-x-4 p-4 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-2xl border border-purple-500/20 backdrop-blur-sm">
                      <div className="relative">
                        <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-lg">
                          <span className="text-white font-bold text-lg">
                            {user.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white"></div>
                      </div>
                      <div className="flex-1">
                        <p className="text-white font-semibold text-lg">{user.name}</p>
                        <p className="text-purple-300 text-sm font-medium">参加者</p>
                      </div>
                      <div className="flex space-x-1">
                        <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                          </svg>
                        </div>
                        <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* チャットエリア */}
              <div className="bg-white/5 backdrop-blur-2xl rounded-3xl border border-white/10 p-8 shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-2xl flex items-center justify-center shadow-lg">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">チャット</h3>
                      <p className="text-slate-300">メッセージを送信</p>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => setIsChatVisible(!isChatVisible)}
                    className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-2xl font-bold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-cyan-500/25"
                  >
                    {isChatVisible ? 'チャットを閉じる' : 'チャットを開く'}
                  </button>
                </div>
                
                <div className="text-center py-12">
                  <svg className="w-16 h-16 text-slate-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <p className="text-slate-400 text-lg">チャットボタンを押してメッセージを送信</p>
                </div>
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