# WebRTC ビデオ通話アプリケーション

ReactフロントエンドとNode.jsバックエンドで構築されたWebRTCを利用したビデオ通話アプリケーションです。

## 🚀 特徴

- **リアルタイム通信**: WebRTCによる高品質な音声・映像通話
- **モダンスタック**: React 18 + TypeScript 5 + Node.js 20 LTS
- **高速開発**: Vite による高速な開発サーバー
- **型安全**: TypeScript による完全な型安全性
- **リアルタイム**: Socket.io による安定したシグナリング
- **テスト**: Jest による包括的なテストカバレッジ

## 📋 技術スタック

### フロントエンド
- **React 18.x** - UIライブラリ
- **TypeScript 5.x** - 型安全な開発
- **Vite** - 高速な開発サーバー
- **Socket.io Client** - リアルタイム通信

### バックエンド
- **Node.js 20.x LTS** - サーバーランタイム
- **Express.js 4.x** - Webフレームワーク
- **Socket.io 4.x** - WebSocket実装
- **TypeScript 5.x** - 型安全な開発

### WebRTC関連
- **ブラウザ標準WebRTC API** - ピアツーピア通信
- **Google Public STUN** - NAT穿越（開発用）
- **MediaStream API** - メディア管理

## 🛠️ 環境構築

### 前提条件

- Node.js 20.x LTS以上
- npm 10.x以上
- macOS（推奨）
- HTTPS対応ブラウザ（WebRTC要件）

### 1. クローンと依存関係のインストール

```bash
# リポジトリをクローン
git clone <repository-url>
cd webrtc

# 全プロジェクトの依存関係をインストール
npm run install:all
```

### 2. 環境変数の設定

バックエンド用の環境変数ファイルを作成：

```bash
# backend/.env
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
STUN_SERVER=stun:stun.l.google.com:19302
JWT_SECRET=your-jwt-secret-key-here
LOG_LEVEL=info
```

### 3. 開発サーバーの起動

```bash
# 方法1: 全体を同時起動（推奨）
npm run dev

# 方法2: 個別起動
npm run dev:backend    # バックエンド (ポート3001)
npm run dev:frontend   # フロントエンド (ポート5173)
```

### 4. 動作確認

- **フロントエンド**: http://localhost:5173
- **バックエンド**: http://localhost:3001
- **ヘルスチェック**: http://localhost:3001/health

## 🧪 テスト

```bash
# 全プロジェクトのテスト実行
npm run test:all

# 個別テスト実行
npm run test:frontend  # フロントエンドテスト
npm run test:backend   # バックエンドテスト
```

## 🏗️ ビルド

```bash
# 全プロジェクトのビルド
npm run build:all

# 個別ビルド
npm run build:frontend  # フロントエンドビルド
npm run build:backend   # バックエンドビルド
```

## 📁 プロジェクト構造

```
webrtc/
├── frontend/              # React フロントエンド
│   ├── src/
│   │   ├── components/    # UIコンポーネント
│   │   ├── hooks/         # カスタムフック
│   │   ├── services/      # WebRTC、Socket.io関連
│   │   ├── types/         # TypeScript型定義
│   │   └── utils/         # ユーティリティ関数
│   ├── package.json
│   └── vite.config.ts
├── backend/               # Node.js バックエンド
│   ├── src/
│   │   ├── routes/        # APIルート
│   │   ├── services/      # ビジネスロジック
│   │   ├── socket/        # Socket.ioハンドラー
│   │   ├── types/         # TypeScript型定義
│   │   └── utils/         # ユーティリティ関数
│   ├── package.json
│   └── tsconfig.json
├── shared/                # 共通型定義・ユーティリティ
├── .github/workflows/     # GitHub Actions CI/CD
├── .cursorrules          # 開発ルール
└── README.md
```

## 🔧 WebRTC開発のポイント

### HTTPS要件
WebRTCはHTTPS環境でのみ動作します。開発環境でHTTPS設定が必要な場合：

```bash
# mkcertを使用してローカル証明書を作成
brew install mkcert
mkcert -install
mkcert localhost
```

### STUN/TURNサーバー
- 開発環境: Google Public STUN (`stun:stun.l.google.com:19302`)
- 本番環境: 専用TURN/STUNサーバーの構築を推奨

### ブラウザサポート
- Chrome 23+
- Firefox 22+
- Safari 11+
- Edge 13+

## 📊 開発フロー

1. **機能実装**
   - 型定義の更新
   - コンポーネント/サービスの実装
   - テストの作成

2. **テスト実行**
   ```bash
   npm run test:all
   ```

3. **ビルド確認**
   ```bash
   npm run build:all
   ```

4. **CI/CD**
   - GitHub Actions による自動テスト
   - セキュリティ監査
   - 品質チェック

## 🚨 トラブルシューティング

### よくある問題

1. **ポート競合**
   ```bash
   lsof -i :3001  # ポート使用状況確認
   ```

2. **WebRTC接続失敗**
   - HTTPS環境の確認
   - ファイアウォール設定の確認
   - STUN/TURNサーバーの動作確認

3. **Socket.io接続エラー**
   - CORS設定の確認
   - バックエンドサーバーの起動状況確認

### ログの確認

```bash
# バックエンドログ
cd backend && npm run dev

# フロントエンド開発者ツール
# ブラウザの開発者ツール → Console タブ
```

## 📝 コーディング規約

プロジェクトの詳細な開発ルールは `.cursorrules` ファイルを参照してください。

主なポイント：
- TypeScriptの厳密な型チェック
- ESLintによるコード品質管理
- Jestによる包括的なテスト
- GitHub Actionsによる継続的インテグレーション

## 🤝 コントリビューション

1. フィーチャーブランチを作成
2. 変更を実装
3. テストを実行して通過することを確認
4. プルリクエストを作成

## 📄 ライセンス

このプロジェクトはMITライセンスの下で公開されています。

---

## 🔗 関連リンク

- [WebRTC API Documentation](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)
- [Socket.io Documentation](https://socket.io/docs/)
- [React Documentation](https://react.dev/)
- [Node.js Documentation](https://nodejs.org/docs/)
