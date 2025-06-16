import React, { useState, useEffect, useRef, useCallback } from 'react';
import { socketService } from '../services/socketService';
import { webrtcService } from '../services/webrtcService';
import type { 
  JoinRoomRequest, 
  ConnectionState,
  User
} from '../types/webrtcTypes';
import { 
  DEFAULT_MEDIA_CONSTRAINTS 
} from '../types/webrtcTypes';

interface VideoCallProps {}

export const VideoCall: React.FC<VideoCallProps> = () => {
  // 状態管理
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [roomId, setRoomId] = useState<string>('');
  const [userName, setUserName] = useState<string>('');
  const [isInRoom, setIsInRoom] = useState<boolean>(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState<boolean>(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState<boolean>(true);
  const [remoteUsers, setRemoteUsers] = useState<User[]>([]);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());

  // Refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
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
      alert(`エラー: ${error.message}`);
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

    if (!socketService.isConnected()) {
      alert('サーバーに接続されていません。少し待ってから再試行してください。');
      return;
    }

    try {
      // まずルーム参加リクエストを送信（メディアストリーム取得は後で行う）
      const request: JoinRoomRequest = {
        roomId: roomId.trim(),
        userId: `user-${Date.now()}`, // 簡易的なユーザーID生成
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
  const getConnectionStateStyle = () => {
    switch (connectionState) {
      case 'connected':
        return { color: 'green' };
      case 'connecting':
      case 'reconnecting':
        return { color: 'orange' };
      case 'disconnected':
      case 'failed':
        return { color: 'red' };
      default:
        return { color: 'gray' };
    }
  };

  return (
    <div className="video-call-container" style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>WebRTC ビデオ通話アプリ</h1>
      
      {/* 接続状態表示 */}
      <div style={{ marginBottom: '20px' }}>
        <span>接続状態: </span>
        <span style={getConnectionStateStyle()}>
          {connectionState === 'connected' ? '✅ 接続中' : 
           connectionState === 'connecting' ? '🔄 接続中...' :
           connectionState === 'reconnecting' ? '🔄 再接続中...' :
           connectionState === 'failed' ? '❌ 接続失敗' :
           '⚫ 切断済み'}
        </span>
      </div>

      {!isInRoom ? (
        /* ルーム参加フォーム */
        <div className="join-form" style={{ marginBottom: '20px' }}>
          <h2>ルームに参加</h2>
          <div style={{ marginBottom: '10px' }}>
            <input
              type="text"
              placeholder="ルームID (例: room1)"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              style={{ padding: '10px', marginRight: '10px', minWidth: '200px' }}
            />
          </div>
          <div style={{ marginBottom: '10px' }}>
            <input
              type="text"
              placeholder="あなたの名前"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              style={{ padding: '10px', marginRight: '10px', minWidth: '200px' }}
            />
          </div>
          <button
            onClick={joinRoom}
            disabled={connectionState !== 'connected'}
            style={{
              padding: '10px 20px',
              backgroundColor: connectionState === 'connected' ? '#4CAF50' : '#ccc',
              color: 'white',
              border: 'none',
              cursor: connectionState === 'connected' ? 'pointer' : 'not-allowed',
            }}
          >
            ルームに参加
          </button>
        </div>
      ) : (
        /* ビデオ通話画面 */
        <div className="video-call-screen">
          <h2>ルーム: {roomId}</h2>
          
          {/* コントロールボタン */}
          <div style={{ marginBottom: '20px' }}>
            <button
              onClick={toggleAudio}
              style={{
                padding: '10px 15px',
                margin: '0 5px',
                backgroundColor: isAudioEnabled ? '#4CAF50' : '#f44336',
                color: 'white',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {isAudioEnabled ? '🎤 音声ON' : '🔇 音声OFF'}
            </button>
            <button
              onClick={toggleVideo}
              style={{
                padding: '10px 15px',
                margin: '0 5px',
                backgroundColor: isVideoEnabled ? '#4CAF50' : '#f44336',
                color: 'white',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {isVideoEnabled ? '📹 ビデオON' : '📷 ビデオOFF'}
            </button>
            <button
              onClick={leaveRoom}
              style={{
                padding: '10px 15px',
                margin: '0 5px',
                backgroundColor: '#f44336',
                color: 'white',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              🚪 退出
            </button>
          </div>

          {/* ビデオ表示エリア */}
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            {/* ローカルビデオ */}
            <div>
              <h3>あなた ({userName})</h3>
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                style={{
                  width: '320px',
                  height: '240px',
                  backgroundColor: '#000',
                  border: '2px solid #4CAF50',
                }}
              />
            </div>

            {/* リモートビデオ */}
            {Array.from(remoteStreams.entries()).map(([userId, stream]) => (
              <div key={userId}>
                <h3>リモートユーザー ({userId})</h3>
                <video
                  ref={(video) => {
                    if (video) {
                      video.srcObject = stream;
                      remoteVideoRefs.current.set(userId, video);
                    }
                  }}
                  autoPlay
                  playsInline
                  style={{
                    width: '320px',
                    height: '240px',
                    backgroundColor: '#000',
                    border: '2px solid #2196F3',
                  }}
                />
              </div>
            ))}
          </div>

          {/* 参加ユーザー一覧 */}
          <div style={{ marginTop: '20px' }}>
            <h3>参加ユーザー ({remoteUsers.length + 1}人)</h3>
            <ul>
              <li>{userName} (あなた)</li>
              {remoteUsers.map(user => (
                <li key={user.id}>ユーザー {user.name} ({user.id})</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}; 