#!/data/data/com.termux/files/usr/bin/bash

################################################################################
# Universal File Storage MCP Server - Termux Installation Script
# 
# Автоматическая установка MCP сервера на Android через Termux
# 
# Использование:
#   curl -fsSL https://raw.githubusercontent.com/YOUR_USERNAME/universal-file-storage-mcp/main/install-termux.sh | bash
################################################################################

set -e  # Остановка при ошибке

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Функции для красивого вывода
print_header() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

# Проверка что мы в Termux
check_termux() {
    if [ ! -d "$PREFIX" ]; then
        print_error "Этот скрипт предназначен только для Termux!"
        print_info "Скачайте Termux из F-Droid: https://f-droid.org"
        exit 1
    fi
    print_success "Termux обнаружен"
}

# Проверка доступа к хранилищу
check_storage_access() {
    print_info "Проверка доступа к хранилищу Android..."
    
    if [ ! -d "$HOME/storage/shared" ]; then
        print_warning "Нет доступа к хранилищу Android"
        print_info "Выполняется termux-setup-storage..."
        termux-setup-storage
        
        # Ждём подтверждения
        echo ""
        print_info "Пожалуйста, разрешите доступ к хранилищу в диалоге Android"
        read -p "Нажмите Enter после предоставления разрешения..."
        
        if [ ! -d "$HOME/storage/shared" ]; then
            print_error "Доступ к хранилищу не предоставлен!"
            exit 1
        fi
    fi
    
    print_success "Доступ к хранилищу Android получен"
}

# Обновление пакетов
update_packages() {
    print_info "Обновление списка пакетов..."
    pkg update -y
    print_success "Список пакетов обновлён"
}

# Установка зависимостей
install_dependencies() {
    print_info "Установка необходимых пакетов..."
    
    PACKAGES=(
        "nodejs-lts"
        "git"
        "wget"
        "curl"
    )
    
    for package in "${PACKAGES[@]}"; do
        if ! command -v ${package%-*} &> /dev/null; then
            print_info "Установка $package..."
            pkg install $package -y
            print_success "$package установлен"
        else
            print_success "$package уже установлен"
        fi
    done
}

# Клонирование проекта
clone_project() {
    print_info "Клонирование проекта с GitHub..."
    
    cd $HOME
    
    # Если папка уже существует, удаляем её
    if [ -d "universal-file-storage-mcp" ]; then
        print_warning "Проект уже существует, удаляем старую версию..."
        rm -rf universal-file-storage-mcp
    fi
    
    # Клонируем
    # ЗАМЕНИТЕ на ваш репозиторий!
    git clone https://github.com/YOUR_USERNAME/universal-file-storage-mcp.git
    
    cd universal-file-storage-mcp
    print_success "Проект склонирован"
}

# Установка npm зависимостей
install_npm_dependencies() {
    print_info "Установка npm зависимостей (это может занять несколько минут)..."
    
    cd $HOME/universal-file-storage-mcp
    npm install
    
    print_success "npm зависимости установлены"
}

# Создание конфигурации для Android
create_android_config() {
    print_info "Создание конфигурации для Android..."
    
    cd $HOME/universal-file-storage-mcp
    
    # Создаём .env файл
    cat > .env << 'EOF'
# Port configuration
PORT=3000

# Android storage paths
ANDROID_STORAGE_PATH=/data/data/com.termux/files/home/storage/shared

# Limits
MAX_FILE_SIZE_MB=10
MAX_SEARCH_RESULTS=50
CHARACTER_LIMIT=25000

# Logging
LOG_LEVEL=info

# Tesseract languages (for OCR)
TESSERACT_LANGUAGES=eng+rus
EOF
    
    print_success "Конфигурация создана"
}

# Создание упрощённой конфигурации для Termux
create_termux_config() {
    print_info "Настройка конфигурации хранилищ для Android..."
    
    # Создаём файл с Android-специфичной конфигурацией
    cat > src/termux-config.ts << 'EOF'
// Конфигурация хранилищ для Android/Termux
export const TERMUX_STORAGES = [
  {
    id: "android-internal",
    type: "local" as const,
    platform: "android" as const,
    path: "/data/data/com.termux/files/home/storage/shared",
    enabled: true
  },
  {
    id: "android-downloads",
    type: "local" as const,
    platform: "android" as const,
    path: "/data/data/com.termux/files/home/storage/downloads",
    enabled: true
  },
  {
    id: "android-dcim",
    type: "local" as const,
    platform: "android" as const,
    path: "/data/data/com.termux/files/home/storage/dcim",
    enabled: true
  },
  {
    id: "android-documents",
    type: "local" as const,
    platform: "android" as const,
    path: "/data/data/com.termux/files/home/storage/shared/Documents",
    enabled: true
  },
  {
    id: "android-pictures",
    type: "local" as const,
    platform: "android" as const,
    path: "/data/data/com.termux/files/home/storage/shared/Pictures",
    enabled: true
  }
];
EOF
    
    print_success "Termux конфигурация создана"
}

