# 🛠️ Дополнительные скрипты для Termux

## Скрипты в проекте

После установки у вас будут следующие скрипты:

### 1. `start.sh` - Запуск сервера

```bash
cd ~/universal-file-storage-mcp
./start.sh
```

**Что делает:**
- Запускает MCP сервер
- Выводит логи в консоль

### 2. `stop.sh` - Остановка сервера

```bash
cd ~/universal-file-storage-mcp
./stop.sh
```

**Что делает:**
- Находит процесс сервера
- Останавливает его

### 3. `restart.sh` - Перезапуск сервера

```bash
cd ~/universal-file-storage-mcp
./restart.sh
```

**Что делает:**
- Останавливает сервер
- Ждёт 2 секунды
- Запускает снова

### 4. `status.sh` - Проверка статуса

```bash
cd ~/universal-file-storage-mcp
./status.sh
```

**Что делает:**
- Проверяет запущен ли сервер
- Показывает PID процесса
- Показывает URL доступа

---

## Дополнительные полезные команды

### Проверка логов автозапуска

```bash
cat ~/mcp-server-boot.log
```

или с постоянным обновлением:

```bash
tail -f ~/mcp-server-boot.log
```

### Проверка использования ресурсов

```bash
# Установить htop
pkg install htop

# Запустить
htop
```

### Проверка сетевого подключения

```bash
# IP адрес
ifconfig wlan0

# или
ip addr show wlan0

# Открытые порты
netstat -tulpn | grep 3000

# Проверка доступности сервера
curl http://localhost:3000
```

### Очистка и переустановка

```bash
# Удалить проект
cd ~
rm -rf universal-file-storage-mcp

# Переустановить
curl -fsSL https://raw.githubusercontent.com/YOUR_USERNAME/universal-file-storage-mcp/main/install-termux.sh | bash
```

---

## Создание своих скриптов

### Скрипт обновления с GitHub

Создайте `~/universal-file-storage-mcp/update.sh`:

```bash
#!/data/data/com.termux/files/usr/bin/bash

echo "Updating MCP Server from GitHub..."

cd ~/universal-file-storage-mcp

# Остановка сервера
./stop.sh

# Сохранение .env
cp .env .env.backup

# Обновление кода
git pull origin main

# Восстановление .env
mv .env.backup .env

# Установка зависимостей
npm install

# Компиляция
npm run build

# Запуск
./start.sh

echo "Update complete!"
```

Сделайте исполняемым:
```bash
chmod +x ~/universal-file-storage-mcp/update.sh
```

### Скрипт резервного копирования конфигурации

Создайте `~/universal-file-storage-mcp/backup-config.sh`:

```bash
#!/data/data/com.termux/files/usr/bin/bash

BACKUP_DIR="$HOME/mcp-backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

mkdir -p "$BACKUP_DIR"

echo "Creating backup..."

# Backup .env
cp .env "$BACKUP_DIR/.env.$TIMESTAMP"

# Backup src/index.ts (если изменяли конфигурацию)
cp src/index.ts "$BACKUP_DIR/index.ts.$TIMESTAMP"

echo "Backup saved to: $BACKUP_DIR"
ls -lh "$BACKUP_DIR"
```

### Скрипт мониторинга

Создайте `~/universal-file-storage-mcp/monitor.sh`:

```bash
#!/data/data/com.termux/files/usr/bin/bash

while true; do
    clear
    echo "=== MCP Server Monitor ==="
    echo "$(date)"
    echo ""
    
    # Статус сервера
    if pgrep -f "node dist/index.js" > /dev/null; then
        echo "✓ Server: RUNNING"
        PID=$(pgrep -f "node dist/index.js")
        echo "  PID: $PID"
        
        # Использование памяти
        MEM=$(ps -p $PID -o rss= | awk '{printf "%.1f MB", $1/1024}')
        echo "  Memory: $MEM"
        
        # CPU (приблизительно)
        CPU=$(ps -p $PID -o %cpu= | awk '{print $1"%"}')
        echo "  CPU: $CPU"
    else
        echo "✗ Server: NOT RUNNING"
    fi
    
    echo ""
    echo "Refresh in 5 seconds... (Ctrl+C to exit)"
    sleep 5
done
```

### Скрипт уведомлений

Для этого нужен Termux:API:

```bash
pkg install termux-api
```

Создайте `~/universal-file-storage-mcp/notify.sh`:

```bash
#!/data/data/com.termux/files/usr/bin/bash

# Получаем статус
if pgrep -f "node dist/index.js" > /dev/null; then
    IP=$(ifconfig wlan0 2>/dev/null | grep 'inet ' | awk '{print $2}')
    
    termux-notification \
        --title "MCP Server Status" \
        --content "Running at http://${IP}:3000" \
        --priority high \
        --vibrate 200,100,200 \
        --led-color ff00ff \
        --button1 "Stop" \
        --button1-action "~/universal-file-storage-mcp/stop.sh"
else
    termux-notification \
        --title "MCP Server Status" \
        --content "Server is NOT running" \
        --priority high \
        --vibrate 500 \
        --button1 "Start" \
        --button1-action "~/universal-file-storage-mcp/start.sh"
fi
```

---

## Widget для Termux

Создайте shortcut на домашнем экране Android:

1. Установите **Termux:Widget** из F-Droid
2. Создайте папку:
```bash
mkdir -p ~/.shortcuts
```

3. Создайте шорткаты:

**~/.shortcuts/MCP Start**
```bash
#!/data/data/com.termux/files/usr/bin/bash
cd ~/universal-file-storage-mcp && ./start.sh
```

**~/.shortcuts/MCP Stop**
```bash
#!/data/data/com.termux/files/usr/bin/bash
cd ~/universal-file-storage-mcp && ./stop.sh
```

**~/.shortcuts/MCP Status**
```bash
#!/data/data/com.termux/files/usr/bin/bash
cd ~/universal-file-storage-mcp && ./status.sh
read -p "Press Enter to exit..."
```

Сделайте исполняемыми:
```bash
chmod +x ~/.shortcuts/*
```

Теперь можно добавить виджет Termux на домашний экран и запускать команды одним тапом!

---

## Планировщик задач (cron в Termux)

Установка cronie:
```bash
pkg install cronie
```

Запуск cron демона:
```bash
crond
```

Редактирование crontab:
```bash
crontab -e
```

### Примеры заданий:

**Перезапуск сервера каждый день в 3 утра:**
```
0 3 * * * /data/data/com.termux/files/home/universal-file-storage-mcp/restart.sh
```

**Проверка статуса каждый час и уведомление:**
```
0 * * * * /data/data/com.termux/files/home/universal-file-storage-mcp/notify.sh
```

**Резервное копирование конфигурации каждую неделю:**
```
0 2 * * 0 /data/data/com.termux/files/home/universal-file-storage-mcp/backup-config.sh
```

---

## Алиасы для быстрого доступа

Добавьте в `~/.bashrc`:

```bash
# MCP Server aliases
alias mcp-start='cd ~/universal-file-storage-mcp && ./start.sh'
alias mcp-stop='cd ~/universal-file-storage-mcp && ./stop.sh'
alias mcp-restart='cd ~/universal-file-storage-mcp && ./restart.sh'
alias mcp-status='cd ~/universal-file-storage-mcp && ./status.sh'
alias mcp-logs='tail -f ~/mcp-server-boot.log'
alias mcp-cd='cd ~/universal-file-storage-mcp'
```

Применить изменения:
```bash
source ~/.bashrc
```

Теперь можно просто писать:
```bash
mcp-start
mcp-status
mcp-logs
```

---

## Защита от потери заряда

Создайте скрипт `~/check-battery.sh`:

```bash
#!/data/data/com.termux/files/usr/bin/bash

pkg install termux-api

BATTERY_LEVEL=$(termux-battery-status | grep percentage | awk '{print $2}' | tr -d ',')

if [ "$BATTERY_LEVEL" -lt 20 ]; then
    # Батарея низкая - останавливаем сервер
    cd ~/universal-file-storage-mcp
    ./stop.sh
    
    termux-notification \
        --title "MCP Server Stopped" \
        --content "Battery low ($BATTERY_LEVEL%). Server stopped to save power."
fi
```

Добавьте в crontab (проверка каждые 30 минут):
```
*/30 * * * * /data/data/com.termux/files/home/check-battery.sh
```

---

## Удалённое управление через SSH

Установка OpenSSH в Termux:

```bash
pkg install openssh

# Установка пароля для текущего пользователя
passwd

# Запуск SSH сервера
sshd
```

Подключение с другого устройства:
```bash
ssh -p 8022 192.168.1.105
```

Теперь можно управлять сервером удалённо!

---

## Советы по оптимизации

### 1. Ограничение использования памяти Node.js

В `start.sh` добавьте:
```bash
node --max-old-space-size=512 dist/index.js
```

### 2. Логирование только ошибок

В `.env`:
```bash
LOG_LEVEL=error
```

### 3. Отключение ненужных хранилищ

В `src/index.ts` отключите ненужные:
```typescript
{
  id: "android-dcim",
  enabled: false  // Отключено
}
```

---

Теперь у вас есть полный набор инструментов для управления MCP сервером на Android! 🎉
