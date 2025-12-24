# Animal Music Client TS 🎵

> Bot âm nhạc Discord với tính cách **Tsundere Cute** - dễ thương nhưng cũng hay dỗi!

---

## ✨ Tính năng nổi bật

### 🎀 Tính cách Tsundere Cute
- **Khi vui**: "Tớ đã thêm bài vào hàng chờ rồi nè~", "Tiếp tục phát nhạc rồi nè~"
- **Khi dỗi**: "Hảả?! Làm gì có nhạc nào đang phát đâu mà skip!", "Loop cái gì khi chưa có nhạc vậy hả?!"

### 🎧 Chức năng âm nhạc
- Phát nhạc từ **YouTube** và **Spotify**
- Hàng chờ thông minh với phân trang
- Loop (Tắt / Bài / Hàng chờ)
- Shuffle ngẫu nhiên & **Fair Shuffle** (xáo trộn công bằng)
- Điều khiển âm lượng
- **Hỗ trợ Multi-Cluster** với failover tự động và cân bằng tải
- **Smart Node Selection** - Tự động chọn node tốt nhất
- Hiển thị Cluster xử lý track hiện tại

### 🎧 DJ Role System (Mới v3.1.0)
Hệ thống quyền kiểm soát bot linh hoạt:
- **DJ Role**: Set một role làm DJ
- **DJ Users**: Thêm từng user vào danh sách DJ
- **Permission Levels**: Owner > Admin > DJ Role > DJ User > Requester > Alone in VC
- Xem chi tiết: [Changelog v3.1.0](./docs/changelogs/v3.1.0.md)

### 🏗️ Kiến trúc v3.0 (Core Services)
- **StateManager**: Quản lý state tập trung với caching
- **NodeManager**: Load balancing và health monitoring cho Lavalink nodes
- **QueueManager**: Queue operations nâng cao (move, remove, fair shuffle)
- **ErrorHandler**: Unified error handling với retry logic

### 🎛️ Bảng điều khiển thông minh
- **9 nút điều khiển**: Previous, Pause/Resume, Stop, Next, Loop, Shuffle, Queue, Search, Volume
- Tự động cập nhật khi bài hát thay đổi
- Kiểm tra quyền DJ trước khi cho phép điều khiển

---

## 📋 Danh sách lệnh

### 🎵 Lệnh Nhạc
| Lệnh | Mô tả |
|------|-------|
| `/play <query>` | Phát nhạc |
| `/playnext <query>` | Thêm bài vào đầu queue |
| `/stop` | Dừng phát và rời voice |
| `/pause` | Tạm dừng/tiếp tục |
| `/skip` | Bỏ qua bài hiện tại |
| `/queue` | Xem hàng chờ |
| `/nowplaying` | Xem bài đang phát với progress bar |
| `/seek <time>` | Tua đến vị trí (VD: 1:30) |
| `/replay` | Phát lại bài từ đầu |
| `/loop <mode>` | Chuyển chế độ lặp |
| `/shuffle` | Trộn hàng chờ |
| `/fairshuffle` | Trộn công bằng (mỗi user được phát đều) |
| `/move <from> <to>` | Di chuyển bài trong queue |
| `/remove <position>` | Xóa bài khỏi queue |
| `/volume <0-125>` | Chỉnh âm lượng |
| `/clear` | Xóa hàng chờ |

### ⚙️ Lệnh Cấu hình
| Lệnh | Mô tả |
|------|-------|
| `/prefix <prefix>` | Đổi prefix của bot |
| `/dj role @role` | Set DJ Role cho server |
| `/dj add @user` | Thêm user vào danh sách DJ |
| `/dj remove @user` | Xóa user khỏi danh sách DJ |
| `/dj status` | Xem trạng thái DJ settings |
| `/dj toggle on/off` | Bật/tắt DJ mode |
| `/dj reset` | Reset DJ settings |

### ℹ️ Lệnh Thông tin
| Lệnh | Mô tả |
|------|-------|
| `/help` | Xem danh sách lệnh (có Select Menu) |
| `/stats` | Xem thông tin bot |
| `/ping` | Kiểm tra độ trễ |
| `/lavalink` | Xem trạng thái các Clusters |
| `/shard` | Xem thông tin Shard chi tiết |

