"use strict";
// WebRTCアプリケーション用の共通型定義
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_MEDIA_CONSTRAINTS = exports.DEFAULT_WEBRTC_CONFIG = exports.SOCKET_EVENTS = void 0;
// Socket.ioイベント名の定数
exports.SOCKET_EVENTS = {
    // 接続関連
    CONNECT: 'connect',
    DISCONNECT: 'disconnect',
    // ルーム関連
    JOIN_ROOM: 'join-room',
    LEAVE_ROOM: 'leave-room',
    ROOM_JOINED: 'room-joined',
    ROOM_LEFT: 'room-left',
    USER_JOINED: 'user-joined',
    USER_LEFT: 'user-left',
    ROOM_FULL: 'room-full',
    // WebRTCシグナリング
    OFFER: 'offer',
    ANSWER: 'answer',
    ICE_CANDIDATE: 'ice-candidate',
    // エラー
    ERROR: 'error',
};
// デフォルトのWebRTC設定
exports.DEFAULT_WEBRTC_CONFIG = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
    ],
    iceCandidatePoolSize: 10,
};
// メディアストリームのデフォルト設定
exports.DEFAULT_MEDIA_CONSTRAINTS = {
    video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 },
    },
    audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
    },
};
//# sourceMappingURL=types.js.map