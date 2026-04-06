# Backend Setup Instructions

## Installation

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy `.env.example` to `.env` and configure:
   ```bash
   copy .env.example .env
   ```

4. Generate a secure JWT secret:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
   Replace `JWT_SECRET` in `.env` with the generated value.

## Running the Server

### Development mode (with auto-reload):
```bash
npm run dev
```

### Production mode:
```bash
npm start
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | Server port | No (default: 5000) |
| `JWT_SECRET` | Secret key for JWT signing (min 32 chars) | **Yes** |
| `DB_USER` | SQL Server username | Yes |
| `DB_PASSWORD` | SQL Server password | Yes |
| `DB_SERVER` | SQL Server address | Yes |
| `DB_NAME` | Database name | Yes |

## Security Features

- **JWT Secret Validation**: Server will not start without a valid JWT_SECRET
- **Rate Limiting**: 10 requests per 15 minutes on `/auth` endpoint
- **Input Validation**: Phone and email validation on registration
- **Error Logging**: Errors logged to console and `logs/auth-errors.log`

## Troubleshooting

If you see "JWT_SECRET is not set" error:
1. Check that `.env` file exists in `backend/` directory
2. Ensure `JWT_SECRET` is set to a value longer than 32 characters
3. Make sure you haven't used the default value
