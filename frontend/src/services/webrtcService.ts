import { socketService } from './socketService';

// 型定義をローカルで定義（webrtcTypes.tsが見つからない問題を回避）
interface RTCOfferMessage {
  type: 'offer';
  data: RTCSessionDescriptionInit;
  fromUserId: string;
  toUserId: string;
}

interface RTCAnswerMessage {
  type: 'answer';
  data: RTCSessionDescriptionInit;
  fromUserId: string;
  toUserId: string;
}

interface RTCIceCandidateMessage {
  type: 'ice-candidate';
  data: RTCIceCandidateInit;
  fromUserId: string;
  toUserId: string;
}

// WebRTC設定
const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
  iceCandidatePoolSize: 10,
};

/**
 * WebRTCビデオ通話の接続管理を担当するサービスクラス。
 * 
 * このクラスは以下の主要な機能を提供します：
 * 1. WebRTCピア接続の確立と管理
 * 2. メディアストリーム（音声・映像）の送受信
 * 3. シグナリングメッセージ（offer/answer/ICE候補）の処理
 * 4. 接続状態の監視とエラーハンドリング
 * 
 * 主な処理フロー：
 * - 通話開始時：initiateCall()でOfferを生成・送信
 * - 通話受信時：handleOffer()でAnswerを生成・送信
 * - 接続確立時：ICE候補の交換と接続状態の監視
 * - 通話終了時：closePeerConnection()でリソースを解放
 * 
 * シングルトンパターンを採用しており、アプリケーション全体で1つのインスタンスを共有します。
 * 
 * @class WebRTCService
 * @since 1.0.0
 */
