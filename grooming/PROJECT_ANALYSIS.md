# Анализ проекта VK Mini App для груминг-салона

## 1. Общая информация о проекте

**Назначение:** Веб-приложение для управления груминг-салоном с разделением по ролям пользователей.

**Технологический стек:**
- **Фронтенд:** React + Vite + VK UI + VK Bridge + VK Mini Apps Router
- **Бэкенд:** Node.js + Express
- **База данных:** MS SQL Server
- **Аутентификация:** JWT токены
- **Интеграция:** VK Mini Apps

---

## 2. Реализованный функционал

### 2.1 Бэкенд (backend/)

#### [`backend/app.js`](grooming/backend/app.js)
- Настроен Express сервер с CORS и JSON middleware
- Подключены все маршруты: auth, admin, employees, clients, services, owners, orders
- Порт конфигурируется через ENV переменную

#### [`backend/db.js`](grooming/backend/db.js)
- Подключение к MS SQL Server через mssql драйвер
- Пул соединений для оптимизации
- Конфигурация через .env файл

#### [`backend/middleware/auth.js`](grooming/backend/middleware/auth.js)
- `authenticateToken` - проверка JWT токена
- `checkRole` - проверка роли пользователя (admin, groomer, client)

#### [`backend/routes/auth.js`](grooming/backend/routes/auth.js)
- **POST /auth** - аутентификация по VK ID
- Автоматическое создание владельца при первом входе
- Определение роли: client, groomer, admin
- Генерация JWT токена на 24 часа

#### [`backend/routes/admin.js`](grooming/backend/routes/admin.js)
- **GET /admin/dashboard** - статистика (заказы, клиенты, сотрудники)
- **GET /admin/orders** - все заказы (только для админа)

#### [`backend/routes/employees.js`](grooming/backend/routes/employees.js)
- **GET /employees/dashboard** - назначенные заказы сотрудника
- **PATCH /employees/order/:orderId/status** - обновление статуса заказа

#### [`backend/routes/clients.js`](grooming/backend/routes/clients.js)
- **GET /clients/profile** - профиль клиента
- **GET /clients/orders** - заказы клиента
- **PUT /clients/profile** - обновление профиля

#### [`backend/routes/orders.js`](grooming/backend/routes/orders.js)
- **POST /orders** - создание заказа и оказание услуги

#### [`backend/routes/services.js`](grooming/backend/routes/services.js)
- **GET /services** - получение всех услуг
- **POST /services** - добавление услуги (без проверки роли!)

#### [`backend/routes/owners.js`](grooming/backend/routes/owners.js)
- Заглушка (только тестовый ответ)

#### [`backend/routes/pets.js`](grooming/backend/routes/pets.js)
- **ПУСТЫЙ ФАЙЛ** - не реализован

---

### 2.2 Фронтенд (src/)

#### [`src/App.js`](grooming/src/App.js)
- Основная точка рендеринга
- Интеграция с VK Bridge для получения данных пользователя
- Автоматический вход после получения данных VK
- Роутинг на основе панелей

#### [`src/routes.js`](grooming/src/routes.js)
- Конфигурация роутера VK Mini Apps Router
- Панели для ролей:
  - **Admin:** dashboard, orders, employees
  - **Employee:** dashboard, orders
  - **Client:** dashboard, orders, profile

#### [`src/contexts/AuthContext.js`](grooming/src/contexts/AuthContext.js)
- Глобальное состояние аутентификации
- `login()` - вход через бэкенд
- `logout()` - выход с очисткой localStorage
- `checkRole()` - проверка роли
- Сохранение токена и данных в localStorage

#### [`src/components/ProtectedRoute.js`](grooming/src/components/ProtectedRoute.js)
- Защита маршрутов по роли
- Модальное окно при отсутствии доступа

#### [`src/panels/Home.js`](grooming/src/panels/Home.js)
- Главная страница без авторизации
- Отображение данных из VK Bridge
- Кнопка для перехода к "Персику"

#### [`src/panels/Persik.js`](grooming/src/panels/Persik.js)
- Заглушка с изображением кота Персика

#### [`src/panels/AdminDashboard.js`](grooming/src/panels/AdminDashboard.js)
- Статистика: заказы, клиенты, сотрудники
- Навигация к управлению заказами и сотрудниками
- Кнопка выхода

#### [`src/panels/EmployeeDashboard.js`](grooming/src/panels/EmployeeDashboard.js)
- Список назначенных заказов
- Обновление статуса заказа (pending → in_progress → completed)
- Визуализация статуса через Badge

#### [`src/panels/ClientDashboard.js`](grooming/src/panels/ClientDashboard.js)
- Профиль клиента (ФИО, телефон)
- Список заказов с статусами

---

## 3. Недостающий функционал

### 3.1 Критические пробелы

