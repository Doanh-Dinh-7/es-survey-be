# Slack App Configuration Guide (Socket Mode)

## 1. Socket Mode Setup

### Bước 1: Enable Socket Mode
1. Vào https://api.slack.com/apps
2. Chọn app của bạn
3. Vào tab **"Socket Mode"**
4. Bật toggle **"Enable Socket Mode"**
5. Tạo App-Level Token với scope `connections:write`

### Bước 2: Event Subscriptions (Không cần Request URL)
1. Vào tab **"Event Subscriptions"**
2. Bật toggle **"Enable Events"**
3. **KHÔNG cần nhập Request URL** (Socket Mode tự động handle)

### Bước 3: Subscribe to Bot Events
Thêm các events sau:

**Bot Events:**
- `message.channels` - Khi có tin nhắn trong public channels
- `message.im` - Khi có tin nhắn DM
- `app_mention` - Khi bot được mention
- `app_home_opened` - Khi user mở app home

**User Events:**
- `message.im` - Khi user gửi DM

### Bước 4: Interactivity (Không cần Request URL)
Vào tab **"Interactivity & Shortcuts"**:
1. Bật **"Interactivity"**
2. **KHÔNG cần nhập Request URL** (Socket Mode tự động handle)

## 2. OAuth & Permissions

### Bot Token Scopes
Thêm các scopes sau:
- `chat:write` - Gửi tin nhắn
- `chat:write.public` - Gửi tin nhắn trong public channels
- `views:open` - Mở modals
- `users:read` - Đọc thông tin user
- `users:read.email` - Đọc email của user
- `channels:read` - Đọc thông tin channels
- `commands` - Sử dụng slash commands

### App-Level Token Scopes
- `connections:write` - Cho Socket Mode

## 3. Environment Variables

Thêm vào file `.env`:
```env
SLACK_APP_TOKEN=xapp-...  # App-Level Token
SLACK_BOT_TOKEN=xoxb-...  # Bot User OAuth Token
SLACK_SIGNING_SECRET=...  # Signing Secret
SLACK_MAIN_CHANNEL_ID=C091RQVTKQA
API_BASE_URL=http://localhost:3000
```

## 4. Socket Mode vs HTTP Webhooks

### Socket Mode (Đang sử dụng):
- ✅ Không cần public HTTPS endpoint
- ✅ Không cần Request URL
- ✅ Tự động reconnect
- ✅ Dễ dàng test locally
- ✅ Ít phức tạp hơn

### HTTP Webhooks (Không sử dụng):
- ❌ Cần public HTTPS endpoint
- ❌ Cần Request URL
- ❌ Cần handle reconnect
- ❌ Khó test locally

## 5. Testing

### Test Socket Mode Connection
1. Khởi động app
2. Kiểm tra log: "⚡️ Slack app is running with Socket Mode!"
3. Kiểm tra kết nối trong Slack App Dashboard

### Test Survey Modal
1. Gửi survey notification với button "Take Survey in Slack"
2. Click button để mở modal
3. Fill survey và submit
4. Kiểm tra response trong database

## 6. Troubleshooting

### Lỗi thường gặp:
1. **"Socket Mode connection failed"** - Kiểm tra SLACK_APP_TOKEN
2. **"Modal not opening"** - Kiểm tra trigger_id và views:open scope
3. **"Event not received"** - Kiểm tra Event Subscriptions

### Debug:
- Kiểm tra logs trong console
- Verify App-Level Token có scope `connections:write`
- Kiểm tra Bot Token có đủ scopes cần thiết 