# Компиляция TypeScript
compile_typescript() {
    print_info "Компиляция TypeScript..."
    
    cd $HOME/universal-file-storage-mcp
    npm run build
    
    print_success "TypeScript скомпилирован"
}

# Создание скрипта автозапуска
create_autostart_script() {
    print_info "Настройка автозапуска при загрузке Android..."
    
    # Создаём директорию для boot скриптов
    mkdir -p $HOME/.termux/boot
    
    # Создаём скрипт
    cat > $HOME/.termux/boot/start-mcp.sh << 'EOF'
#!/data/data/com.termux/files/usr/bin/bash

################################################################################
# MCP Server Auto-start Script
# Автоматически запускается при загрузке Android (через Termux:Boot)
################################################################################

# Логирование
LOG_FILE="$HOME/mcp-server-boot.log"
exec 1>> "$LOG_FILE"
exec 2>&1

echo "======================================"
echo "$(date): Starting MCP Server on boot"
echo "======================================"

# Ждём подключения к сети (максимум 60 секунд)
echo "Waiting for network connection..."
for i in {1..60}; do
    if ping -c 1 8.8.8.8 &> /dev/null 2>&1; then
        echo "Network connected!"
        break
    fi
    echo "Attempt $i/60..."
    sleep 1
done

# Проверка подключения
if ! ping -c 1 8.8.8.8 &> /dev/null 2>&1; then
    echo "ERROR: No network connection after 60 seconds"
    echo "Server will NOT start without network"
    exit 1
fi

# Переход в директорию проекта
cd $HOME/universal-file-storage-mcp || {
    echo "ERROR: Project directory not found!"
    exit 1
}

# Проверка что Node.js установлен
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js not found!"
    echo "Please reinstall: pkg install nodejs-lts"
    exit 1
fi

# Проверка что проект скомпилирован
if [ ! -f "dist/index.js" ]; then
    echo "ERROR: Compiled code not found!"
    echo "Please run: npm run build"
    exit 1
fi

# Получение wake lock (не даст телефону уснуть)
if command -v termux-wake-lock &> /dev/null; then
    termux-wake-lock
    echo "Wake lock acquired"
fi

# Запуск сервера
echo "Starting MCP Server..."
node dist/index.js >> "$LOG_FILE" 2>&1 &
SERVER_PID=$!

echo "MCP Server started with PID: $SERVER_PID"
echo "======================================"
echo ""

# Отправка уведомления (если установлен termux-api)
if command -v termux-notification &> /dev/null; then
    # Получаем IP адрес
    IP_ADDR=$(ifconfig wlan0 2>/dev/null | grep 'inet ' | awk '{print $2}')
    
    termux-notification \
        --title "MCP Server Started" \
        --content "Server running at http://${IP_ADDR}:3000" \
        --priority high
fi

# Проверка через 5 секунд что сервер всё ещё работает
sleep 5
if ps -p $SERVER_PID > /dev/null; then
    echo "$(date): Server is running successfully"
else
    echo "$(date): ERROR - Server died after start!"
fi
EOF
    
    # Делаем скрипт исполняемым
    chmod +x $HOME/.termux/boot/start-mcp.sh
    
    print_success "Скрипт автозапуска создан"
    
    # Проверяем установлен ли Termux:Boot
    if [ ! -d "/data/data/com.termux.boot" ]; then
        print_warning "Termux:Boot не установлен!"
        print_info "Для автозапуска установите Termux:Boot из F-Droid"
        print_info "https://f-droid.org/packages/com.termux.boot"
    else
        print_success "Termux:Boot обнаружен - автозапуск настроен"
    fi
}

# Создание управляющих скриптов
create_management_scripts() {
    print_info "Создание управляющих скриптов..."
    
    cd $HOME/universal-file-storage-mcp
    
    # Скрипт запуска
    cat > start.sh << 'EOF'
#!/data/data/com.termux/files/usr/bin/bash
cd "$(dirname "$0")"
echo "Starting MCP Server..."
node dist/index.js
EOF
    
    # Скрипт остановки
    cat > stop.sh << 'EOF'
#!/data/data/com.termux/files/usr/bin/bash
echo "Stopping MCP Server..."
pkill -f "node dist/index.js"
echo "Server stopped"
EOF
    
    # Скрипт перезапуска
    cat > restart.sh << 'EOF'
#!/data/data/com.termux/files/usr/bin/bash
cd "$(dirname "$0")"
echo "Restarting MCP Server..."
./stop.sh
sleep 2
./start.sh
EOF
    
    # Скрипт проверки статуса
    cat > status.sh << 'EOF'
#!/data/data/com.termux/files/usr/bin/bash
if pgrep -f "node dist/index.js" > /dev/null; then
    PID=$(pgrep -f "node dist/index.js")
    IP=$(ifconfig wlan0 2>/dev/null | grep 'inet ' | awk '{print $2}')
    echo "✓ MCP Server is RUNNING"
    echo "  PID: $PID"
    echo "  URL: http://${IP}:3000"
    echo "  Local: http://localhost:3000"
else
    echo "✗ MCP Server is NOT running"
fi
EOF
    
    # Делаем скрипты исполняемыми
    chmod +x start.sh stop.sh restart.sh status.sh
    
    print_success "Управляющие скрипты созданы"
}

