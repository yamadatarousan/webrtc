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

## 📊 アプリケーションの処理フロー

### システム全体のアーキテクチャ

```mermaid
graph TB
    subgraph "クライアント A"
        A1[React Frontend]
        A2[WebRTC Service]
        A3[Socket.io Client]
        A4[メディアデバイス]
    end
    
    subgraph "シグナリングサーバー"
        S1[Express.js Server]
        S2[Socket.io Server]
        S3[ルーム管理]
    end
    
    subgraph "クライアント B"
        B1[React Frontend]
        B2[WebRTC Service]
        B3[Socket.io Client]
        B4[メディアデバイス]
    end
    
    subgraph "STUN/TURNサーバー"
        ST[Google Public STUN]
    end
    
    A1 <--> A2
    A2 <--> A3
    A3 <--> S2
    S2 <--> S1
    S1 <--> S3
    S2 <--> B3
    B3 <--> B2
    B2 <--> B1
    A4 --> A2
    B4 --> B2
    
    A2 <-.-> ST
    B2 <-.-> ST
    A2 <-.-> B2
    
    style A1 fill:#e1f5fe
    style B1 fill:#e1f5fe
    style S1 fill:#f3e5f5
    style ST fill:#fff3e0
```

### 1. アプリケーション初期化フロー

```mermaid
sequenceDiagram
    participant UI as React UI
    participant Socket as SocketService
    participant WebRTC as WebRTCService
    participant Server as シグナリングサーバー
    
    UI->>UI: コンポーネント起動
    UI->>Socket: connect()
    Socket->>Server: Socket.io接続
    Server-->>Socket: 接続確立
    Socket-->>UI: 接続状態更新
    UI->>WebRTC: initializeSocketListeners()
    WebRTC->>Socket: イベントリスナー登録
    UI->>UI: 接続状態監視開始
    
    Note over UI,Server: 初期化完了、ルーム参加待機状態
```

### 2. ルーム参加とメディア取得フロー

```mermaid
sequenceDiagram
    participant User as ユーザー
    participant UI as React UI
    participant Media as MediaDevices
    participant Socket as SocketService
    participant Server as シグナリングサーバー
    
    User->>UI: ルームID・ユーザー名入力
    User->>UI: 「参加」ボタンクリック
    UI->>Socket: joinRoom(roomId, userName)
    Socket->>Server: ルーム参加リクエスト
    Server->>Server: ユーザー登録・ルーム管理
    Server-->>Socket: room-joined イベント
    Socket-->>UI: ルーム参加成功
    UI->>UI: 既存ユーザー情報を処理
    UI->>Media: getUserMedia()
    Media-->>UI: MediaStream取得
    UI->>UI: ローカルビデオ表示
    UI->>Socket: WebRTCサービスに通知
    
    Note over User,Server: ルーム参加完了、通話準備完了
```

### 3. WebRTC接続確立フロー（Offer/Answer）

```mermaid
sequenceDiagram
    participant A as ユーザーA
    participant SA as SocketService A
    participant Server as シグナリングサーバー
    participant SB as SocketService B
    participant B as ユーザーB
    
    Note over A,B: ユーザーBがルーム参加
    Server->>SA: user-joined イベント
    A->>A: WebRTC接続開始判定
    A->>A: createOffer()
    A->>SA: Offer送信
    SA->>Server: offer メッセージ
    Server->>SB: offer 中継
    SB->>B: Offer受信
    B->>B: setRemoteDescription(offer)
    B->>B: createAnswer()
    B->>SB: Answer送信
    SB->>Server: answer メッセージ
    Server->>SA: answer 中継
    SA->>A: Answer受信
    A->>A: setRemoteDescription(answer)
    
    Note over A,B: シグナリング完了、ICE候補交換開始
```

### 4. ICE候補交換とP2P接続確立

