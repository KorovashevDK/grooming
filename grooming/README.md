# Grooming VK Mini App

Мини-приложение ВКонтакте для автоматизации работы груминг-салона.

Приложение объединяет три ключевые роли:
- `Клиент` — запись на услуги, работа с питомцами, история заказов
- `Грумер` — личные записи, смены, комментарии мастера, статистика
- `Администратор` — общее расписание, заказы, аналитика, управление сменами

## Возможности

### Клиент
- авторизация через `VK ID`
- привязка существующего офлайн-клиента к аккаунту VK
- создание и редактирование карточек питомцев
- запись на услуги с выбором:
  - питомца
  - услуг
  - даты
  - специалиста
  - времени
- расчёт итоговой стоимости по правилам салона
- просмотр истории заказов
- отмена активной записи

### Грумер
- просмотр своих записей
- разделение записей на:
  - требующие подтверждения
  - подтверждённые
- просмотр личного расписания
- добавление, редактирование и удаление своих смен
- подтверждение выполнения заказа
- сохранение комментария мастера
- просмотр личной статистики:
  - выручка
  - зарплата
  - к выплате
  - ожидаемая зарплата
  - статистика по месяцам

### Администратор
- просмотр общего обзора салона
- просмотр и фильтрация последних заказов
- просмотр общего расписания сотрудников
- фильтрация расписания по сотруднику, дате, роли и периоду
- добавление, редактирование и удаление смен сотрудников
- просмотр аналитики по выручке, зарплате и загрузке

## Бизнес-логика

### Авторизация
- вход строится на `VK ID`
- если пользователь найден в `Сотрудники`, ему доступны рабочие роли
- если пользователь найден в `Владельцы`, открывается клиентский раздел
- если пользователь новый, система предлагает завершить регистрацию
- если у одного человека несколько ролей, после входа показывается выбор раздела

### Запись на услуги
- услуги фильтруются по типу животного:
  - `dog`
  - `cat`
  - `all`
- слоты формируются только внутри доступной смены сотрудника
- запись не может выходить за границы рабочего времени
- итоговая стоимость зависит от:
  - базовой цены услуги
  - размера питомца
  - последнего визита
  - уровня грумера

### Расчёт зарплаты
- `Старший грумер` — `45%` от выполненных услуг
- `Грумер` — `35%`
- `Помощник грумера` — `25%`
- `Администратор` / `Управляющий` — `350 ₽ / час`
- `Кассир` — `250 ₽ / час`

## Технологический стек

### Frontend
- `React 18`
- `VKUI`
- `VK Bridge`
- `VK Mini Apps Router`
- `Vite`

### Backend
- `Node.js`
- `Express`
- `mssql`
- `JWT`
- `cors`
- `express-rate-limit`
- `winston`

### Infrastructure
- `VK Mini Apps Hosting`
- `Microsoft SQL Server`
- `Ubuntu VPS`
- `nginx`
- `pm2`

## Структура проекта

```text
grooming/
|- backend/
|  |- middleware/
|  |- routes/
|  |- app.js
|  |- db.js
|  |- package.json
|- public/
|- src/
|  |- api/
|  |- components/
|  |- contexts/
|  |- panels/
|  |- utils/
|  |- App.js
|  |- App.css
|  |- main.js
|- package.json
|- vite.config.js
|- vk-hosting-config.json
```

## Основные модули

### Frontend
- `src/App.js` — маршрутизация, вход, выбор роли
- `src/contexts/AuthContext.js` — хранение токена и пользователя
- `src/api/client.js` — базовый HTTP-клиент
- `src/api/endpoints.js` — набор API-запросов
- `src/panels/ClientDashboard.js` — кабинет клиента
- `src/panels/EmployeeDashboard.js` — кабинет грумера
- `src/panels/AdminDashboard.js` — кабинет администратора

### Backend
- `backend/app.js` — запуск сервера, CORS, middleware, health-check
- `backend/db.js` — подключение к SQL Server
- `backend/routes/auth.js` — авторизация, роли, регистрация, switch-role
- `backend/routes/clients.js` — клиентские маршруты
- `backend/routes/employees.js` — маршруты грумера
- `backend/routes/admin.js` — административные маршруты
- `backend/routes/pets.js` — питомцы
- `backend/routes/services.js` — услуги

## База данных

Используется `Microsoft SQL Server`.

Ключевые таблицы:
- `Владельцы`
- `Сотрудники`
- `Груминг_клиенты`
- `Груминг_услуги`
- `Заказ_груминг_услуг`
- `Оказание_груминг_услуг`
- `Расписание_сотрудников`
- `Должности`

## Запуск проекта локально

### 1. Frontend
Из директории `grooming`:

```bash
npm install
npm run start
```

Frontend по умолчанию стартует на:

```text
http://localhost:5173
```

### 2. Backend
Из директории `grooming/backend`:

```bash
npm install
npm run dev
```

Backend по умолчанию стартует на:

```text
http://localhost:5000
```

### 3. Локальные переменные окружения

`grooming/.env.development`
```env
VITE_API_URL=http://localhost:5000
```

`grooming/backend/.env`
```env
PORT=5000
JWT_SECRET=your_secret
DB_USER=your_user
DB_PASSWORD=your_password
DB_SERVER=127.0.0.1
DB_NAME=grooming
ALLOWED_ORIGINS=http://localhost:5173
```

## Production

### Frontend
Для production-сборки используется:

`grooming/.env.production`
```env
VITE_API_URL=https://api.groomingptz.ru
```

Сборка и деплой:

```bash
npm run build
npx vk-miniapps-deploy
```

### Backend
Backend разворачивается на `Ubuntu VPS`:
- приложение запускается через `pm2`
- внешний доступ идёт через `nginx`
- база данных размещена в `SQL Server` на сервере

Проверка backend:

```bash
curl https://api.groomingptz.ru/health
```

## Health-check

Backend содержит служебные маршруты:

```text
GET /
GET /health
```

Пример ответа:

```json
{
  "ok": true,
  "uptime": 123.45,
  "timestamp": "2026-04-06T16:14:53.802Z"
}
```

## Безопасность

- JWT-аутентификация
- ограничение запросов на `/auth`
- CORS с белым списком origin
- разделение доступа по ролям
- логирование ошибок через `winston`

## Скрипты

### Frontend
```bash
npm run start
npm run build
npm run preview
npm run deploy
```

### Backend
```bash
npm run dev
npm start
```

## Конфигурация VK Mini Apps

Файл:

`vk-hosting-config.json`

Текущие параметры:
- `app_id`: `54468624`
- `static_path`: `build`

## Статус проекта

Проект реализует полноценный рабочий контур:
- авторизация через VK
- работа с клиентами
- работа с питомцами
- запись на услуги
- личный кабинет грумера
- админ-панель
- production backend на VPS
- production frontend на VK Hosting

## Полезные файлы

- `README.md` — общее описание проекта
- `DEPLOY_CHECKLIST.md` — памятка по развёртыванию
- `backend/.env.example` — пример backend-конфига
- `.env.production.example` — пример production-конфига frontend

## Автор

Проект разработан как курсовая работа по созданию мини-приложения ВКонтакте для груминг-салона.
