# PulseLink — React Native (Web, iOS, Android) + Redux Toolkit + MVC

Loyiha **MVC (Model-View-Controller)** arxitekturasiga muvofiq modullarga ajratilgan holda qayta tuzildi:

```text
pulselink/
├── server/                       # Node.js + Express + WebSocket + MySQL/MariaDB (MVC)
│   └── src/
│       ├── config/db.js          # MySQL/MariaDB ulanishi va jadvallar
│       ├── models/               # UserModel, MessageModel, CallModel
│       ├── controllers/          # AuthController, UserController, ChatController, MediaController, SocketController
│       ├── routes/apiRoutes.js   # REST API yo‘nalishlari
│       └── middleware/           # authMiddleware, rateLimitMiddleware
├── client/                       # React Native + Expo + Redux Toolkit (Web, iOS, Android — MVC)
│   └── src/
│       ├── models/types.ts       # Ma’lumotlar interfeyslari
│       ├── store/                # Redux Toolkit store va slices (auth, chat, call, settings)
│       ├── controllers/          # ApiController, SocketController, WebRtcController
│       └── views/                # Theme, UserAvatar, AuthScreen, HomeScreen, ChatScreen, CallScreen
└── android/                      # Native Kotlin + Jetpack Compose varianti (ixtiyoriy)
```

## Ishga tushirish

### 1. Server (MySQL / MariaDB)
```bash
cd server
cp .env.example .env
npm install
npm start
```

### 2. React Native Client (Web, iOS, Android)
```bash
cd client
npm install
npm run web      # Brauzerda ochish (React Native Web)
npm run ios      # iOS Simulator / Xcode orqali ochish
npm run android  # Android Emulator / qurilmada ochish
```