```mermaid
sequenceDiagram
    participant A as ユーザーA
    participant STUN as STUNサーバー
    participant Server as シグナリングサーバー
    participant B as ユーザーB
    
    Note over A,B: Offer/Answer交換完了後
    
    A->>STUN: STUN リクエスト
    STUN-->>A: パブリックIP取得
    A->>A: ICE候補生成
    A->>Server: ICE候補送信
    Server->>B: ICE候補中継
    B->>B: addIceCandidate()
    
    B->>STUN: STUN リクエスト
    STUN-->>B: パブリックIP取得
    B->>B: ICE候補生成
    B->>Server: ICE候補送信
    Server->>A: ICE候補中継
    A->>A: addIceCandidate()
    
    Note over A,B: 最適な通信経路を選択
    A<-.->B: P2P接続確立
    A<-.->B: メディアストリーム送受信開始
    
    Note over A,B: ビデオ通話開始
```

### 5. リアルタイムチャット機能フロー

```mermaid
sequenceDiagram
    participant UA as ユーザーA UI
    participant SA as SocketService A
    participant Server as シグナリングサーバー
    participant SB as SocketService B
    participant UB as ユーザーB UI
    
    UA->>UA: チャットメッセージ入力
    UA->>SA: sendChatMessage()
    SA->>Server: chat-message-send
    Server->>Server: メッセージ処理・配信
    Server->>SA: chat-message-received
    Server->>SB: chat-message-received
    SA->>UA: チャットメッセージ表示
    SB->>UB: チャットメッセージ表示
    
    Note over UA,UB: リアルタイムチャット完了
```

### 6. エラーハンドリングとリカバリフロー

```mermaid
flowchart TD
    A[WebRTC接続試行] --> B{接続成功？}
    B -->|Yes| C[通話開始]
    B -->|No| D[エラー種別判定]
    
    D --> E{メディアアクセスエラー？}
    E -->|Yes| F[ユーザーに権限要求]
    F --> G[権限再取得]
    G --> A
    
    E -->|No| H{ネットワークエラー？}
    H -->|Yes| I[接続状態確認]
    I --> J[再接続試行]
    J --> A
    
    H -->|No| K{ICE接続失敗？}
    K -->|Yes| L[STUN/TURN設定確認]
    L --> M[接続経路再計算]
    M --> A
    
    K -->|No| N[一般的なエラー処理]
    N --> O[ユーザーに通知]
    O --> P[ルーム退出]
    
    C --> Q[通話終了]
    Q --> R[リソース解放]
    R --> S[待機状態に戻る]
```

### 7. データフローの概要

