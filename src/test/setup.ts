// Jest テストセットアップファイル

// 環境変数の設定
process.env.NODE_ENV = 'test';
process.env.PORT = '3002';
process.env.FRONTEND_URL = 'http://localhost:5173';

// テスト用のタイムアウト設定
jest.setTimeout(10000);

// グローバルモック設定
beforeEach(() => {
  // 各テスト前にコンソールをクリア
  jest.clearAllMocks();
});

afterEach(() => {
  // テスト後のクリーンアップ
});

// Socket.ioのモック
jest.mock('socket.io', () => ({
  Server: jest.fn(() => ({
    on: jest.fn(),
    emit: jest.fn(),
    to: jest.fn(() => ({
      emit: jest.fn(),
    })),
  })),
})); 