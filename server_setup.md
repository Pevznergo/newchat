# Настройка нового сервера (Ubuntu/Debian)

Этот гайд поможет настроить чистый сервер для развертывания ваших проектов (`ai-chatbot` и `aporto-ai-enhancer`).

## 1. Обновление системы и базовые утилиты

Сначала обновим списки пакетов и установим необходимые инструменты:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git unzip build-essential
```

## 2. Установка Node.js (версия 22)

Ваш проект использует актуальные версии библиотек, поэтому ставим Node.js 22 (LTS):

```bash
# Скачиваем скрипт установки NodeSource
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -

# Устанавливаем Node.js
sudo apt install -y nodejs

# Проверяем версии
node -v
npm -v
```

## 3. Установка менеджеров пакетов (PNPM и PM2)

Проект `newchat` использует `pnpm`. Также нам понадобится `pm2` для управления процессами.

```bash
# Устанавливаем pnpm глобально
sudo npm install -g pnpm

# Устанавливаем pm2 глобально
sudo npm install -g pm2

# Настраиваем автозапуск pm2 при перезагрузке сервера
pm2 startup
# (Скопируйте и выполните команду, которую выведет pm2)
```

## 4. Установка Nginx (Веб-сервер)

```bash
sudo apt install -y nginx

# Проверяем статус
sudo systemctl status nginx
```

## 5. Установка Redis

В `package.json` проекта `newchat` есть зависимость `redis`, поэтому сервер базы данных должен быть доступен (локально или удаленно). Если нужен локальный:

```bash
sudo apt install -y redis-server

# Включаем автозапуск
sudo systemctl enable redis-server
```

## 6. Базовая настройка Firewall (UFW)

Откроем порты для SSH (22), HTTP (80) и HTTPS (443):

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

## 7. Развертывание проектов (Пример)

### Краткий алгоритм действий:

1.  **Клонирование**:
    ```bash
    git clone <ссылка_на_ваш_репозиторий>
    cd <папка_проекта>
    ```

2.  **Установка зависимостей**:
    *   Для `newchat`: `pnpm install`
    *   Для `front`: `npm install` (или `pnpm`, если решите перейти)

3.  **Настройка переменных окружения**:
    Создайте файл `.env`:
    ```bash
    cp .env.example .env
    nano .env
    ```
    *Заполните ключи API, доступы к базе данных и т.д.*

4.  **Сборка**:
    *   `newchat`: `pnpm build`
    *   `front`: `npm run build`

5.  **Запуск через PM2**:

    *   Для `newchat` (порт по умолчанию 3000):
        ```bash
        pm2 start npm --name "newchat" -- start
        ```
    *   Для `front` (команда start использует порт 3001):
        ```bash
        pm2 start npm --name "front" -- start
        ```

    *   Сохранение списка процессов:
        ```bash
        pm2 save
        ```

## 8. Настройка Nginx (Reverse Proxy)

Создайте конфиг для вашего домена:

```bash
sudo nano /etc/nginx/sites-available/aporto.tech
```

Пример конфигурации (подставьте свои домены и порты):

```nginx
server {
    listen 80;
    server_name aporto.tech www.aporto.tech;

    location / {
        proxy_pass http://localhost:3000; # Порт newchat
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

server {
    listen 80;
    server_name app.aporto.tech; # Пример поддомена для второго приложения

    location / {
        proxy_pass http://localhost:3001; # Порт front
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Активируем сайт и проверяем конфиг:

```bash
sudo ln -s /etc/nginx/sites-available/aporto.tech /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## 9. Установка SSL (HTTPS)

Используем Certbot для получения бесплатных сертификатов Let's Encrypt:

```bash
sudo apt install -y certbot python3-certbot-nginx

# Получение сертификата (следуйте инструкциям на экране)
sudo certbot --nginx -d aporto.tech -d www.aporto.tech -d app.aporto.tech
```