```mermaid
graph LR
    subgraph "フロントエンド"
        A[React Components]
        B[State Management]
        C[Services Layer]
        D[WebRTC API]
        E[Socket.io Client]
    end
    
    subgraph "バックエンド"
        F[Express Server]
        G[Socket.io Server]
        H[Room Management]
        I[Message Routing]
    end
    
    subgraph "外部サービス"
        J[STUN Server]
        K[Media Devices]
    end
    
    A <--> B
    B <--> C
    C <--> D
    C <--> E
    E <--> G
    G <--> F
    F <--> H
    G <--> I
    D <--> J
    D <--> K
    
    style A fill:#e3f2fd
    style C fill:#f3e5f5
    style F fill:#fff3e0
    style J fill:#e8f5e8
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

## 🎥 ビデオ通話アプリの使用方法

### 基本的な使い方

1. **サーバーの起動**
   ```bash
   npm run dev
   ```

2. **アプリケーションへのアクセス**
   - フロントエンド: http://localhost:5173
   - バックエンド: http://localhost:3001

### 1対1ビデオ通話のテスト

1. **2つのブラウザタブ**を開きます（または2つの異なるブラウザ）

2. **両方で**以下の手順を実行：
   - http://localhost:5173 にアクセス
   - **同じルームID**を入力（例：`test-room`）
   - **異なるユーザー名**を入力（例：`ユーザー1`、`ユーザー2`）
   - カメラ・マイクのアクセス許可を承認
   - 「参加する」をクリック

3. **通話開始**
   - 片方のユーザーで参加者リストの「📞 通話」ボタンをクリック
   - WebRTC接続が自動的に開始されます

### 期待される動作
- ✅ 自分のビデオが左側に表示（ミラー効果）
- ✅ 相手のビデオが右側に表示
- ✅ 音声通話も同時に動作
- ✅ 参加者リストに両方のユーザーが表示
- ✅ 接続状態インジケーターが緑色で表示

### トラブルシューティング

#### カメラ・音声関連
- **カメラが表示されない**: ブラウザの設定でカメラアクセスを許可
- **音声が聞こえない**: ブラウザの音量設定とマイクアクセスを確認
- **映像が暗い**: 照明環境を確認

#### 接続関連
- **「切断中」と表示される**: バックエンドサーバーが起動しているか確認
- **通話が始まらない**: 同じルームIDに参加しているか確認
- **映像が途切れる**: ネットワーク環境を確認

#### デバッグ方法
1. **ブラウザの開発者ツール**でコンソールログを確認
2. **ネットワークタブ**でWebSocket接続を確認
3. **バックエンドのターミナル**でSocket.ioのログを確認

#### トラブルシューティングフローチャート

```mermaid
flowchart TD
    A[問題発生] --> B{どの段階で失敗？}
    
    B -->|初期化| C[Socket.io接続確認]
    C --> C1{接続状態は？}
    C1 -->|切断| C2[サーバー起動確認]
    C1 -->|接続中| C3[CORS設定確認]
    C2 --> C4[npm run dev実行]
    C3 --> C5[FRONTEND_URL設定確認]
    
    B -->|ルーム参加| D[ルーム参加処理確認]
    D --> D1{エラーメッセージは？}
    D1 -->|USER_NOT_FOUND| D2[ユーザーID重複確認]
    D1 -->|ROOM_FULL| D3[ルーム参加者数確認]
    D1 -->|その他| D4[バックエンドログ確認]
    
    B -->|メディア取得| E[デバイスアクセス確認]
    E --> E1{権限状態は？}
    E1 -->|拒否| E2[ブラウザ設定で許可]
    E1 -->|許可済み| E3[デバイス接続確認]
    E3 --> E4[他のアプリでの使用確認]
    
    B -->|WebRTC接続| F[接続状態確認]
    F --> F1{ICE接続状態は？}
    F1 -->|failed| F2[STUN/TURN設定確認]
    F1 -->|checking| F3[ファイアウォール確認]
    F1 -->|disconnected| F4[ネットワーク確認]
    F2 --> F5[STUNサーバー疎通確認]
    F3 --> F6[ポート開放確認]
    F4 --> F7[インターネット接続確認]
    
    B -->|チャット| G[Socket.io通信確認]
    G --> G1[メッセージ送受信ログ確認]
    G1 --> G2[イベント名の一致確認]
    
    style A fill:#ffebee
    style C2 fill:#e8f5e8
    style C4 fill:#e8f5e8
    style E2 fill:#fff3e0
    style F5 fill:#e3f2fd
    style F6 fill:#e3f2fd
    style F7 fill:#e3f2fd
```

#### 各段階での期待されるログ出力

```mermaid
timeline
    title 正常な接続フローでのログ出力
    
    section 初期化
        Socket.io接続 : 🔌 Socket.io サーバーに接続しました
                      : ✅ Socket.io初期化完了
                      : 📡 WebRTCServiceリスナー初期化完了
    
    section ルーム参加
        参加リクエスト : 🏠 ルーム参加リクエスト送信
        参加成功      : ✅ currentUserId を設定
                     : 🔍 ルーム内の全ユーザー: (2) [{…}, {…}]
    
    section メディア取得
        デバイス確認   : 📹 利用可能なデバイス: (5) [...]
        ストリーム取得 : 📹 メディアストリーム取得成功
                     : 🎥 ローカルストリームを設定: 2 tracks
    
    section WebRTC接続
        接続開始      : 🔗 未接続ユーザーとの接続を開始
        Offer/Answer  : 📤 Offerを送信 / 📥 Answerを受信
        ICE交換       : 📤 ICE候補を送信 / ✅ ICE候補追加完了
        接続確立      : ✅ WebRTC接続成功
                     : 📥 リモートストリームを受信