# Получение IP адреса
get_ip_address() {
    IP_ADDR=$(ifconfig wlan0 2>/dev/null | grep 'inet ' | awk '{print $2}')
    if [ -z "$IP_ADDR" ]; then
        IP_ADDR="unknown"
    fi
    echo "$IP_ADDR"
}

# Запуск сервера
start_server() {
    print_info "Запуск MCP Server..."
    
    cd $HOME/universal-file-storage-mcp
    
    # Запуск в фоне
    node dist/index.js > /dev/null 2>&1 &
    SERVER_PID=$!
    
    # Ждём 2 секунды
    sleep 2
    
    # Проверяем что процесс запустился
    if ps -p $SERVER_PID > /dev/null; then
        print_success "Сервер успешно запущен (PID: $SERVER_PID)"
        return 0
    else
        print_error "Не удалось запустить сервер"
        return 1
    fi
}

# Финальная информация
print_final_info() {
    IP_ADDR=$(get_ip_address)
    
    print_header "🎉 УСТАНОВКА ЗАВЕРШЕНА!"
    
    echo ""
    echo -e "${GREEN}✓ MCP Server успешно установлен и запущен!${NC}"
    echo ""
    echo -e "${BLUE}📍 Адреса доступа:${NC}"
    echo -e "   Локально:  ${GREEN}http://localhost:3000${NC}"
    echo -e "   В сети:    ${GREEN}http://${IP_ADDR}:3000${NC}"
    echo ""
    echo -e "${BLUE}🔧 Управление сервером:${NC}"
    echo -e "   Запуск:    ${YELLOW}~/universal-file-storage-mcp/start.sh${NC}"
    echo -e "   Остановка: ${YELLOW}~/universal-file-storage-mcp/stop.sh${NC}"
    echo -e "   Рестарт:   ${YELLOW}~/universal-file-storage-mcp/restart.sh${NC}"
    echo -e "   Статус:    ${YELLOW}~/universal-file-storage-mcp/status.sh${NC}"
    echo ""
    echo -e "${BLUE}📱 Автозапуск:${NC}"
    if [ -d "/data/data/com.termux.boot" ]; then
        echo -e "   ${GREEN}✓ Настроен${NC} - сервер будет запускаться при загрузке Android"
    else
        echo -e "   ${YELLOW}⚠ Не настроен${NC} - установите Termux:Boot из F-Droid"
        echo -e "   https://f-droid.org/packages/com.termux.boot"
    fi
    echo ""
    echo -e "${BLUE}📂 Доступные хранилища:${NC}"
    echo -e "   • android-internal (Внутреннее хранилище)"
    echo -e "   • android-downloads (Загрузки)"
    echo -e "   • android-dcim (Фото/Камера)"
    echo -e "   • android-documents (Документы)"
    echo -e "   • android-pictures (Изображения)"
    echo ""
    echo -e "${BLUE}🔗 Подключение к Claude:${NC}"
    echo -e "   Добавьте в конфиг Claude Desktop:"
    echo ""
    echo -e '   {
     "mcpServers": {
       "android-files": {
         "url": "http://'${IP_ADDR}':3000/mcp"
       }
     }
   }'
    echo ""
    echo -e "${BLUE}📚 Документация:${NC}"
    echo -e "   README:  ${YELLOW}~/universal-file-storage-mcp/README.md${NC}"
    echo -e "   Termux:  ${YELLOW}~/universal-file-storage-mcp/TERMUX_GUIDE.md${NC}"
    echo ""
    echo -e "${BLUE}📊 Проверка:${NC}"
    echo -e "   Откройте в браузере: ${GREEN}http://${IP_ADDR}:3000${NC}"
    echo -e "   Должны увидеть: ${GREEN}\"Universal File Storage MCP Server is running\"${NC}"
    echo ""
    echo -e "${GREEN}Спасибо за использование Universal File Storage MCP Server! 🚀${NC}"
    echo ""
}

################################################################################
# MAIN EXECUTION
################################################################################

main() {
    clear
    
    print_header "🚀 Universal File Storage MCP Server - Termux Installation"
    
    echo "Этот скрипт установит и настроит MCP Server на вашем Android устройстве"
    echo ""
    read -p "Нажмите Enter для продолжения или Ctrl+C для отмены..."
    
    # Проверки
    check_termux
    
    # Установка
    update_packages
    install_dependencies
    check_storage_access
    
    # Проект
    clone_project
    install_npm_dependencies
    create_android_config
    create_termux_config
    compile_typescript
    
    # Автозапуск
    create_autostart_script
    create_management_scripts
    
    # Запуск
    if start_server; then
        print_final_info
    else
        print_error "Установка завершена, но сервер не запустился"
        print_info "Попробуйте запустить вручную: cd ~/universal-file-storage-mcp && npm start"
    fi
}

# Запуск установки
main