---

## 🏗️ Cấu trúc thư mục

```
Animal-Music-Client-TS/
├── docs/
│   └── changelogs/     # Changelog cho từng version
├── src/
│   ├── core/           # v3.0 Core Services
│   │   ├── StateManager.ts
│   │   ├── NodeManager.ts
│   │   ├── QueueManager.ts
│   │   ├── ErrorHandler.ts
│   │   └── index.ts
│   ├── commands/       # 23 commands
│   │   ├── music/      # 16 commands
│   │   ├── info/       # 5 commands
│   │   └── config/     # 2 commands (prefix, dj)
│   ├── handlers/
│   │   ├── CommandHandler.ts
│   │   ├── InteractionHandler.ts
│   │   ├── MessageHandler.ts
│   │   └── SlashHandler.ts
│   ├── services/
│   │   ├── MusicManager.ts
│   │   └── AnimalSync.ts
│   ├── database/
│   │   └── index.ts
│   ├── utils/
│   │   ├── buttons.ts
│   │   ├── constants.ts
│   │   ├── logger.ts
│   │   ├── permissions.ts  # DJ Role System
│   │   └── messageAutoDelete.ts
│   ├── types/
│   │   └── index.ts
│   └── index.ts
├── config.json
└── package.json
```

---

## 🛠️ Công nghệ sử dụng

| Công nghệ | Phiên bản |
|-----------|-----------|
| Discord.js | v14 |
| Kazagumo | Latest |
| Shoukaku | Latest |
| Lavalink | v4 |
| TypeScript | v5 |
| Node.js | v18+ |
| MongoDB | v8 |

---

## 📦 Cài đặt

### 1. Clone repository
```bash
git clone https://github.com/wangyi68/Animal-Music-Client-TS.git
cd Animal-Music-Client-TS
```

### 2. Cài đặt dependencies
```bash
npm install
```

### 3. Cấu hình
Copy `config.example.json` thành `config.json` và điền thông tin:
```json
{
  "app": {
    "token": "YOUR_BOT_TOKEN",
    "prefix": "!",
    "clientId": 0,
    "ownerId": "YOUR_DISCORD_USER_ID"
  },
  "lavalink": {
    "nodes": [
      {
        "name": "Primary",
        "url": "localhost:2333",
        "auth": "youshallnotpass",
        "secure": false
      }
    ]
  },
  "mongodb": {
    "uri": "mongodb://localhost:27017/animal-music"
  }
}
```

### 🔗 Nguồn Lavalink miễn phí
- https://lavalink.darrennathanael.com/
- https://freelavalink.serenetia.com/
- https://freelavalink.serenetia.com/list

### 4. Build và chạy
```bash
npm run build
npm start
```

---

## 🎨 Phong cách thiết kế

- **Màu chủ đạo**: Hồng phấn (#FFC0CB)
- **Ngôn ngữ**: Tiếng Việt với giọng điệu thân thiện, đáng yêu
- **Discord Markdown**: Sử dụng `>` quote, `**bold**`, `` `code` ``

---

## 📜 Changelog

Xem chi tiết các thay đổi tại: [docs/changelogs](./docs/changelogs/)

| Version | Ngày | Mô tả |
|---------|------|-------|
| [v3.1.0](./docs/changelogs/v3.1.0.md) | 2025-12-24 | DJ Role System |
| [v3.0.0](./docs/changelogs/v3.0.0.md) | 2025-12-23 | Core Services Architecture |
| [v2.1.2](./docs/changelogs/v2.1.2.md) | 2025-12-22 | Auto-Delete & Tsundere Max |
| [v2.1.1](./docs/changelogs/v2.1.1.md) | 2025-12-22 | Cluster & Embed Standardization |
| [v2.1.0](./docs/changelogs/v2.1.0.md) | 2025-12-22 | Multi Lavalink Support |
| [v2.0.0](./docs/changelogs/v2.0.0.md) | 2025-12-21 | Tsundere Cute Update |

---

## 📝 License

MIT License - Thoải mái sử dụng và chỉnh sửa!

---

> Made with 💖 by Animal Music Team
