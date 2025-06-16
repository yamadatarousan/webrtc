export type SignalingMessageType = 'offer' | 'answer' | 'ice-candidate' | 'join-room' | 'leave-room' | 'user-joined' | 'user-left' | 'room-full' | 'error';
export interface SignalingMessage {
    type: SignalingMessageType;
    data?: any;
    from?: string;
    to?: string;
    roomId?: string;
    timestamp?: number;
}
export interface RTCOfferMessage extends SignalingMessage {
    type: 'offer';
    data: RTCSessionDescriptionInit;
}
export interface RTCAnswerMessage extends SignalingMessage {
    type: 'answer';
    data: RTCSessionDescriptionInit;
}
export interface RTCIceCandidateMessage extends SignalingMessage {
    type: 'ice-candidate';
    data: RTCIceCandidateInit;
}
export interface User {
    id: string;
    name: string;
    isAudioEnabled: boolean;
    isVideoEnabled: boolean;
    joinedAt: Date;
}
export interface Room {
    id: string;
    name: string;
    users: User[];
    maxUsers: number;
    createdAt: Date;
}
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'failed';
export type WebRTCConnectionState = 'new' | 'connecting' | 'connected' | 'disconnected' | 'failed' | 'closed';
export interface MediaStreamConfig {
    video: boolean | MediaTrackConstraints;
    audio: boolean | MediaTrackConstraints;
}
export interface WebRTCError {
    code: string;
    message: string;
    details?: any;
}
export interface JoinRoomRequest {
    roomId: string;
    userId: string;
    userName: string;
}
export interface JoinRoomResponse {
    success: boolean;
    room?: Room;
    error?: WebRTCError;
}
export declare const SOCKET_EVENTS: {
    readonly CONNECT: "connect";
    readonly DISCONNECT: "disconnect";
    readonly JOIN_ROOM: "join-room";
    readonly LEAVE_ROOM: "leave-room";
    readonly ROOM_JOINED: "room-joined";
    readonly ROOM_LEFT: "room-left";
    readonly USER_JOINED: "user-joined";
    readonly USER_LEFT: "user-left";
    readonly ROOM_FULL: "room-full";
    readonly OFFER: "offer";
    readonly ANSWER: "answer";
    readonly ICE_CANDIDATE: "ice-candidate";
    readonly ERROR: "error";
};
export interface ICEServerConfig {
    urls: string | string[];
    username?: string;
    credential?: string;
}
export interface WebRTCConfig {
    iceServers: ICEServerConfig[];
    iceCandidatePoolSize?: number;
}
export declare const DEFAULT_WEBRTC_CONFIG: WebRTCConfig;
export declare const DEFAULT_MEDIA_CONSTRAINTS: MediaStreamConfig;
//# sourceMappingURL=types.d.ts.map