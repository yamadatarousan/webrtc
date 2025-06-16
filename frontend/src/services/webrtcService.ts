import { socketService } from './socketService';
import type { 
  RTCOfferMessage, 
  RTCAnswerMessage, 
  RTCIceCandidateMessage
} from '../types/webrtcTypes';

// WebRTC設定
const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
  iceCandidatePoolSize: 10,
};

export class WebRTCService {
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private localStream: MediaStream | null = null;
  private remoteStreams: Map<string, MediaStream> = new Map();
  private listeners: Map<string, Function[]> = new Map();
  private isSocketListenersSetup: boolean = false;

  constructor() {
    // Socket.ioの初期化を待ってからsetupSocketListenersを呼ぶため、
    // ここでは呼ばない
  }

  /**
   * Socket.ioのイベントリスナーを初期化する
   * Socket.ioが接続された後に呼び出される必要がある
   */
  public initializeSocketListeners(): void {
    if (this.isSocketListenersSetup) {
      console.log('📡 Socket.ioリスナーは既に設定済み');
      return;
    }
    
    console.log('📡 Socket.ioリスナーを設定中...');
    this.setupSocketListeners();
    this.isSocketListenersSetup = true;
    console.log('✅ Socket.ioリスナー設定完了');
  }

  // Socket.ioのイベントリスナーを設定
  private setupSocketListeners(): void {
    // WebRTCシグナリングメッセージを受信
    socketService.on('offer', (data: RTCOfferMessage) => {
      this.handleOffer(data);
    });

    socketService.on('answer', (data: RTCAnswerMessage) => {
      this.handleAnswer(data);
    });

    socketService.on('ice-candidate', (data: RTCIceCandidateMessage) => {
      this.handleIceCandidate(data);
    });

    // ユーザー退出イベントのみ監視（接続開始はVideoCallコンポーネントで制御）
    socketService.on('user-left', (userId: string) => {
      console.log('🔗 ユーザーが退出、WebRTC接続を終了:', userId);
      this.closePeerConnection(userId);
    });
  }

  // ローカルストリームを設定
  setLocalStream(stream: MediaStream): void {
    this.localStream = stream;
    console.log('🎥 ローカルストリームを設定:', stream.getTracks().length, 'tracks');
  }

  // 通話を開始（Offerを送信）
  async initiateCall(targetUserId: string): Promise<void> {
    if (!this.localStream) {
      console.error('❌ ローカルストリームがありません');
      return;
    }

    try {
      // 既存の接続があるかチェック
      if (this.peerConnections.has(targetUserId)) {
        const existingConnection = this.peerConnections.get(targetUserId);
        console.log('🔍 既存接続の状態:', {
          targetUserId,
          signalingState: existingConnection?.signalingState,
          iceConnectionState: existingConnection?.iceConnectionState,
          connectionState: existingConnection?.connectionState
        });

        // 既存接続が安定している場合は新しい通話を開始しない
        if (existingConnection?.connectionState === 'connected' || 
            existingConnection?.iceConnectionState === 'connected') {
          console.warn('⚠️ 通話開始無視 - 既存接続が安定:', targetUserId);
          return;
        }

        // 既存接続をクリーンアップ
        console.log('🧹 既存接続をクリーンアップ:', targetUserId);
        this.closePeerConnection(targetUserId);
      }

      // RTCPeerConnectionを作成
      const peerConnection = this.createPeerConnection(targetUserId);
      this.peerConnections.set(targetUserId, peerConnection);

      // ローカルストリームをピア接続に追加
      console.log('📤 ローカルストリームをピア接続に追加:', {
        targetUserId,
        tracksCount: this.localStream.getTracks().length,
        videoTracks: this.localStream.getVideoTracks().length,
        audioTracks: this.localStream.getAudioTracks().length
      });
      
      this.localStream.getTracks().forEach((track, index) => {
        console.log(`📤 トラック ${index} を追加:`, {
          kind: track.kind,
          id: track.id,
          enabled: track.enabled,
          readyState: track.readyState
        });
        peerConnection.addTrack(track, this.localStream!);
      });

      // Offerを作成
      const offer = await peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });

      await peerConnection.setLocalDescription(offer);

      // Offerをシグナリングサーバー経由で送信
      socketService.sendMessage('offer', {
        type: 'offer',
        data: offer,
        toUserId: targetUserId,
        fromUserId: socketService.getCurrentUserId(),
      });