| № | Функционал | Приоритет | Файлы для изменения |
|---|------------|-----------|---------------------|
| 1 | **Маршруты для панелей заказов/сотрудников админа** | HIGH | src/routes.js, src/panels/AdminDashboard.js |
| 2 | **Маршруты для заказов сотрудника** | HIGH | src/routes.js, src/panels/EmployeeDashboard.js |
| 3 | **Маршрут профиля клиента** | HIGH | src/routes.js, src/panels/ClientDashboard.js |
| 4 | **Создание новых заказов клиентом** | HIGH | backend/routes/orders.js, src/panels/ClientDashboard.js |
| 5 | **Управление питомцами (pets)** | HIGH | backend/routes/pets.js, src/panels/ClientDashboard.js |
| 6 | **Управление услугами (CRUD)** | MEDIUM | backend/routes/services.js, src/panels/AdminDashboard.js |
| 7 | **Управление сотрудниками (CRUD)** | MEDIUM | backend/routes/admin.js, src/panels/AdminDashboard.js |
| 8 | **Защита POST /services от несанкционированного доступа** | MEDIUM | backend/routes/services.js |

### 3.2 Детальный анализ недостающих функций

#### 3.2.1 Админ-панель

**Отсутствуют:**
- Панель управления заказами (`/admin-orders`) - нет компонента
- Панель управления сотрудниками (`/admin-employees`) - нет компонента
- CRUD для услуг (добавление/редактирование/удаление)
- CRUD для сотрудников (добавление/назначение/удаление)
- Просмотр деталей заказа
- Фильтрация и поиск заказов

**Необходимые файлы:**
- `src/panels/AdminOrders.js` - список всех заказов с фильтрацией
- `src/panels/AdminEmployees.js` - управление сотрудниками
- `src/panels/AdminServices.js` - управление услугами
- `src/panels/AdminPet.js` - управление питомцами клиентов

#### 3.2.2 Панель сотрудника

**Отсутствуют:**
- Панель заказов (`/employee-orders`) - нет компонента
- Детальный просмотр заказа
- История выполненных заказов
- Календарь/расписание

**Необходимые файлы:**
- `src/panels/EmployeeOrders.js` - детальный список заказов
- `src/panels/EmployeeSchedule.js` - расписание на день/неделю

#### 3.2.3 Панель клиента

**Отсутствуют:**
- Панель заказов (`/client-orders`) - нет компонента
- Панель профиля (`/client-profile`) - нет компонента
- Создание нового заказа
- Управление питомцами (добавление/редактирование/удаление)
- История всех заказов

**Необходимые файлы:**
- `src/panels/ClientOrders.js` - список всех заказов
- `src/panels/ClientProfile.js` - редактирование профиля
- `src/panels/ClientPets.js` - управление питомцами
- `src/panels/ClientNewOrder.js` - форма создания заказа

#### 3.2.4 Бэкенд API

