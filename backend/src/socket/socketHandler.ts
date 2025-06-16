import { Server, Socket } from 'socket.io';
import { 
  SignalingMessage, 
  User, 
  Room, 
  JoinRoomRequest, 
  JoinRoomResponse,
  WebRTCError,
  SOCKET_EVENTS 
} from '../types/webrtcTypes';

// 接続中のユーザーを管理
const connectedUsers = new Map<string, User>();

// 作成されたルームを管理
const rooms = new Map<string, Room>();

// Socket.ioのタイプセーフなラッパー
interface TypedSocket extends Socket {
  userId?: string;
  roomId?: string;
}

export class SocketHandler {
  private io: Server;

  constructor(io: Server) {
    this.io = io;
    this.setupSocketHandlers();
  }

  private setupSocketHandlers(): void {
    this.io.on('connection', (socket: TypedSocket) => {
      console.log(`ユーザーが接続しました: ${socket.id}`);

      // ルーム参加の処理
      socket.on(SOCKET_EVENTS.JOIN_ROOM, (request: JoinRoomRequest) => {
        this.handleJoinRoom(socket, request);
      });

      // ルーム退出の処理
      socket.on(SOCKET_EVENTS.LEAVE_ROOM, () => {
        this.handleLeaveRoom(socket);
      });

      // WebRTCシグナリング: Offer
      socket.on(SOCKET_EVENTS.OFFER, (message: SignalingMessage) => {
        this.handleOffer(socket, message);
      });

      // WebRTCシグナリング: Answer
      socket.on(SOCKET_EVENTS.ANSWER, (message: SignalingMessage) => {
        this.handleAnswer(socket, message);
      });

      // WebRTCシグナリング: ICE Candidate
      socket.on(SOCKET_EVENTS.ICE_CANDIDATE, (message: SignalingMessage) => {
        this.handleIceCandidate(socket, message);
      });

      // 切断処理
      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });
    });
  }

  private handleJoinRoom(socket: TypedSocket, request: JoinRoomRequest): void {
    try {
      const { roomId, userId, userName } = request;

      // 既に他のルームに参加している場合は退出
      if (socket.roomId) {
        this.handleLeaveRoom(socket);
      }

      // ルームが存在しない場合は作成
      if (!rooms.has(roomId)) {
        const newRoom: Room = {
          id: roomId,
          name: `Room ${roomId}`,
          users: [],
          maxUsers: 10, // 最大10人
          createdAt: new Date(),
        };
        rooms.set(roomId, newRoom);
      }

      const room = rooms.get(roomId)!;

      // ルームが満員の場合
      if (room.users.length >= room.maxUsers) {
        const error: WebRTCError = {
          code: 'ROOM_FULL',
          message: 'ルームが満員です',
        };
        socket.emit(SOCKET_EVENTS.ROOM_FULL, { error });
        return;
      }

      // ユーザーを作成・登録
      const user: User = {
        id: userId,
        name: userName,
        isAudioEnabled: true,
        isVideoEnabled: true,
        joinedAt: new Date(),
      };

      // Socket.ioルームに参加
      socket.join(roomId);
      socket.userId = userId;
      socket.roomId = roomId;

      // メモリ上のデータを更新
      connectedUsers.set(socket.id, user);
      room.users.push(user);

      // 参加成功をクライアントに通知
      const response: JoinRoomResponse = {
        success: true,
        room: room,
      };
      socket.emit(SOCKET_EVENTS.ROOM_JOINED, response);

      // 他のユーザーに新しいユーザーの参加を通知
      socket.to(roomId).emit(SOCKET_EVENTS.USER_JOINED, { user });

      console.log(`ユーザー ${userName} がルーム ${roomId} に参加しました`);
    } catch (error) {
      console.error('ルーム参加エラー:', error);
      const webrtcError: WebRTCError = {
        code: 'JOIN_ROOM_ERROR',
        message: 'ルーム参加に失敗しました',
        details: error,
      };
      socket.emit(SOCKET_EVENTS.ERROR, { error: webrtcError });
    }
  }

  private handleLeaveRoom(socket: TypedSocket): void {
    try {
      if (!socket.roomId || !socket.userId) {
        return;
      }

      const roomId = socket.roomId;
      const userId = socket.userId;

      // Socket.ioルームから退出
      socket.leave(roomId);

      // メモリ上のデータを更新
      connectedUsers.delete(socket.id);
      
      const room = rooms.get(roomId);
      if (room) {
        room.users = room.users.filter(user => user.id !== userId);
        
        // ルームが空になった場合は削除
        if (room.users.length === 0) {
          rooms.delete(roomId);
          console.log(`ルーム ${roomId} が削除されました`);
        } else {
          // 他のユーザーに退出を通知
          socket.to(roomId).emit(SOCKET_EVENTS.USER_LEFT, { userId });
        }
      }

      // クライアントに退出完了を通知
      socket.emit(SOCKET_EVENTS.ROOM_LEFT, { roomId });

      // Socket情報をクリア
      delete socket.userId;
      delete socket.roomId;

      console.log(`ユーザー ${userId} がルーム ${roomId} から退出しました`);
    } catch (error) {
      console.error('ルーム退出エラー:', error);
      const webrtcError: WebRTCError = {
        code: 'LEAVE_ROOM_ERROR',
        message: 'ルーム退出に失敗しました',
        details: error,
      };
      socket.emit(SOCKET_EVENTS.ERROR, { error: webrtcError });
    }
  }

  private handleOffer(socket: TypedSocket, message: SignalingMessage): void {
    try {
      if (!socket.roomId) {
        throw new Error('ルームに参加していません');
      }

      // 指定されたユーザーまたは同じルームの他のユーザーにOfferを転送
      if (message.to) {
        socket.to(message.to).emit(SOCKET_EVENTS.OFFER, {
          ...message,
          from: socket.userId,
        });
      } else {
        socket.to(socket.roomId).emit(SOCKET_EVENTS.OFFER, {
          ...message,
          from: socket.userId,
        });
      }

      console.log(`Offer送信: ${socket.userId} -> ${message.to || 'ルーム内全員'}`);
    } catch (error) {
      console.error('Offer処理エラー:', error);
      const webrtcError: WebRTCError = {
        code: 'OFFER_ERROR',
        message: 'Offerの処理に失敗しました',
        details: error,
      };
      socket.emit(SOCKET_EVENTS.ERROR, { error: webrtcError });
    }
  }

  private handleAnswer(socket: TypedSocket, message: SignalingMessage): void {
    try {
      if (!socket.roomId) {
        throw new Error('ルームに参加していません');
      }

      // 指定されたユーザーにAnswerを転送
      if (message.to) {
        socket.to(message.to).emit(SOCKET_EVENTS.ANSWER, {
          ...message,
          from: socket.userId,
        });
      }

      console.log(`Answer送信: ${socket.userId} -> ${message.to}`);
    } catch (error) {
      console.error('Answer処理エラー:', error);
      const webrtcError: WebRTCError = {
        code: 'ANSWER_ERROR',
        message: 'Answerの処理に失敗しました',
        details: error,
      };
      socket.emit(SOCKET_EVENTS.ERROR, { error: webrtcError });
    }
  }

  private handleIceCandidate(socket: TypedSocket, message: SignalingMessage): void {
    try {
      if (!socket.roomId) {
        throw new Error('ルームに参加していません');
      }

      // 指定されたユーザーまたは同じルームの他のユーザーにICE candidateを転送
      if (message.to) {
        socket.to(message.to).emit(SOCKET_EVENTS.ICE_CANDIDATE, {
          ...message,
          from: socket.userId,
        });
      } else {
        socket.to(socket.roomId).emit(SOCKET_EVENTS.ICE_CANDIDATE, {
          ...message,
          from: socket.userId,
        });
      }

      console.log(`ICE Candidate送信: ${socket.userId} -> ${message.to || 'ルーム内全員'}`);
    } catch (error) {
      console.error('ICE Candidate処理エラー:', error);
      const webrtcError: WebRTCError = {
        code: 'ICE_CANDIDATE_ERROR',
        message: 'ICE Candidateの処理に失敗しました',
        details: error,
      };
      socket.emit(SOCKET_EVENTS.ERROR, { error: webrtcError });
    }
  }

  private handleDisconnect(socket: TypedSocket): void {
    console.log(`ユーザーが切断しました: ${socket.id}`);
    
    // ルームから退出処理
    this.handleLeaveRoom(socket);
  }

  // ルーム情報を取得するAPI（デバッグ用）
  public getRooms(): Room[] {
    return Array.from(rooms.values());
  }

  // 接続中のユーザー情報を取得するAPI（デバッグ用）
  public getConnectedUsers(): User[] {
    return Array.from(connectedUsers.values());
  }
} 