      console.log('📤 Offerを送信:', targetUserId);
    } catch (error) {
      console.error('❌ 通話開始エラー:', error);
    }
  }

  // RTCPeerConnectionを作成
  private createPeerConnection(userId: string): RTCPeerConnection {
    const peerConnection = new RTCPeerConnection(RTC_CONFIG);

    // ICE候補が生成されたとき
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socketService.sendMessage('ice-candidate', {
          type: 'ice-candidate',
          data: event.candidate,
          toUserId: userId,
          fromUserId: socketService.getCurrentUserId(),
        });
        console.log('📤 ICE候補を送信:', userId);
      }
    };

    // リモートストリームを受信したとき
    peerConnection.ontrack = (event) => {
      console.log('📥 リモートストリームを受信:', userId, event.streams[0]);
      console.log('📥 受信トラック詳細:', {
        trackKind: event.track.kind,
        trackId: event.track.id,
        streamCount: event.streams.length,
        streamId: event.streams[0]?.id
      });
      
      const remoteStream = event.streams[0];
      if (remoteStream) {
        this.remoteStreams.set(userId, remoteStream);
        this.emit('remote-stream', { userId, stream: remoteStream });
        console.log('📥 リモートストリームイベント送信完了:', userId);
      } else {
        console.warn('⚠️ リモートストリームが undefined:', userId);
      }
    };

    // 接続状態の変更
    peerConnection.onconnectionstatechange = () => {
      console.log('🔗 接続状態変更:', userId, peerConnection.connectionState);
      if (peerConnection.connectionState === 'connected') {
        console.log('✅ WebRTC接続成功:', userId);
      } else if (peerConnection.connectionState === 'failed') {
        console.log('❌ WebRTC接続失敗:', userId);
        this.closePeerConnection(userId);
      }
    };

    // ICE接続状態の変更
    peerConnection.oniceconnectionstatechange = () => {
      console.log('🧊 ICE接続状態:', userId, peerConnection.iceConnectionState);
    };

    return peerConnection;
  }

  // Offerを受信したときの処理
  private async handleOffer(data: RTCOfferMessage): Promise<void> {
    const { fromUserId, data: offer } = data;
    console.log('📥 Offerを受信:', fromUserId);

    try {
      // 既存の接続があるかチェック
      if (this.peerConnections.has(fromUserId!)) {
        const existingConnection = this.peerConnections.get(fromUserId!);
        console.log('🔍 既存接続の状態:', {
          signalingState: existingConnection?.signalingState,
          iceConnectionState: existingConnection?.iceConnectionState,
          connectionState: existingConnection?.connectionState
        });

        // 既存接続が安定している場合は新しいOfferを無視
        if (existingConnection?.connectionState === 'connected' || 
            existingConnection?.iceConnectionState === 'connected') {
          console.warn('⚠️ Offer無視 - 既存接続が安定:', fromUserId);
          return;
        }

        // 既存接続をクリーンアップ
        console.log('🧹 既存接続をクリーンアップ:', fromUserId);
        this.closePeerConnection(fromUserId!);
      }

      // RTCPeerConnectionを作成
      const peerConnection = this.createPeerConnection(fromUserId!);
      this.peerConnections.set(fromUserId!, peerConnection);

      // ローカルストリームの準備を待機
      if (!this.localStream) {
        console.warn('⚠️ Offer処理時にローカルストリームが未設定:', fromUserId);
        console.log('⏱️ ローカルストリーム設定を待機します...');
        
        // ローカルストリームが設定されるまで待機
        const maxWaitTime = 10000; // 10秒
        const checkInterval = 100; // 100ms
        let waitTime = 0;
        
        const waitForLocalStream = () => {
          return new Promise<void>((resolve, reject) => {
            const checkLocalStream = () => {
              if (this.localStream) {
                console.log('✅ ローカルストリーム準備完了、Offer処理を続行:', fromUserId);
                resolve();
              } else if (waitTime >= maxWaitTime) {
                console.error('❌ ローカルストリーム取得タイムアウト:', fromUserId);
                reject(new Error('Local stream timeout'));
              } else {
                waitTime += checkInterval;
                setTimeout(checkLocalStream, checkInterval);
              }
            };
            checkLocalStream();
          });
        };
        
        try {
          await waitForLocalStream();
        } catch (error) {
          console.error('❌ Offer処理中断 - ローカルストリーム未取得:', fromUserId, error);
          return;
        }
      }

      // ローカルストリームをピア接続に追加
      console.log('📤 Offer処理時にローカルストリームをピア接続に追加:', {
        fromUserId,
        tracksCount: this.localStream!.getTracks().length,
        videoTracks: this.localStream!.getVideoTracks().length,
        audioTracks: this.localStream!.getAudioTracks().length
      });
      
      this.localStream!.getTracks().forEach((track, index) => {
        console.log(`📤 Offer処理 - トラック ${index} を追加:`, {
          kind: track.kind,
          id: track.id,
          enabled: track.enabled,
          readyState: track.readyState
        });
        peerConnection.addTrack(track, this.localStream!);
      });

      // リモートのOfferを設定
      await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

      // Answerを作成
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      // Answerをシグナリングサーバー経由で送信
      socketService.sendMessage('answer', {
        type: 'answer',
        data: answer,
        toUserId: fromUserId,
        fromUserId: socketService.getCurrentUserId(),
      });

      console.log('📤 Answerを送信:', fromUserId);
    } catch (error) {
      console.error('❌ Offer処理エラー:', error);
    }
  }

  // Answerを受信したときの処理
  private async handleAnswer(data: RTCAnswerMessage): Promise<void> {
    const { fromUserId, data: answer } = data;
    console.log('📥 Answerを受信:', fromUserId);

    try {
      const peerConnection = this.peerConnections.get(fromUserId!);
      if (peerConnection) {
        // RTCPeerConnectionの状態をチェック
        console.log('🔍 RTCPeerConnection状態:', {
          signalingState: peerConnection.signalingState,
          iceConnectionState: peerConnection.iceConnectionState,
          connectionState: peerConnection.connectionState
        });

        // signalingStateが適切な状態の場合のみAnswerを設定
        if (peerConnection.signalingState === 'have-local-offer') {
          await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
          console.log('✅ Answer処理完了:', fromUserId);
        } else {
          console.warn('⚠️ Answer無視 - 不適切な状態:', {
            fromUserId,
            signalingState: peerConnection.signalingState,
            expected: 'have-local-offer'
          });
        }
      } else {
        console.warn('⚠️ Answer無視 - ピア接続が見つかりません:', fromUserId);
      }
    } catch (error) {
      console.error('❌ Answer処理エラー:', error);
    }
  }

  // ICE候補を受信したときの処理
  private async handleIceCandidate(data: RTCIceCandidateMessage): Promise<void> {
    const { fromUserId, data: candidate } = data;
    console.log('📥 ICE候補を受信:', fromUserId);

    try {
      const peerConnection = this.peerConnections.get(fromUserId!);
      if (peerConnection) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        console.log('✅ ICE候補追加完了:', fromUserId);
      }
    } catch (error) {
      console.error('❌ ICE候補処理エラー:', error);
    }
  }

  // ピア接続を終了
  private closePeerConnection(userId: string): void {
    const peerConnection = this.peerConnections.get(userId);
    if (peerConnection) {
      peerConnection.close();
      this.peerConnections.delete(userId);
    }

    // リモートストリームを削除
    if (this.remoteStreams.has(userId)) {
      this.remoteStreams.delete(userId);
      this.emit('remote-stream-removed', { userId });
    }

    console.log('🔗 ピア接続を終了:', userId);
  }

  // 全ての接続を終了
  closeAllConnections(): void {
    this.peerConnections.forEach((peerConnection) => {
      peerConnection.close();
    });
    this.peerConnections.clear();
    this.remoteStreams.clear();
    console.log('🔗 全てのピア接続を終了');
  }

  // リモートストリームを取得
  getRemoteStream(userId: string): MediaStream | undefined {
    return this.remoteStreams.get(userId);
  }

  // 全てのリモートストリームを取得
  getAllRemoteStreams(): Map<string, MediaStream> {
    return new Map(this.remoteStreams);
  }

  // イベントリスナーを追加
  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  // イベントリスナーを削除
  off(event: string, callback: Function): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      const index = eventListeners.indexOf(callback);
      if (index > -1) {
        eventListeners.splice(index, 1);
      }
    }
  }

  // イベントを発火
  private emit(event: string, data?: any): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(callback => callback(data));
    }
  }
}

// シングルトンインスタンスをエクスポート
export const webrtcService = new WebRTCService(); 