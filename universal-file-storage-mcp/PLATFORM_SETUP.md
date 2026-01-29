# 🖥️ Платформо-специфичная настройка

## Подробные инструкции по настройке для каждой ОС

---

## 🪟 Windows - Детальная настройка

### 1. Установка Node.js

1. Скачайте с https://nodejs.org (LTS версия)
2. Запустите установщик
3. Проверьте: `node --version` в PowerShell

### 2. Локальные пути

Windows использует обратные слеши `\`. В конфигурации используйте двойные:

```typescript
{
  id: "windows-documents",
  type: "local",
  platform: "windows",
  path: "C:\\Users\\YourName\\Documents",  // Обратите внимание на \\
  enabled: true
}
```

**Популярные пути:**
- Документы: `C:\\Users\\%USERNAME%\\Documents`
- Рабочий стол: `C:\\Users\\%USERNAME%\\Desktop`
- Загрузки: `C:\\Users\\%USERNAME%\\Downloads`
- OneDrive: `C:\\Users\\%USERNAME%\\OneDrive`

### 3. Сетевые диски (UNC paths)

**Подключение постоянного сетевого диска:**

```cmd
net use Z: \\192.168.1.5\shared /user:admin password /persistent:yes
```

Затем в конфигурации:
```typescript
{
  id: "network-drive",
  type: "local",  // После маппинга как обычный диск
  platform: "windows",
  path: "Z:\\",
  enabled: true
}
```

**Или прямой UNC путь:**
```typescript
{
  id: "nas-direct",
  type: "nas",
  platform: "windows",
  path: "\\\\192.168.1.5\\shared",
  credentials: {
    username: "admin",
    password: process.env.NAS_PASSWORD
  },
  enabled: true
}
```

### 4. Запуск как Windows Service

Используйте `node-windows`:

```powershell
npm install -g node-windows
```

Создайте `install-service.js`:
```javascript
const Service = require('node-windows').Service;

const svc = new Service({
  name: 'File Storage MCP',
  description: 'Universal File Storage MCP Server',
  script: 'C:\\path\\to\\universal-file-storage-mcp\\dist\\index.js',
  env: [{
    name: "NODE_ENV",
    value: "production"
  }]
});

svc.on('install', () => {
  svc.start();
});

svc.install();
```

Запустите: `node install-service.js`

### 5. Firewall

Откройте порт 3000:
```powershell
New-NetFirewallRule -DisplayName "MCP Server" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
```

---

## 🐧 Linux - Детальная настройка

### 1. Установка зависимостей

#### Ubuntu/Debian
```bash
# Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Для NAS (SMB)
sudo apt-get install -y cifs-utils

# Для OCR
sudo apt-get install -y tesseract-ocr tesseract-ocr-rus tesseract-ocr-eng

# Для Android ADB
sudo apt-get install -y android-tools-adb
```

#### Fedora/RHEL/CentOS
```bash
# Node.js
sudo dnf install -y nodejs

# Для NAS
sudo dnf install -y cifs-utils

# Для OCR
sudo dnf install -y tesseract

# Для Android ADB
sudo dnf install -y android-tools
```

#### Arch Linux
```bash
sudo pacman -S nodejs npm cifs-utils tesseract tesseract-data-eng tesseract-data-rus android-tools
```

### 2. Монтирование NAS

#### Вариант A: Ручное монтирование
```bash
# Создать точку монтирования
sudo mkdir -p /mnt/nas