export class WebRTCService {
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private localStream: MediaStream | null = null;
  private remoteStreams: Map<string, MediaStream> = new Map();
  private listeners: Map<string, Array<(...args: unknown[]) => void>> = new Map();
  private isSocketListenersSetup: boolean = false;
  // レースコンディション対策用のロック機構
  private connectionOperations: Map<string, Promise<void>> = new Map();

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
      throw new Error('ローカルストリームが設定されていないため、通話を開始できません');
    }

    // ローカルストリームの有効性をチェック
    const videoTracks = this.localStream.getVideoTracks();
    const audioTracks = this.localStream.getAudioTracks();
    
    if (videoTracks.length === 0 && audioTracks.length === 0) {
      console.error('❌ ローカルストリームにトラックがありません');
      throw new Error('ローカルストリームにメディアトラックがありません');
    }

    console.log('📹 通話開始 - ローカルストリーム確認:', {
      streamId: this.localStream.id,
      videoTracks: videoTracks.length,
      audioTracks: audioTracks.length,
      activeVideoTracks: videoTracks.filter(t => t.readyState === 'live').length,
      activeAudioTracks: audioTracks.filter(t => t.readyState === 'live').length
    });

    // レースコンディション対策：既に接続処理中の場合は待機
    if (this.connectionOperations.has(targetUserId)) {
      console.log('⏳ 接続処理中のため待機:', targetUserId);
      await this.connectionOperations.get(targetUserId);
      return;
    }

    // 接続処理を開始
    const connectionPromise = this.performInitiateCall(targetUserId);
    this.connectionOperations.set(targetUserId, connectionPromise);

    try {
      await connectionPromise;
    } finally {
      this.connectionOperations.delete(targetUserId);
    }
  }

  // 実際の接続処理（レースコンディション対策後）
  private async performInitiateCall(targetUserId: string): Promise<void> {
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

        // 既存接続をクリーンアップ（非同期で少し待機）
        console.log('🧹 既存接続をクリーンアップ:', targetUserId);
        this.closePeerConnection(targetUserId);
        // クリーンアップ後に少し待機
        await new Promise(resolve => setTimeout(resolve, 100));
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

      // 現在のユーザーIDを取得（nullチェック）
      const currentUserId = socketService.getCurrentUserId();
      if (!currentUserId) {
        console.error('❌ 現在のユーザーIDが設定されていません');
        throw new Error('ユーザーIDが未設定のため、Offerを送信できません');
      }

      // Offerをシグナリングサーバー経由で送信
      socketService.sendMessage('offer', {
        type: 'offer',
        data: offer,
        toUserId: targetUserId,
        fromUserId: currentUserId,
      });

      console.log('📤 Offerを送信:', targetUserId);
    } catch (error) {
      console.error('❌ 通話開始エラー:', error);
      this.emit('webrtc-error', { 
        type: 'offer-creation-failed', 
        userId: targetUserId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error; // エラーを再スローして呼び出し元に伝播
    }
  }

  // RTCPeerConnectionを作成
  private createPeerConnection(userId: string): RTCPeerConnection {
    const peerConnection = new RTCPeerConnection(RTC_CONFIG);

    // ICE候補が生成されたとき
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        const currentUserId = socketService.getCurrentUserId();
        if (!currentUserId) {
          console.error('❌ ICE候補送信時にユーザーIDがありません');
          return;
        }
        socketService.sendMessage('ice-candidate', {
          type: 'ice-candidate',
          data: event.candidate,
          toUserId: userId,
          fromUserId: currentUserId,
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
      
      switch (peerConnection.connectionState) {
        case 'connected':
          console.log('✅ WebRTC接続成功:', userId);
          this.emit('connection-established', { userId });
          break;
        case 'failed':
        case 'disconnected':
          console.log('❌ WebRTC接続問題:', userId, peerConnection.connectionState);
          this.emit('connection-failed', { userId, state: peerConnection.connectionState });
          if (peerConnection.connectionState === 'failed') {
            this.closePeerConnection(userId);
          }
          break;
        case 'connecting':
          this.emit('connection-attempting', { userId });
          break;
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

    // レースコンディション対策：既に接続処理中の場合は待機
    if (this.connectionOperations.has(fromUserId!)) {
      console.log('⏳ 接続処理中のため待機:', fromUserId);
      await this.connectionOperations.get(fromUserId!);
    }

    // 接続処理を開始
    const connectionPromise = this.performHandleOffer(fromUserId!, offer);
    this.connectionOperations.set(fromUserId!, connectionPromise);

    try {
      await connectionPromise;
    } finally {
      this.connectionOperations.delete(fromUserId!);
    }
  }

  // 実際のOffer処理（レースコンディション対策後）
  private async performHandleOffer(fromUserId: string, offer: RTCSessionDescriptionInit): Promise<void> {
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

        // 既存接続をクリーンアップ（非同期で少し待機）
        console.log('🧹 既存接続をクリーンアップ:', fromUserId);
        this.closePeerConnection(fromUserId!);
        // クリーンアップ後に少し待機
        await new Promise(resolve => setTimeout(resolve, 100));
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
      
      // 接続状態をチェックしてからトラックを追加
      if (peerConnection.connectionState === 'closed') {
        console.error('❌ Offer処理中断 - ピア接続が閉じられています:', fromUserId);
        return;
      }
      
      this.localStream!.getTracks().forEach((track, index) => {
        console.log(`📤 Offer処理 - トラック ${index} を追加:`, {
          kind: track.kind,
          id: track.id,
          enabled: track.enabled,
          readyState: track.readyState
        });
        
        try {
          // トラック追加前に再度接続状態をチェック
          if (peerConnection.connectionState !== 'closed') {
            peerConnection.addTrack(track, this.localStream!);
          } else {
            console.warn('⚠️ トラック追加スキップ - 接続が閉じられています:', { fromUserId, trackIndex: index });
          }
        } catch (error) {
          console.error('❌ トラック追加エラー:', { fromUserId, trackIndex: index, error });
        }
      });

      // リモートのOfferを設定
      await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

      // Answerを作成
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      // 現在のユーザーIDを取得（nullチェック）
      const currentUserId = socketService.getCurrentUserId();
      if (!currentUserId) {
        console.error('❌ 現在のユーザーIDが設定されていません');
        throw new Error('ユーザーIDが未設定のため、Answerを送信できません');
      }

      // Answerをシグナリングサーバー経由で送信
      socketService.sendMessage('answer', {
        type: 'answer',
        data: answer,
        toUserId: fromUserId,
        fromUserId: currentUserId,
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
      if (!peerConnection) {
        console.warn('⚠️ Answer無視 - ピア接続が見つかりません:', fromUserId);
        return;
      }

      // 接続状態をチェック
      if (peerConnection.connectionState === 'closed') {
        console.warn('⚠️ Answer無視 - 接続が閉じられています:', fromUserId);
        return;
      }

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
    } catch (error) {
      console.error('❌ Answer処理エラー:', error);
      console.error('🔍 Answer処理エラー詳細:', {
        fromUserId,
        peerConnectionState: this.peerConnections.get(fromUserId!)?.connectionState,
        signalingState: this.peerConnections.get(fromUserId!)?.signalingState
      });
    }
  }

  // ICE候補を受信したときの処理
  private async handleIceCandidate(data: RTCIceCandidateMessage): Promise<void> {
    const { fromUserId, data: candidate } = data;
    console.log('📥 ICE候補を受信:', fromUserId);

    try {
      const peerConnection = this.peerConnections.get(fromUserId!);
      if (!peerConnection) {
        console.warn('⚠️ ICE候補無視 - ピア接続が見つかりません:', fromUserId);
        return;
      }

      // 接続状態をチェック
      if (peerConnection.connectionState === 'closed') {
        console.warn('⚠️ ICE候補無視 - 接続が閉じられています:', fromUserId);
        return;
      }

      // リモート記述が設定されているかチェック
      if (!peerConnection.remoteDescription) {
        console.warn('⚠️ ICE候補無視 - リモート記述が設定されていません:', fromUserId);
        return;
      }

      // ICE候補が有効かチェック
      if (!candidate || !candidate.candidate) {
        console.warn('⚠️ ICE候補無視 - 無効な候補:', { fromUserId, candidate });
        return;
      }

      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      console.log('✅ ICE候補追加完了:', fromUserId);
    } catch (error) {
      console.error('❌ ICE候補処理エラー:', error);
      console.error('🔍 エラー詳細:', {
        fromUserId,
        candidate,
        peerConnectionState: this.peerConnections.get(fromUserId!)?.connectionState,
        signalingState: this.peerConnections.get(fromUserId!)?.signalingState,
        remoteDescriptionExists: !!this.peerConnections.get(fromUserId!)?.remoteDescription
      });
    }
  }

  // ピア接続を終了
  private closePeerConnection(userId: string): void {
    const peerConnection = this.peerConnections.get(userId);
    if (peerConnection) {
      // Sendersのトラックを停止
      peerConnection.getSenders().forEach(sender => {
        if (sender.track) {
          sender.track.stop();
        }
      });
      
      // Receiversのトラックも停止
      peerConnection.getReceivers().forEach(receiver => {
        if (receiver.track) {
          receiver.track.stop();
        }
      });
      
      peerConnection.close();
      this.peerConnections.delete(userId);
    }

    // リモートストリームを適切にクリーンアップ
    const remoteStream = this.remoteStreams.get(userId);
    if (remoteStream) {
      // ストリーム内の全トラックを停止
      remoteStream.getTracks().forEach(track => {
        track.stop();
      });
      this.remoteStreams.delete(userId);
      this.emit('remote-stream-removed', { userId });
    }

    console.log('🔗 ピア接続を終了（メモリリーク対策完了）:', userId);
  }

  // 全ての接続を終了
  closeAllConnections(): void {
    // 各ピア接続のトラックを適切に停止
    this.peerConnections.forEach((peerConnection) => {
      // Sendersのトラックを停止
      peerConnection.getSenders().forEach(sender => {
        if (sender.track) {
          sender.track.stop();
        }
      });
      
      // Receiversのトラックも停止
      peerConnection.getReceivers().forEach(receiver => {
        if (receiver.track) {
          receiver.track.stop();
        }
      });
      
      peerConnection.close();
    });
    
    // 全てのリモートストリームのトラックを停止
    this.remoteStreams.forEach((stream) => {
      stream.getTracks().forEach(track => {
        track.stop();
      });
    });
    
    this.peerConnections.clear();
    this.remoteStreams.clear();
    console.log('🔗 全てのピア接続を終了（メモリリーク対策完了）');
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
  on(event: string, callback: (...args: unknown[]) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  // イベントリスナーを削除
  off(event: string, callback: (...args: unknown[]) => void): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      const index = eventListeners.indexOf(callback);
      if (index > -1) {
        eventListeners.splice(index, 1);
      }
    }
  }

  // イベントを発火
  private emit(event: string, data?: unknown): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(callback => callback(data));
    }
  }
}

// シングルトンインスタンスをエクスポート
export const webrtcService = new WebRTCService(); 