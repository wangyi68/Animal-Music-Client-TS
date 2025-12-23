# CHANGELOG v3.0.0

> **Release Date:** 2024-12-23
> **Version:** 3.0.0 - Big Architecture Update

---

## 🚀 Highlights

Phiên bản này là một bản cập nhật lớn với kiến trúc mới hoàn toàn, tập trung vào:
- **Core Services Architecture** - 4 services cốt lõi mới
- **Enhanced Node Management** - Smart load balancing & health monitoring
- **New Music Commands** - 7 lệnh mới cho queue management
- **Spotify Support** - Tích hợp Spotify plugin
- **Clean Logging** - Giảm log spam, console sạch hơn

---

## 🆕 Core Services (NEW)

### StateManager (`src/core/StateManager.ts`)
Quản lý state tập trung cho toàn bộ bot:
- Player states per guild
- Guild settings & caching
- Loop mode management
- History tracking
- Auto cleanup

### NodeManager (`src/core/NodeManager.ts`)
Smart Lavalink node management:
- Health monitoring (CPU, RAM, ping)
- Load balancing strategies:
  - `best-score` (default)
  - `round-robin`
  - `least-players`
  - `lowest-cpu`
  - `lowest-memory`
  - `random`
- Auto failover
- Failure tracking & recovery

### QueueManager (`src/core/QueueManager.ts`)
Enhanced queue operations:
- `addNext()` - Thêm bài vào đầu queue
- `move()` - Di chuyển bài trong queue
- `remove()` - Xóa bài theo vị trí
- `fairShuffle()` - Xáo trộn công bằng theo user
- `removeDuplicates()` - Xóa bài trùng
- `reverse()` - Đảo ngược queue
- `search()` - Tìm bài trong queue

### ErrorHandler (`src/core/ErrorHandler.ts`)
Unified error handling:
- Standard error codes
- User-friendly messages (Vietnamese tsundere)
- Retry logic with backoff
- Error embed generation

---

## 🎵 New Commands (7)

| Command | Description |
|---------|-------------|
| `/playnext <query>` | Thêm bài vào đầu queue |
| `/move <from> <to>` | Di chuyển bài trong queue |
| `/remove <position>` | Xóa bài khỏi queue |
| `/fairshuffle` | Xáo trộn công bằng theo user |
| `/nowplaying` | Xem bài đang phát với progress bar |
| `/seek <time>` | Tua đến vị trí (VD: 1:30) |
| `/replay` | Phát lại bài từ đầu |

---

## 🎧 Spotify Support

Thêm hỗ trợ Spotify thông qua `kazagumo-spotify`:
- Tracks: `spotify.com/track/...`
- Albums: `spotify.com/album/...`
- Playlists: `spotify.com/playlist/...`
- Artist top tracks: `spotify.com/artist/...`

**Cấu hình:**
```json
{
  "spotify": {
    "clientId": "YOUR_SPOTIFY_CLIENT_ID",
    "clientSecret": "YOUR_SPOTIFY_CLIENT_SECRET"
  }
}
```

---

## 📝 Improvements

### Console Logging
- ✅ Giảm spam log khi nodes connect (chỉ log 3 đầu + summary)
- ✅ Loại bỏ warning "No healthy nodes available"
- ✅ Loại bỏ warning "Node marked as unhealthy"
- ✅ Thêm source detection trong log (YouTube/Spotify)

### Code Quality
- ✅ Removed unused imports
- ✅ Type safety improvements
- ✅ Enhanced error handling
- ✅ Smart message auto-delete

### Music Features
- ✅ Source detection (YouTube/Spotify)
- ✅ Smart node selection
- ✅ Improved queue empty detection
- ✅ Better track transition handling

---

## 📁 Project Structure

```
src/
├── commands/
│   ├── config/         # 1 command (prefix)
│   ├── info/           # 5 commands (help, lavalink, ping, stats, user)
│   └── music/          # 16 commands
├── core/               # NEW - Core services
│   ├── StateManager.ts
│   ├── NodeManager.ts
│   ├── QueueManager.ts
│   ├── ErrorHandler.ts
│   └── index.ts
├── database/           # MongoDB operations
├── handlers/           # Message, Command, Slash, Interaction handlers
├── services/           # MusicManager, AnimalSync
├── types/              # TypeScript definitions
├── utils/              # Logger, Constants, Buttons, Auto-delete
└── index.ts            # Entry point
```

---

## 📊 Statistics

| Metric | Count |
|--------|-------|
| Total Commands | 22 |
| Core Services | 4 |
| New Commands | 7 |
| Updated Files | 15+ |

---

## 🔧 Dependencies

### Added
- `kazagumo-spotify` ^2.1.1

### Existing
- `discord.js` ^14.14.1
- `kazagumo` ^3.2.0
- `shoukaku` ^4.2.0
- `mongoose` ^8.0.3
- `moment` ^2.30.1
- `@microsoft/signalr` ^8.0.0

---

## 📋 Migration Notes

### Breaking Changes
Không có breaking changes. Tất cả tính năng cũ vẫn hoạt động.

### New Configuration
Thêm optional `spotify` config vào `config.json`:
```json
{
  "spotify": {
    "clientId": "",
    "clientSecret": ""
  }
}
```

---

## 🎯 Quick Start

```bash
# Install dependencies
npm install

# Build
npm run build

# Start
npm start
```

---

> Made with 💖 by Animal Music Team