# Смонтировать
sudo mount -t cifs //192.168.1.5/shared /mnt/nas -o username=admin,password=yourpass,uid=$(id -u),gid=$(id -g)
```

#### Вариант B: Автомонтирование через fstab
```bash
# Создать файл с credentials
sudo nano /root/.smbcredentials
```

Содержимое:
```
username=admin
password=yourpassword
```

Защитить файл:
```bash
sudo chmod 600 /root/.smbcredentials
```

Добавить в `/etc/fstab`:
```
//192.168.1.5/shared /mnt/nas cifs credentials=/root/.smbcredentials,uid=1000,gid=1000,file_mode=0777,dir_mode=0777 0 0
```

Монтировать:
```bash
sudo mount -a
```

#### Вариант C: Использовать в конфигурации напрямую

Сервер сам смонтирует при необходимости (требуется sudo):
```typescript
{
  id: "nas-auto",
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

**Важно**: Добавьте в sudoers:
```bash
sudo visudo
```

Добавьте строку:
```
username ALL=(ALL) NOPASSWD: /bin/mount, /bin/umount
```

### 3. Systemd Service

Создайте `/etc/systemd/system/file-mcp.service`:

```ini
[Unit]
Description=Universal File Storage MCP Server
After=network.target
After=local-fs.target
# Если используется NAS - дождаться монтирования
After=mnt-nas.mount

[Service]
Type=simple
User=max
Group=max
WorkingDirectory=/home/max/universal-file-storage-mcp
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10

# Environment variables
Environment="NODE_ENV=production"
Environment="PORT=3000"
EnvironmentFile=/home/max/universal-file-storage-mcp/.env

# Limits
LimitNOFILE=65536

# Security
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=/home/max/universal-file-storage-mcp
ReadWritePaths=/mnt/nas

[Install]
WantedBy=multi-user.target
```

Активация:
```bash
sudo systemctl daemon-reload
sudo systemctl enable file-mcp
sudo systemctl start file-mcp
sudo systemctl status file-mcp
```

### 4. Автозапуск при входе (для desktop)

Создайте `~/.config/autostart/file-mcp.desktop`:

```ini
[Desktop Entry]
Type=Application
Name=File Storage MCP Server
Exec=/usr/bin/node /home/max/universal-file-storage-mcp/dist/index.js
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true
```

### 5. Логирование

```bash
# Просмотр логов systemd
sudo journalctl -u file-mcp -f

# Или сохранять в файл
# Добавьте в service:
StandardOutput=append:/var/log/file-mcp.log
StandardError=append:/var/log/file-mcp-error.log
```

---

## 🍎 macOS - Детальная настройка

### 1. Установка через Homebrew

```bash
# Установить Homebrew (если нет)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Node.js
brew install node

# Tesseract для OCR
brew install tesseract tesseract-lang

# Android ADB (опционально)
brew install android-platform-tools
```

### 2. Подключение к NAS

macOS имеет отличную встроенную поддержку SMB:

#### Через Finder (GUI)
1. Finder → Go → Connect to Server (Cmd+K)
2. Введите: `smb://192.168.1.5/shared`
3. Введите логин/пароль
4. Выберите том

После монтирования доступно по пути: `/Volumes/shared`

```typescript
{
  id: "nas-macos",
  type: "local",
  platform: "macos",
  path: "/Volumes/shared",
  enabled: true
}
```

#### Через командную строку
```bash
# Монтирование
mkdir -p ~/mnt/nas
mount_smbfs //admin:password@192.168.1.5/shared ~/mnt/nas

# Размонтирование
umount ~/mnt/nas
```

### 3. LaunchAgent для автозапуска

Создайте `~/Library/LaunchAgents/com.file-mcp.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.file-mcp</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>/Users/max/universal-file-storage-mcp/dist/index.js</string>
    </array>
    <key>WorkingDirectory</key>
    <string>/Users/max/universal-file-storage-mcp</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/file-mcp.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/file-mcp-error.log</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>NODE_ENV</key>
        <string>production</string>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin</string>
    </dict>
</dict>
</plist>
```

Загрузка:
```bash
launchctl load ~/Library/LaunchAgents/com.file-mcp.plist
launchctl start com.file-mcp
```

Проверка:
```bash
launchctl list | grep file-mcp
```

---

## 📱 Android - Детальная настройка

### Метод 1: ADB через USB

1. **Включить режим разработчика:**
   - Settings → About Phone
   - Тапнуть "Build Number" 7 раз

2. **Включить USB Debugging:**
   - Settings → Developer Options
   - Enable "USB Debugging"

3. **Подключить к компьютеру:**
   ```bash
   # Проверить подключение
   adb devices
   
   # Должно показать что-то вроде:
   # List of devices attached
   # ABC123456789    device
   ```

4. **Тестовые команды:**
   ```bash
   # Список файлов
   adb shell ls -la /storage/emulated/0/Documents
   
   # Чтение файла
   adb shell cat /storage/emulated/0/Documents/test.txt
   
   # Pull файла на компьютер
   adb pull /storage/emulated/0/Documents/test.txt ./
   ```

### Метод 2: ADB через WiFi

1. **Подключить USB и включить WiFi ADB:**
   ```bash
   adb tcpip 5555
   ```

2. **Узнать IP Android устройства:**
   - Settings → About Phone → Status → IP address
   - Или: `adb shell ip addr show wlan0`

3. **Отключить USB и подключиться по WiFi:**
   ```bash
   adb connect 192.168.1.100:5555
   ```

4. **Проверить:**
   ```bash
   adb devices
   # 192.168.1.100:5555    device
   ```

5. **В .env файле:**
   ```bash
   ANDROID_ADB_HOST=192.168.1.100:5555
   ```

### Метод 3: HTTP Server на Android

Установите приложение "Simple HTTP Server" из Play Store:

1. Установите и запустите
2. Выберите корневую папку (Documents)
3. Запустите сервер
4. Узнайте адрес (например, `http://192.168.1.100:8080`)

Конфигурация:
```typescript
{
  id: "android-http",
  type: "cloud",
  platform: "android",
  path: "/",
  credentials: {
    url: "http://192.168.1.100:8080",
    username: "",  // Если установлен пароль в приложении
    password: ""
  },
  enabled: true
}
```

### Метод 4: Termux + Node.js (запуск сервера НА Android)

1. **Установить Termux** из F-Droid (не из Play Store!)

2. **В Termux:**
   ```bash
   # Обновить пакеты
   pkg update && pkg upgrade
   
   # Установить Node.js
   pkg install nodejs-lts
   
   # Установить git
   pkg install git
   
   # Клонировать проект
   cd ~/
   git clone <your-repo>
   cd universal-file-storage-mcp
   
   # Установить зависимости
   npm install
   npm run build
   
   # Запустить
   npm start
   ```

3. **Автозапуск при загрузке Android:**
   ```bash
   # Создать startup script
   nano ~/.termux/boot/start-mcp.sh
   ```
   
   Содержимое:
   ```bash
   #!/data/data/com.termux/files/usr/bin/bash
   cd ~/universal-file-storage-mcp
   node dist/index.js
   ```
   
   Сделать исполняемым:
   ```bash
   chmod +x ~/.termux/boot/start-mcp.sh
   ```

### Популярные пути на Android:

```typescript
const ANDROID_PATHS = {
  // Основное хранилище
  internal: "/storage/emulated/0",
  
  // Папки
  documents: "/storage/emulated/0/Documents",
  downloads: "/storage/emulated/0/Download",
  dcim: "/storage/emulated/0/DCIM",
  pictures: "/storage/emulated/0/Pictures",
  screenshots: "/storage/emulated/0/Pictures/Screenshots",
  
  // SD карта (если есть)
  sdcard: "/storage/XXXX-XXXX",  // ID зависит от карты
  
  // Termux home (если запускаете в Termux)
  termux: "/data/data/com.termux/files/home"
};
```

---

## 🌐 NAS - Специфичные настройки

### Synology NAS

1. **Установка Node.js:**
   - Package Center → All Packages
   - Поиск "Node.js"
   - Install

2. **SSH доступ:**
   - Control Panel → Terminal & SNMP
   - Enable SSH service

3. **Подключение:**
   ```bash
   ssh admin@192.168.1.10
   ```

4. **Установка сервера:**
   ```bash
   cd /volume1/docker/mcp-server
   git clone <repo>
   cd universal-file-storage-mcp
   npm install
   npm run build
   ```

5. **Автозапуск через Task Scheduler:**
   - Control Panel → Task Scheduler
   - Create → Triggered Task → User-defined script
   - Boot-up
   - Script: `cd /volume1/docker/mcp-server && node dist/index.js`

### QNAP NAS

1. **Установка Node.js:**
   - App Center → Search "Entware"
   - Install Entware

2. **SSH и установка:**
   ```bash
   ssh admin@192.168.1.10
   opkg update
   opkg install node
   opkg install node-npm
   ```

3. **Остальное аналогично Synology**

### Готовые контейнеры для NAS

Создайте `Dockerfile`:

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist ./dist
COPY .env .env

EXPOSE 3000

CMD ["node", "dist/index.js"]
```

Сборка и запуск:
```bash
docker build -t file-mcp .
docker run -d --name file-mcp \
  -p 3000:3000 \
  -v /volume1/data:/data \
  --restart unless-stopped \
  file-mcp
```

---

## 🔐 Безопасность по платформам

### Windows
- Запускать от ограниченного пользователя
- Windows Firewall для ограничения доступа
- BitLocker для шифрования дисков с данными

### Linux
- SELinux или AppArmor profiles
- Iptables для фильтрации
- LUKS encryption для чувствительных данных

### macOS
- FileVault для шифрования диска
- macOS Firewall
- Keychain для хранения паролей

### Android
- VPN для удаленного доступа
- Не открывайте порты напрямую в интернет
- Используйте шифрование устройства

---

## 📊 Мониторинг

### Linux - systemd журналы
```bash
journalctl -u file-mcp -f --since "1 hour ago"
```

### Windows - Event Viewer
```powershell
Get-EventLog -LogName Application -Source "File Storage MCP" -Newest 50
```

### macOS - Console.app
```bash
log stream --predicate 'processImagePath contains "node"' --info
```

---

Теперь у вас есть полная платформо-специфичная документация! 🎉
