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

### 🏗️ Kiến trúc v3.0 (Core Services)
- **StateManager**: Quản lý state tập trung với caching
- **NodeManager**: Load balancing và health monitoring cho Lavalink nodes
- **QueueManager**: Queue operations nâng cao (move, remove, fair shuffle)
- **ErrorHandler**: Unified error handling với retry logic

### 🎛️ Bảng điều khiển thông minh
- **9 nút điều khiển**: Previous, Pause/Resume, Stop, Next, Loop, Shuffle, Queue, Search, Volume
- Tự động cập nhật khi bài hát thay đổi
- Kiểm tra quyền người dùng (chỉ người request được dùng nút Stop/Clear)

### 📋 Lệnh hỗ trợ
| Lệnh | Mô tả |
|------|-------|
| `/play <query>` | Phát nhạc |
| `/playnext <query>` | Thêm bài vào đầu queue |
| `/stop` | Dừng phát và rời voice |
| `/pause` | Tạm dừng/tiếp tục |
| `/skip` | Bỏ qua bài hiện tại |
| `/queue` | Xem hàng chờ |
| `/nowplaying` | **MỚI** - Xem bài đang phát với progress bar |
| `/seek <time>` | **MỚI** - Tua đến vị trí (VD: 1:30) |
| `/replay` | **MỚI** - Phát lại bài từ đầu |
| `/loop <mode>` | Chuyển chế độ lặp |
| `/shuffle` | Trộn hàng chờ |
| `/fairshuffle` | Trộn công bằng (mỗi user được phát đều) |
| `/move <from> <to>` | Di chuyển bài trong queue |
| `/remove <position>` | Xóa bài khỏi queue |
| `/volume <0-200>` | Chỉnh âm lượng |
| `/clear` | Xóa hàng chờ |
| `/help` | Xem danh sách lệnh (có Select Menu) |
| `/stats` | Xem thông tin bot |
| `/ping` | Kiểm tra độ trễ |
| `/lavalink` | Xem trạng thái các Clusters |
| `/shard` | Xem thông tin Shard chi tiết |

