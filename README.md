# 🎵 Animal Music Client

A powerful, cute, and feature-rich Discord music bot built with [Discord.js](https://discord.js.org/), [Kazagumo](https://github.com/Takiyo0/Kazagumo), and [Shoukaku](https://github.com/Deivu/Shoukaku).

## ✨ Features

- **🎧 High-Quality Music Playback**: Supports YouTube, Spotify, and SoundCloud.
- **🔍 Smart Autocomplete**: Search for songs instantly in the slash command interface.
- **⏯️ Rich UI Controls**: Interactive buttons for easy control (Pause, Resume, Skip, Loop, Shuffle, etc.).
- **🔁 Advanced Looping**: Loop a single track or the entire queue.
- **📱 Responsive & Cute Embeds**: Beautifully designed embeds with custom emojis and Vietnamese support.
- **📡 AnimalSync**: Multi-bot synchronization support.
- **💾 Persistent Configuration**: Custom prefixes per server stored in MongoDB.
- **🛡️ Robust Error Handling**: Clean error messages and automatic cleanup.

## 🚀 Installation & Setup

### Prerequisites
- [Node.js](https://nodejs.org/) v18 or higher
- [MongoDB](https://www.mongodb.com/) (Local or Atlas)
- A [Lavalink](https://github.com/lavalink-devs/Lavalink) server

### Steps
1. **Clone the repository**
   ```bash
   git clone https://github.com/WangYi/animal-music-client-ts.git
   cd animal-music-client-ts
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configuration**
   Copy `config.example.json` to `config.json` and fill in your details:
   ```bash
   cp config.example.json config.json
   ```

   **`config.json` Example:**
   ```json
   {
       "app": {
           "token": "YOUR_DISCORD_BOT_TOKEN",
           "prefix": "!",
           "clientId": "YOUR_CLIENT_ID"
       },
       "lavalink": {
           "nodes": [
               {
                   "name": "Node 1",
                   "url": "localhost:2333",
                   "auth": "youshallnotpass",
                   "secure": false
               }
           ]
       },
       "mongodb": {
           "uri": "mongodb://localhost:27017/animal-music"
       },
       "websocket": {
           "url": "",
           "secret": ""
       }
   }
   ```

4. **Build the project**
   ```bash
   npm run build
   ```

5. **Start the bot**
   ```bash
   npm start
   ```

   *For development with auto-reload:*
   ```bash
   npm run dev
   ```

## 🎮 Commands

Bot supports both **Prefix** (default `!`) and **Slash Commands** (`/`).

| Command | Alias | Description |
| :--- | :--- | :--- |
| `/play <query>` | `p` | Play a song/playlist from URL or search query. |
| `/pause` | `resume` | Pause or resume playback. |
| `/skip` | `s`, `next` | Skip to the next song. |
| `/stop` | `dc`, `leave` | Stop playback and leave the voice channel. |
| `/queue` | `q` | View the current music queue. |
| `/loop <mode>` | `repeat` | Set loop mode (Track, Queue, Off). |
| `/shuffle` | - | Shuffle the current queue. |
| `/volume <0-100>` | `vol` | Adjust playback volume. |
| `/clear` | `cls` | Clear the entire queue. |
| `/ping` | - | Check bot latency. |
| `/prefix <new>` | `setprefix` | Change the bot's prefix for the server. |
| `/help` | `h` | Show list of commands. |

## 🛠️ Tech Stack
- **Language**: TypeScript
- **Framework**: Discord.js v14
- **Music Engine**: Kazagumo (Lavalink Wrapper)
- **Database**: Mongoose (MongoDB)
- **Logger**: Winston

## 🤝 Contributing
Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License
This project is licensed under the MIT License.

---
*Music comes first, love follows 💖*
