# Telegram-чат на GREEN-API

Простой веб-чат на React и TypeScript: текстовые сообщения отправляются и принимаются в Telegram через [GREEN-API](https://green-api.com/en/telegram/docs/api/sending/SendMessage/).

## Запуск

```bash
npm install
npm run dev
```

Откройте http://localhost:5173

## Как пользоваться

1. В консоли GREEN-API создайте инстанс Telegram и авторизуйте его QR-кодом.
2. На сайте введите `idInstance` и `apiTokenInstance` этого инстанса.
3. Укажите номер телефона получателя и создайте чат.
4. Напишите сообщение. Получатель отвечает в Telegram, ответ появляется в этом чате.

Если в инстансе заполнен webhook, нажмите «Включить получение». Инстанс перезапустится, после этого ответы начнут приходить через HTTP API: `receiveNotification` и `deleteNotification`.
