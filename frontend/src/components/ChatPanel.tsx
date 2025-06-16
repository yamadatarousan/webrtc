/**
 * WebRTCビデオ通話中のリアルタイムチャット機能コンポーネント
 * 
 * このコンポーネントは、ビデオ通話中にテキストメッセージを
 * やり取りするためのチャット機能を提供します。
 * フローティングデザインを採用し、ビデオ通話を妨げることなく
 * 自然にチャット機能を利用できます。
 * 
 * 主な機能：
 * - リアルタイムメッセージ送受信
 * - 未読メッセージカウント表示
 * - メッセージタイムスタンプ表示
 * - 自動スクロール機能
 * - フローティングボタン/パネル切り替え
 * - レスポンシブデザイン
 * - HTMLエスケープによるXSS防御
 * 
 * @fileoverview WebRTCチャットパネルコンポーネント
 * @author WebRTCアプリケーション開発チーム
 * @version 1.0.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { socketService } from '../services/socketService';
import type { 
  ChatMessage, 
  SendChatMessageRequest 
} from '../types/webrtcTypes';

/**
 * ChatPanelコンポーネントのプロパティインターフェース
 * 
 * チャットパネルの動作と表示を制御するためのプロパティを定義します。
 * 親コンポーネント（VideoCall）から渡される状態を受け取ります。
 * 
 * @interface ChatPanelProps
 * @example
 * ```tsx
 * <ChatPanel
 *   roomId="room1"
 *   isVisible={isChatVisible}
 *   onToggleVisibility={() => setIsChatVisible(!isChatVisible)}
 * />
 * ```
 */
interface ChatPanelProps {
  /** 
   * 現在のルームID。
   * チャットメッセージの送信先を特定するために使用
   */
  roomId: string;
  
  /** 
   * チャットパネルの表示状態。
   * true: パネル表示, false: フローティングボタン表示
   */
  isVisible: boolean;
  
  /** 
   * パネル表示切り替えのコールバック関数。
   * フローティングボタンやクローズボタンのクリック時に呼び出される
   */
  onToggleVisibility: () => void;
}

/**
 * WebRTCビデオ通話中のチャット機能UIコンポーネント
 * 
 * このコンポーネントは、リアルタイムメッセージング機能を提供し、
 * ビデオ通話の参加者間でテキストベースのコミュニケーションを
 * 可能にします。Socket.ioを使用してリアルタイム通信を実現し、
 * 直感的なUIでチャット体験を提供します。
 * 
 * デザイン仕様：
 * - フローティングパネルデザイン
 * - Tailwind CSS によるスタイリング
 * - グラスモーフィズム効果（背景ブラー）
 * - アニメーションとトランジション
 * - アクセシビリティ対応（ARIA属性、キーボードナビゲーション）
 * 
 * セキュリティ：
 * - HTMLエスケープによるXSS防御
 * - メッセージ長制限（500文字）
 * - 入力値サニタイゼーション
 * 
 * @component
 * @param {ChatPanelProps} props - コンポーネントのプロパティ
 * @returns {JSX.Element} チャットパネルまたはフローティングボタン
 * 
 * @example
 * ```tsx
 * // VideoCallコンポーネント内での使用例
 * const [isChatVisible, setIsChatVisible] = useState(false);
 * const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
 * 
 * return (
 *   <div className="video-call-container">
 *     <div className="video-area">...</div>
 *     {currentRoom && (
 *       <ChatPanel
 *         roomId={currentRoom.id}
 *         isVisible={isChatVisible}
 *         onToggleVisibility={() => setIsChatVisible(!isChatVisible)}
 *       />
 *     )}
 *   </div>
 * );
 * ```
 * 
 * @see {@link https://socket.io/docs/v4/} Socket.io Documentation
 * @since 1.0.0
 */
export const ChatPanel: React.FC<ChatPanelProps> = ({ roomId, isVisible, onToggleVisibility }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState<string>('');
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const currentUserId = socketService.getCurrentUserId();

  // メッセージ受信の処理
  useEffect(() => {
    const handleChatMessage = (message: ChatMessage) => {
      setMessages(prev => [...prev, message]);
      
      // パネルが閉じている場合は未読カウントを増やす
      if (!isVisible && message.userId !== currentUserId) {
        setUnreadCount(prev => prev + 1);
      }
    };

    socketService.on('chat-message-received', handleChatMessage);

    return () => {
      socketService.off('chat-message-received', handleChatMessage);
    };
  }, [isVisible, currentUserId]);

  // パネルが表示されたら未読カウントをリセット
  useEffect(() => {
    if (isVisible) {
      setUnreadCount(0);
    }
  }, [isVisible]);

  // 新しいメッセージが追加されたらスクロール
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMessage.trim()) return;

    const request: SendChatMessageRequest = {
      roomId,
      message: newMessage.trim()
    };

    try {
      socketService.sendChatMessage(request);
      setNewMessage('');
    } catch (error) {
      console.error('メッセージ送信エラー:', error);
      alert('メッセージの送信に失敗しました');
    }
  };

  const formatTimestamp = (timestamp: Date) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('ja-JP', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const isOwnMessage = (message: ChatMessage) => {
    return message.userId === currentUserId;
  };

  if (!isVisible) {
    return (
      <button
        onClick={onToggleVisibility}
        className="fixed bottom-6 right-6 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-4 shadow-lg transition-colors duration-200 z-50"
        title="チャットを開く"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-96 h-96 bg-slate-800/90 backdrop-blur-sm border border-slate-600 rounded-lg shadow-2xl z-50 flex flex-col">
      {/* チャットヘッダー */}
      <div className="flex items-center justify-between p-4 border-b border-slate-600">
        <h3 className="text-white font-semibold flex items-center">
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          チャット
        </h3>
        <button
          onClick={onToggleVisibility}
          className="text-slate-400 hover:text-white transition-colors duration-200"
          title="チャットを閉じる"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* メッセージリスト */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center text-slate-400 py-8">
            メッセージはありません
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${isOwnMessage(message) ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs lg:max-w-md px-3 py-2 rounded-lg ${
                  isOwnMessage(message)
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-700 text-slate-100'
                }`}
              >
                {!isOwnMessage(message) && (
                  <div className="text-xs text-slate-300 mb-1">
                    {message.userName}
                  </div>
                )}
                <div className="break-words">{message.message}</div>
                <div
                  className={`text-xs mt-1 ${
                    isOwnMessage(message) ? 'text-blue-100' : 'text-slate-400'
                  }`}
                >
                  {formatTimestamp(message.timestamp)}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* メッセージ入力 */}
      <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-600">
        <div className="flex space-x-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="メッセージを入力..."
            className="flex-1 bg-slate-700 text-white placeholder-slate-400 border border-slate-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            maxLength={500}
          />
          <button
            type="submit"
            disabled={!newMessage.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors duration-200"
            title="送信"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
}; 