### 🏗️ Cấu trúc thư mục
```
src/
├── core/           # v3.0 Core Services
│   ├── StateManager.ts     # Unified state management
│   ├── NodeManager.ts      # Smart node selection
│   ├── QueueManager.ts     # Enhanced queue operations
│   ├── ErrorHandler.ts     # Unified error handling
│   └── index.ts
├── commands/       # 22 commands
│   ├── music/      # 16 commands: play, playnext, stop, pause, skip, queue, nowplaying, seek, replay, loop, shuffle, fairshuffle, move, remove, clear, volume
│   ├── info/       # 5 commands: help, ping, shard, stats, lavalink
│   └── config/     # 1 command: prefix
├── handlers/
│   ├── CommandHandler.ts
│   ├── InteractionHandler.ts
│   ├── MessageHandler.ts
│   └── SlashHandler.ts
├── services/
│   ├── MusicManager.ts
│   └── AnimalSync.ts
├── database/
│   └── index.ts
├── utils/
│   ├── buttons.ts
│   ├── constants.ts
│   ├── logger.ts
│   └── messageAutoDelete.ts
├── types/
│   └── index.ts
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

### 🔗 Nguồn Lavalink miễn phí
Bạn có thể tìm thấy danh sách các Public Lavalink Nodes tại:
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
- **Không emoji tiêu chuẩn**: Thay bằng text emoji cho field names

---

## 🔄 Changelog

### v3.0.0 - Big Architecture Update (2025-12-23)

#### 🚀 Kiến trúc mới (Core Services)
- ✅ **StateManager**: Unified state management với caching, history, và auto cleanup
- ✅ **NodeManager**: Smart Lavalink node selection với health scoring và load balancing
- ✅ **QueueManager**: Enhanced queue operations (move, remove, fair shuffle, duplicate removal)
- ✅ **ErrorHandler**: Unified error handling với error codes và retry logic

#### ✨ Lệnh mới
- ✅ `/playnext` - Thêm bài vào đầu queue (phát ngay sau bài hiện tại)
- ✅ `/move <from> <to>` - Di chuyển bài trong queue
- ✅ `/remove <position>` - Xóa bài khỏi queue theo vị trí
- ✅ `/fairshuffle` - Xáo trộn công bằng (mỗi user được phát đều)

#### 🎯 Cải tiến
- ✅ **Smart Node Selection**: Tự động chọn node tốt nhất dựa trên health score
- ✅ **Health Monitoring**: Theo dõi CPU, RAM, ping của từng node
- ✅ **Auto Failover**: Tự động chuyển sang node khác khi có lỗi
- ✅ **Caching System**: Cache search results và track metadata
- ✅ **Better History**: Lưu lịch sử phát với giới hạn configurable
- ✅ **Graceful Cleanup**: Tự động cleanup inactive states

#### 📁 Files mới
| File | Mô tả |
|------|-------|
| `src/core/StateManager.ts` | Unified state management |
| `src/core/NodeManager.ts` | Smart node selection & monitoring |
| `src/core/QueueManager.ts` | Enhanced queue operations |
| `src/core/ErrorHandler.ts` | Unified error handling |
| `src/core/index.ts` | Core exports |
| `src/commands/music/playnext.ts` | PlayNext command |
| `src/commands/music/move.ts` | Move command |
| `src/commands/music/remove.ts` | Remove command |
| `src/commands/music/fairshuffle.ts` | FairShuffle command |

---

### v2.1.2 - Auto-Delete & Tsundere Max (2025-12-22)

#### ✨ Cải tiến & Tính năng mới
- ✅ **Auto-Delete System (SmartDelete)**: Tự động xóa tin nhắn phản hồi (Success/Error) sau thời gian nhất định để giữ sạch kênh chat.
- ✅ **Tsundere Personality Max**: Cập nhật toàn bộ tin nhắn sang phong cách Tsundere Cute (Dỗi khi lỗi, Emote khi vui).
- ✅ **Interaction Refinement**: Cải thiện phản hồi cho các nút bấm và Modal (Search, Volume) chuẩn tính cách.
- ✅ **Queue Info Update**: Hiển thị thông tin hàng chờ chi tiết hơn và dễ thương hơn.

#### 📁 Files đã tham gia cập nhật
| File | Thay đổi |
|------|----------|
| `src/utils/messageAutoDelete.ts` | **MỚI** - Logic SmartDelete và Presets |
| `src/commands/music/*` | Áp dụng SmartDelete & Tsundere msgs |
| `src/commands/info/*` | Áp dụng SmartDelete & Tsundere msgs |
| `src/handlers/InteractionHandler.ts` | Update buttons/modals responses |
| `src/handlers/SlashHandler.ts` | Update error responses |
| `src/services/MusicManager.ts` | Update playback messages |
| `package.json` | Bump version 2.1.2 |

---

### v2.1.1 - Cluster & Embed Standardization (2025-12-22)

#### ✨ Cải tiến giao diện & Tính năng
- ✅ **Standardized Embeds**: Toàn bộ hệ thống tin nhắn chuyển sang sử dụng `EmbedBuilder`.
- ✅ **Unified Color System**: Đồng bộ màu sắc hiển thị (Pink cho thông báo, Red cho lỗi).
- ✅ **Cluster Support**: Đổi thuật ngữ "Node" thành "Cluster" để chuyên nghiệp hơn.
- ✅ **Multi-Node Config**: Hỗ trợ config nhiều node linh hoạt (array hoặc object).
- ✅ **Presence Stats**: Bot hiển thị thống kê Cluster (RAM, Players) trên status luân phiên.
- ✅ **Enhanced Logs**: Log chi tiết Cluster nào đang xử lý bài hát.

#### 📁 Files đã tham gia cập nhật
| File | Thay đổi |
|------|----------|
| `src/services/MusicManager.ts` | Cluster name card, Embed color, Logs |
| `src/commands/info/lavalink.ts` | Rename to Cluster, Embed color |
| `src/commands/info/stats.ts` | Lavalink Dev Info section |
| `src/handlers/MessageHandler.ts` | Force Embeds for all replies |
| `src/utils/constants.ts` | Centralized COLORS constant |
| `src/index.ts` | Cluster Stats Presence |
| `package.json` | Bump version 2.1.1 |

---

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
