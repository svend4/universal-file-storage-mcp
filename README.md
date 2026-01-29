# 🗄️ Universal File Storage MCP Server

Универсальный MCP сервер для доступа к файлам через Claude AI на **ЛЮБОЙ платформе**:
- 💻 Windows, macOS, Linux
- 📱 Android устройства
- 🌐 NAS (сетевые хранилища)
- ☁️ Облачные хранилища (WebDAV, S3)

## 🎯 Возможности

✅ **Полнотекстовый поиск** - ищите в содержимом файлов, а не только по именам
✅ **OCR для скриншотов** - автоматическое распознавание текста на изображениях
✅ **Мультиплатформенность** - работает везде где есть Node.js
✅ **Поддержка NAS** - подключение к сетевым хранилищам через SMB/NFS
✅ **Облачные хранилища** - WebDAV, S3 и другие
✅ **Android** - доступ к файлам на телефоне через ADB
✅ **Унифицированный API** - один интерфейс для всех источников

---

## 📋 Требования

### Общие
- Node.js >= 18.0.0
- npm или yarn

### Для OCR (опционально)
- Tesseract OCR (для распознавания текста на изображениях)

### Для NAS (опционально)
- Linux: `cifs-utils` для монтирования SMB
- macOS: встроенная поддержка SMB
- Windows: встроенная поддержка UNC путей

### Для Android (опционально)
- Android Debug Bridge (ADB)

---

## 🚀 Быстрый старт

### 1. Установка

```bash
# Клонирование/создание директории
mkdir universal-file-storage-mcp
cd universal-file-storage-mcp

# Установка зависимостей
npm install

# Компиляция TypeScript
npm run build
```

### 2. Конфигурация

Отредактируйте файл `src/index.ts`, секцию `STORAGES`:

```typescript
const STORAGES: StorageConfig[] = [
  {
    id: "my-windows-docs",
    type: "local",
    platform: "windows",
    path: "D:\\Documents",  // ВАШ ПУТЬ
    enabled: true           // Включить это хранилище
  },
  {
    id: "my-nas",
    type: "nas",
    platform: "linux",
    path: "//192.168.1.5/shared",  // IP и путь к NAS
    credentials: {
      username: "admin",
      password: process.env.NAS_PASSWORD || ""
    },
    enabled: true
  }
  // Добавьте свои хранилища...
];
```

### 3. Переменные окружения

Создайте файл `.env`:

```bash
# Пароли для хранилищ
NAS_PASSWORD=your_nas_password
CLOUD_PASSWORD=your_cloud_password

# Порт сервера
PORT=3000
```

### 4. Запуск

```bash
# Продакшн
npm start

# Разработка (с hot reload)
npm run dev
```

Сервер запустится на `http://localhost:3000`

---

## 🔧 Настройка для разных платформ

### Windows

#### Локальные диски
```typescript
{
  id: "windows-c",
  type: "local",
  platform: "windows",
  path: "C:\\Users\\Username\\Documents",
  enabled: true
}
```

#### Сетевые диски (UNC paths)
```typescript
{
  id: "network-share",
  type: "nas",
  platform: "windows",
  path: "\\\\192.168.1.5\\shared",
  credentials: {
    username: "user",
    password: process.env.NAS_PASSWORD
  },
  enabled: true
}
```

---

### Linux

#### Локальные директории
```typescript
{
  id: "linux-home",
  type: "local",
  platform: "linux",
  path: "/home/max/documents",
  enabled: true
}
```

#### NAS через CIFS/SMB

1. Установите необходимые пакеты:
```bash
# Ubuntu/Debian
sudo apt-get install cifs-utils

# Fedora/RHEL
sudo yum install cifs-utils
```

2. Создайте точку монтирования:
```bash
sudo mkdir -p /mnt/nas
```

3. Конфигурация:
```typescript
{
  id: "nas-storage",
  type: "nas",
  platform: "linux",
  path: "//192.168.1.5/shared",
  credentials: {
    username: "admin",
    password: process.env.NAS_PASSWORD
  },
  enabled: true
}
```

**Важно**: Убедитесь что у пользователя есть права sudo для монтирования, или настройте `/etc/fstab`:

```bash
# /etc/fstab
//192.168.1.5/shared /mnt/nas cifs username=admin,password=***,uid=1000,gid=1000 0 0
```

---

### macOS

#### Локальные директории
```typescript
{
  id: "macos-documents",
  type: "local",
  platform: "macos",
  path: "/Users/max/Documents",
  enabled: true
}
```

#### Подключение к NAS
macOS имеет встроенную поддержку SMB. Подключите через Finder:
1. Cmd+K → `smb://192.168.1.5/shared`
2. Введите логин/пароль
3. Используйте путь: `/Volumes/shared`

