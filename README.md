# Animal Music Client TS 🎵

> Bot âm nhạc Discord với tính cách **Tsundere Cute** - dễ thương nhưng cũng hay dỗi!

---

## ✨ Tính năng nổi bật

### 🎀 Tính cách Tsundere Cute
- **Khi vui**: "Tớ đã thêm bài vào hàng chờ rồi nè~", "Tiếp tục phát nhạc rồi nè~"
- **Khi dỗi**: "Hảả?! Làm gì có nhạc nào đang phát đâu mà skip!", "Loop cái gì khi chưa có nhạc vậy hả?!"

### 🎧 Chức năng âm nhạc
- Phát nhạc từ **YouTube**, **Spotify**, **SoundCloud**
- Hàng chờ thông minh với phân trang
- Loop (Tắt / Bài / Hàng chờ)
- Shuffle ngẫu nhiên
- Điều khiển âm lượng
- **Hỗ trợ nhiều Lavalink nodes** với failover tự động

### 🎛️ Bảng điều khiển thông minh
- **9 nút điều khiển**: Previous, Pause/Resume, Stop, Next, Loop, Shuffle, Queue, Search, Volume
- Tự động cập nhật khi bài hát thay đổi
- Kiểm tra quyền người dùng (chỉ người request được dùng nút Stop/Clear)

### 📋 Lệnh hỗ trợ
| Lệnh | Mô tả |
|------|-------|
| `/play <query>` | Phát nhạc |
| `/stop` | Dừng phát và xóa hàng chờ |
| `/pause` | Tạm dừng/tiếp tục |
| `/skip` | Bỏ qua bài hiện tại |
| `/queue` | Xem hàng chờ |
| `/loop <mode>` | Chuyển chế độ lặp |
| `/shuffle` | Trộn hàng chờ |
| `/volume <0-100>` | Chỉnh âm lượng |
| `/clear` | Xóa hàng chờ |
| `/help` | Xem danh sách lệnh (có Select Menu) |
| `/stats` | Xem thông tin bot |
| `/ping` | Kiểm tra độ trễ |
| `/lavalink` | Xem trạng thái các Lavalink nodes |

### 🏗️ Cấu trúc thư mục
```
src/
├── commands/
│   ├── music/      (play, stop, pause, skip, queue, loop, shuffle, clear, volume)
│   ├── info/       (help, ping, shard, stats)
│   └── config/     (prefix)
├── handlers/
│   ├── CommandHandler.ts
│   ├── InteractionHandler.ts
│   ├── MessageHandler.ts
│   └── SlashHandler.ts
├── services/
│   └── MusicManager.ts
├── utils/
│   ├── buttons.ts
│   ├── constants.ts
│   └── logger.ts
└── index.ts
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
      },
      {
        "name": "Secondary",
        "url": "localhost:2334",
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
- **Không emoji tiêu chuẩn**: Thay bằng text emoji cho field names

---

## 🔄 Changelog

### v2.1.0 - Multi Lavalink Support (2025-12-22)

#### ✨ Tính năng mới
- ✅ Hỗ trợ nhiều Lavalink nodes (Primary + Secondary)
- ✅ Failover tự động khi node bị disconnect
- ✅ Lệnh `/lavalink` để xem trạng thái các nodes
- ✅ Hiển thị thông tin Lavalink trong `/stats`
- ✅ Reconnect tự động khi mất kết nối
- ✅ Giảm log spam (chỉ hiện khi node ready)

#### 📁 Files đã thay đổi
| File | Thay đổi |
|------|----------|
| `config.example.json` | Thêm cấu hình multi nodes |
| `src/types/index.ts` | Thêm `LavalinkNodeStatus` interface |
| `src/services/MusicManager.ts` | Multi nodes + `getLavalinkNodesStatus()` |
| `src/commands/info/lavalink.ts` | **MỚI** - Command xem nodes status |
| `src/commands/info/stats.ts` | Thêm Lavalink section |
| `README.md` | Cập nhật documentation |


---

### v2.0.0 - Tsundere Cute Update
- ✅ Tái cấu trúc thư mục commands theo danh mục
- ✅ Tính cách bot Tsundere Cute (vui khi thành công, dỗi khi lỗi)
- ✅ Lệnh `/help` với Select Menu chọn danh mục
- ✅ Lệnh `/stats` hiển thị thông tin bot chi tiết
- ✅ Kiểm tra quyền người dùng cho nút điều khiển
- ✅ Auto-leave sau 3 phút khi không có ai trong voice
- ✅ Discord Markdown formatting cho tất cả tin nhắn
- ✅ Loại bỏ hoàn toàn emoji tiêu chuẩn
- ✅ Fix lỗi "Player is already destroyed"

---

## 📝 License

MIT License - Thoải mái sử dụng và chỉnh sửa!

---

> Made with 💖 by Animal Music Team