```

### アプリケーションの特徴

- **P2P通信**: サーバーを経由せず直接通信
- **自動シグナリング**: Socket.ioによる接続協調
- **NAT穿越**: STUNサーバーによる接続支援
- **レスポンシブUI**: モバイル端末にも対応

### 実際の処理フロー例（2人のユーザーがビデオ通話を開始する場合）

```mermaid
gantt
    title WebRTCビデオ通話の時系列処理
    dateFormat X
    axisFormat %L
    
    section 初期化
    サーバー起動           :0, 1000
    ユーザーA アクセス      :1000, 1500
    ユーザーB アクセス      :2000, 2500
    
    section ルーム参加
    ユーザーA ルーム参加    :1500, 2000
    ユーザーA メディア取得  :2000, 3000
    ユーザーB ルーム参加    :2500, 3000
    ユーザーB メディア取得  :3000, 4000
    
    section WebRTC接続
    Offer/Answer交換       :4000, 5000
    ICE候補交換           :5000, 6000
    P2P接続確立           :6000, 6500
    
    section 通話開始
    ビデオ通話開始         :6500, 10000
```

### 主要コンポーネント間の責任分担

```mermaid
graph TD
    subgraph "UI Layer"
        A[VideoCall.tsx]
        B[ChatPanel.tsx]
    end
    
    subgraph "Service Layer"
        C[SocketService]
        D[WebRTCService]
    end
    
    subgraph "Backend"
        E[SocketHandler]
        F[Room Management]
    end
    
    A -->|状態管理・UI制御| A
    A -->|Socket通信| C
    A -->|WebRTC制御| D
    B -->|チャット機能| C
    C -->|リアルタイム通信| E
    D -->|シグナリング| C
    E -->|ルーム管理| F
    
    A -.->|メディアストリーム| D
    D -.->|P2P通信| D
    
    style A fill:#e3f2fd,stroke:#1976d2
    style C fill:#f3e5f5,stroke:#7b1fa2
    style D fill:#fff3e0,stroke:#f57c00
    style E fill:#e8f5e8,stroke:#388e3c
```

### デバッグ時の主要ログポイント

```mermaid
flowchart LR
    A[アプリ起動] --> B[Socket.io接続]
    B --> C[ルーム参加]
    C --> D[メディア取得]
    D --> E[WebRTC接続開始]
    E --> F[Offer/Answer交換]
    F --> G[ICE候補交換]
    G --> H[P2P接続確立]
    H --> I[通話開始]
    
    B -.-> B1["🔌 Socket.io サーバーに接続しました"]
    C -.-> C1["🏠 ルーム参加成功"]
    D -.-> D1["📹 メディアストリーム取得成功"]
    E -.-> E1["🔗 WebRTC接続開始"]
    F -.-> F1["📤 Offerを送信 / 📥 Answerを受信"]
    G -.-> G1["🧊 ICE候補を送信/受信"]
    H -.-> H1["✅ WebRTC接続成功"]
    I -.-> I1["📥 リモートストリーム受信"]
    
    style B1 fill:#e8f5e8
    style C1 fill:#e3f2fd
    style D1 fill:#fff3e0
    style E1 fill:#f3e5f5
    style F1 fill:#fce4ec
    style G1 fill:#e0f2f1
    style H1 fill:#e8f5e8
    style I1 fill:#e3f2fd
```

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