**Отсутствуют эндпоинты:**

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/pets` | Получить питомцы клиента |
| POST | `/pets` | Добавить питомца |
| PUT | `/pets/:id` | Обновить питомца |
| DELETE | `/pets/:id` | Удалить питомца |
| GET | `/services/:id` | Получить услугу по ID |
| PUT | `/services/:id` | Обновить услугу |
| DELETE | `/services/:id` | Удалить услугу |
| GET | `/employees` | Получить всех сотрудников |
| POST | `/employees` | Добавить сотрудника |
| PUT | `/employees/:id` | Обновить сотрудника |
| DELETE | `/employees/:id` | Удалить сотрудника |
| GET | `/orders/:id` | Получить заказ по ID |
| GET | `/orders/client/:ownerId` | Заказы клиента |
| GET | `/orders/employee/:employeeId` | Заказы сотрудника |
| PATCH | `/orders/:id` | Обновить заказ |

---

## 4. План доработки

### Этап 1: Базовая функциональность (HIGH Priority)

#### 4.1.1 Создание недостающих панелей фронтенда

**Файлы для создания:**
1. `src/panels/ClientOrders.js` - список заказов клиента
2. `src/panels/ClientProfile.js` - редактирование профиля
3. `src/panels/ClientPets.js` - управление питомцами
4. `src/panels/ClientNewOrder.js` - создание нового заказа
5. `src/panels/AdminOrders.js` - управление заказами
6. `src/panels/AdminEmployees.js` - управление сотрудниками

**Файлы для изменения:**
- `src/panels/ClientDashboard.js` - добавить навигацию к новым панелям
- `src/panels/AdminDashboard.js` - добавить навигацию к новым панелям
- `src/panels/EmployeeDashboard.js` - добавить навигацию к панели заказов

#### 4.1.2 Обновление конфигурации роутинга

**Файл:** `src/routes.js`
- Убедиться, что все панели зарегистрированы
- Добавить переходы между панелями

#### 4.1.3 Создание API endpoints для питомцев

**Файл:** `backend/routes/pets.js`
- GET /pets?ownerId=... - получить питомцы клиента
- POST /pets - добавить питомца
- PUT /pets/:id - обновить питомца
- DELETE /pets/:id - удалить питомца

#### 4.1.4 Создание API endpoints для услуг

**Файл:** `backend/routes/services.js`
- Добавить проверку роли для POST/PUT/DELETE
- GET /services/:id - получить услугу по ID
- PUT /services/:id - обновить услугу
- DELETE /services/:id - удалить услугу

#### 4.1.5 Создание API endpoints для сотрудников

**Файл:** `backend/routes/admin.js`
- GET /employees - получить всех сотрудников
- POST /employees - добавить сотрудника
- PUT /employees/:id - обновить сотрудника
- DELETE /employees/:id - удалить сотрудника

### Этап 2: Расширенная функциональность (MEDIUM Priority)

#### 4.2.1 CRUD для услуг

**Файлы:**
- `src/panels/AdminServices.js` - интерфейс управления услугами
- Обновление `backend/routes/services.js`

#### 4.2.2 Детальный просмотр заказов

**Файлы:**
- `src/panels/OrderDetails.js` - детали заказа
- Обновление `backend/routes/orders.js` - GET /orders/:id

#### 4.2.3 Календарь/расписание

**Файлы:**
- `src/panels/EmployeeSchedule.js` - расписание сотрудника
- `src/panels/AdminSchedule.js` - расписание салона

### Этап 3: Улучшения (LOW Priority)

#### 4.3.1 Уведомления

**Файлы:**
- `src/components/Notification.js` - компонент уведомлений
- Интеграция с VK Web Push

#### 4.3.2 Экспорт данных

**Файлы:**
- `backend/routes/admin.js` - экспорт заказов в CSV/Excel
- `src/panels/AdminExport.js` - интерфейс экспорта

#### 4.3.3 Статистика и аналитика

**Файлы:**
- `src/panels/AdminAnalytics.js` - графики и метрики
- `backend/routes/admin.js` - расширенная статистика

---

## 5. Список файлов для создания/изменения

### 5.1 Файлы для создания

| № | Путь | Назначение |
|---|------|------------|
| 1 | `src/panels/ClientOrders.js` | Список заказов клиента |
| 2 | `src/panels/ClientProfile.js` | Редактирование профиля |
| 3 | `src/panels/ClientPets.js` | Управление питомцами |
| 4 | `src/panels/ClientNewOrder.js` | Создание заказа |
| 5 | `src/panels/AdminOrders.js` | Управление заказами |
| 6 | `src/panels/AdminEmployees.js` | Управление сотрудниками |
| 7 | `src/panels/AdminServices.js` | Управление услугами |
| 8 | `src/panels/OrderDetails.js` | Детали заказа |
| 9 | `src/panels/EmployeeSchedule.js` | Расписание сотрудника |
| 10 | `src/panels/AdminSchedule.js` | Расписание салона |

### 5.2 Файлы для изменения

| № | Путь | Изменения |
|---|------|-----------|
| 1 | `backend/routes/pets.js` | Реализация CRUD для питомцев |
| 2 | `backend/routes/services.js` | Добавить проверку роли, CRUD |
| 3 | `backend/routes/admin.js` | CRUD для сотрудников, детали заказов |
| 4 | `backend/routes/orders.js` | GET /orders/:id, фильтрация |
| 5 | `src/routes.js` | Проверка всех маршрутов |
| 6 | `src/panels/ClientDashboard.js` | Добавить навигацию |
| 7 | `src/panels/AdminDashboard.js` | Добавить навигацию |
| 8 | `src/panels/EmployeeDashboard.js` | Добавить навигацию |
| 9 | `src/panels/index.js` | Экспорт новых панелей |

---

## 6. Архитектурные замечания

### 6.1 Проблемы безопасности

1. **POST /services не проверяет роль** - любой может добавить услугу
2. **Отсутствие rate limiting** - уязвимость к brute force
3. **JWT секрет в коде** - следует использовать ENV переменную

### 6.2 Проблемы архитектуры

1. **Отсутствие валидации данных** - нет проверки входящих данных
2. **Отсутствие обработки ошибок** - некоторые endpoints не обрабатывают ошибки
3. **Жестко закодированные URL** - следует использовать конфиг

### 6.3 Рекомендации

1. Добавить валидацию данных через `joi` или `zod`
2. Добавить логирование через `winston`
3. Добавить обработку ошибок на уровне middleware
4. Использовать переменные окружения для всех секретов
5. Добавить тесты для критических endpoints

---

## 7. Заключение

Проект имеет хорошую базовую структуру с разделением по ролям и работающей аутентификацией. Однако для полноценного функционирования требуется доработка значительной части функционала, особенно в области CRUD операций и управления данными.

**Ключевые приоритеты:**
1. Реализация недостающих панелей фронтенда
2. Создание API endpoints для питомцев
3. Добавление возможности создания заказов
4. Реализация управления услугами и сотрудниками

**Оценка объема работ:** ~40-60 часов разработки