```typescript
{
  id: "nas-macos",
  type: "local",  // После монтирования через Finder
  platform: "macos",
  path: "/Volumes/shared",
  enabled: true
}
```

---

### Android

#### Через ADB (Android Debug Bridge)

1. Установите ADB:

```bash
# Ubuntu/Debian
sudo apt-get install android-tools-adb

# macOS (через Homebrew)
brew install android-platform-tools

# Windows
# Скачайте с https://developer.android.com/studio/releases/platform-tools
```

2. Включите USB отладку на Android:
   - Settings → About Phone → Tap "Build Number" 7 times
   - Settings → Developer Options → Enable "USB Debugging"

3. Подключите устройство и проверьте:
```bash
adb devices
```

4. Конфигурация:
```typescript
{
  id: "android-phone",
  type: "android",
  platform: "android",
  path: "/storage/emulated/0/Documents",
  enabled: true
}
```

#### Через HTTP API (альтернатива)

Установите на Android приложение типа "Simple HTTP Server" и используйте cloud-тип:

```typescript
{
  id: "android-http",
  type: "cloud",
  platform: "android",
  path: "/",
  credentials: {
    url: "http://192.168.1.100:8080",
    username: "",
    password: ""
  },
  enabled: true
}
```

---

### NAS устройства

#### Synology / QNAP / любой NAS

**Вариант 1: Прямое монтирование (рекомендуется)**

```typescript
{
  id: "synology-main",
  type: "nas",
  platform: "linux",
  path: "//192.168.1.10/volume1",
  credentials: {
    username: "admin",
    password: process.env.NAS_PASSWORD
  },
  enabled: true
}
```

**Вариант 2: Запуск MCP сервера НА самом NAS**

1. Установите Node.js на NAS (через Package Center или SSH)
2. Скопируйте проект на NAS
3. Запустите как обычный сервер

```typescript
// Конфиг на самом NAS
{
  id: "nas-local",
  type: "local",
  platform: "linux",
  path: "/volume1/shared",
  enabled: true
}
```

**Преимущества запуска на NAS:**
- ⚡ Быстрый доступ к файлам
- 🔄 Работает 24/7
- 🌐 Доступ из любой точки сети

---

### Облачные хранилища

#### WebDAV (Nextcloud, ownCloud, etc.)

```typescript
{
  id: "nextcloud",
  type: "cloud",
  platform: "linux",
  path: "/remote.php/dav/files/username",
  credentials: {
    url: "https://cloud.example.com",
    username: "max",
    password: process.env.CLOUD_PASSWORD
  },
  enabled: true
}
```

#### Yandex.Disk через WebDAV

```typescript
{
  id: "yandex-disk",
  type: "cloud",
  platform: "linux",
  path: "/",
  credentials: {
    url: "https://webdav.yandex.ru",
    username: "your-email@yandex.ru",
    password: process.env.YANDEX_PASSWORD
  },
  enabled: true
}
```

---

## 🔌 Подключение к Claude

### Через Claude Desktop App

1. Отредактируйте конфиг Claude:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "file-storage": {
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

2. Перезапустите Claude Desktop

### Через API

```python
import anthropic

client = anthropic.Anthropic(api_key="your-api-key")

message = client.messages.create(
    model="claude-sonnet-4-5-20250929",
    max_tokens=1024,
    mcp_servers=[
        {
            "type": "url",
            "url": "http://localhost:3000/mcp",
            "name": "file-storage"
        }
    ],
    messages=[{
        "role": "user",
        "content": "Найди все файлы содержащие слово 'бюджет'"
    }]
)
```

---

## 💡 Примеры использования

### 1. Поиск по всем хранилищам

```
Пользователь → Claude:
"Найди все упоминания проекта X во всех моих файлах"

Claude использует: search_files
{
  "query": "проект X",
  "max_results": 50
}

Результат: Найдено 15 файлов на Windows (3), NAS (8), Android (4)
```

### 2. OCR скриншота

```
Пользователь → Claude:
"Прочитай текст со скриншота screenshot-2024.png на телефоне"

Claude использует: read_file
{
  "storage_id": "android-phone",
  "file_path": "/Screenshots/screenshot-2024.png",
  "extract_text": true
}

Результат: Извлеченный текст из изображения
```

### 3. Поиск только в NAS

```
Пользователь → Claude:
"Найди все markdown файлы с TODO на NAS"

Claude использует: search_files
{
  "query": "TODO",
  "storage_ids": ["nas-storage"],
  "file_types": [".md"]
}
```

### 4. Список файлов

```
Пользователь → Claude:
"Покажи что у меня в папке Documents на Windows"

Claude использует: list_files
{
  "storage_id": "windows-local",
  "directory": "/Documents"
}
```

---

## 🛡️ Безопасность

### Рекомендации

1. **Пароли**: Используйте `.env` файл, НИКОГДА не хардкодьте пароли
2. **Доступ**: Ограничьте доступ к MCP серверу (firewall, localhost only)
3. **HTTPS**: Для удаленного доступа используйте HTTPS + reverse proxy
4. **Права**: Запускайте сервер от пользователя с минимальными правами

### Пример Nginx reverse proxy с HTTPS

```nginx
server {
    listen 443 ssl;
    server_name mcp.example.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location /mcp {
        proxy_pass http://localhost:3000/mcp;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## 📊 Архитектура

```
┌──────────────────────────────────────────────────────┐
│                    Claude AI                         │
└────────────────────┬─────────────────────────────────┘
                     │ MCP Protocol (HTTP/SSE)
                     ↓
┌──────────────────────────────────────────────────────┐
│          Universal File Storage MCP Server           │
│  ┌────────────────────────────────────────────────┐  │
│  │  Tools:                                        │  │
│  │  • list_storages  • read_file                 │  │
│  │  • search_files   • list_files                │  │
│  └────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────┐  │
│  │  Storage Adapters Layer                        │  │
│  │  ├─ LocalAdapter                               │  │
│  │  ├─ NasAdapter (SMB/NFS)                       │  │
│  │  ├─ CloudAdapter (WebDAV/S3)                   │  │
│  │  └─ AndroidAdapter (ADB)                       │  │
│  └────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────┐  │
│  │  Features:                                     │  │
│  │  • Full-text Search                            │  │
│  │  • OCR Engine (Tesseract.js)                   │  │
│  │  • Content Indexing                            │  │
│  └────────────────────────────────────────────────┘  │
└────────────────────┬─────────────────────────────────┘
                     │
      ┌──────────────┼──────────────┐
      │              │              │
      ↓              ↓              ↓
┌──────────┐  ┌──────────┐  ┌──────────┐
│ Windows  │  │   NAS    │  │  Cloud   │
│  C:\...  │  │192.168.1.5│  │ WebDAV   │
└──────────┘  └──────────┘  └──────────┘
      │              │              │
      ↓              ↓              ↓
┌──────────┐  ┌──────────┐  ┌──────────┐
│  Linux   │  │ Android  │  │  macOS   │
│/home/... │  │/storage/.│  │~/Docs/.. │
└──────────┘  └──────────┘  └──────────┘
```

---

## 🐛 Troubleshooting

### Проблема: "Cannot mount NAS"

**Решение:**
```bash
# Проверьте доступность NAS
ping 192.168.1.5

# Проверьте доступ к SMB
smbclient -L //192.168.1.5 -U username

# Проверьте права sudo
sudo mount --help
```

### Проблема: "ADB device not found"

**Решение:**
```bash
# Проверьте подключение
adb devices

# Перезапустите ADB server
adb kill-server
adb start-server

# Проверьте USB Debugging на телефоне
```

### Проблема: "OCR не работает"

**Решение:**
```bash
# Установите Tesseract
# Ubuntu
sudo apt-get install tesseract-ocr tesseract-ocr-rus

# macOS
brew install tesseract tesseract-lang

# Windows
# Скачайте с https://github.com/UB-Mannheim/tesseract/wiki
```

### Проблема: "Out of memory" при поиске

**Решение:**
Ограничьте количество файлов или добавьте фильтры:
```typescript
// В коде сервера
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_SEARCH_FILES = 1000; // макс файлов для сканирования
```

---

## 🚀 Расширенные возможности

### 1. Запуск на NAS 24/7

Создайте systemd service на NAS:

```bash
# /etc/systemd/system/file-mcp.service
[Unit]
Description=Universal File Storage MCP Server
After=network.target

[Service]
Type=simple
User=admin
WorkingDirectory=/volume1/mcp-server
ExecStart=/usr/bin/node dist/index.js
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Активация:
```bash
sudo systemctl enable file-mcp
sudo systemctl start file-mcp
```

### 2. Удаленный доступ через VPN

```
┌─────────┐    VPN     ┌─────────┐
│  Claude │◄──────────►│   NAS   │
│ (mobile)│  Wireguard │(192.168.│
└─────────┘            │  1.10)  │
                       └─────────┘
```

### 3. Кластер MCP серверов

Для очень больших объемов данных - запустите несколько MCP серверов:

```
Claude → Load Balancer → MCP Server 1 (Windows)
                      → MCP Server 2 (NAS)
                      → MCP Server 3 (Cloud)
```

---

## 📝 Лицензия

MIT

## 🤝 Вклад

Pull requests приветствуются!

## 💬 Поддержка

Создайте issue на GitHub или напишите в Telegram: @your_username

---

## 🎉 Готово!

Теперь у вас есть **полный доступ ко всем вашим файлам через Claude AI** - 
будь то Windows диск, NAS хранилище, облако или Android телефон! 🚀
