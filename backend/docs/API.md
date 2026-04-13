# FinGuide Backend API

## Base URL

`http://localhost:5001/api`

## Authentication

- The primary session mechanism is an HttpOnly cookie named `fg_session`.
- During migration, protected endpoints also accept `Authorization: Bearer <token>`.
- Frontend requests must include credentials.

## Endpoints

### Health

- `GET /health`

### Auth

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/google`
- `POST /auth/logout`
- `GET /auth/me`
- `PATCH /auth/me`
- `POST /auth/change-password`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`
- `POST /auth/profile/image`

Successful auth responses return:

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "507f1f77bcf86cd799439011",
      "name": "John Doe",
      "email": "john@example.com",
      "avatarUrl": null
    },
    "token": "migration-only-jwt"
  },
  "message": "התחברות בוצעה בהצלחה"
}
```

### Documents

- `POST /documents/upload`
- `GET /documents`
- `GET /documents/:id`
- `GET /documents/:id/download`
- `DELETE /documents/:id`
- `POST /documents/:id/reprocess`

Public document payload:

```json
{
  "id": "507f1f77bcf86cd799439011",
  "originalName": "salary.pdf",
  "fileSize": 1024,
  "mimeType": "application/pdf",
  "status": "processing",
  "processingStage": "run_ocr",
  "processingAttempts": 1,
  "processingStartedAt": "2026-04-13T10:00:00.000Z",
  "processingFinishedAt": null,
  "uploadedAt": "2026-04-13T10:00:00.000Z",
  "processedAt": null,
  "processingError": null,
  "metadata": {
    "category": "payslip",
    "periodMonth": 3,
    "periodYear": 2026,
    "documentDate": "2026-03-15T00:00:00.000Z",
    "source": "manual_upload"
  },
  "createdAt": "2026-04-13T10:00:00.000Z",
  "updatedAt": "2026-04-13T10:00:05.000Z"
}
```

### Payslips

- `GET /documents/payslips`
- `GET /documents/payslips/:id`

Canonical payslip detail payload:

```json
{
  "id": "507f1f77bcf86cd799439011",
  "periodLabel": "מרץ 2026",
  "periodDate": "2026-03-01",
  "paymentDate": "2026-03-15",
  "employerName": "Example Ltd",
  "employeeName": "John Doe",
  "employeeId": "123456789",
  "jobPercent": 100,
  "workingDays": 22,
  "workingHours": 186,
  "vacationDays": 4,
  "sickDays": 0,
  "earnings": [
    { "label": "משכורת בסיס", "amount": 12000 }
  ],
  "deductions": [
    { "label": "מס הכנסה", "amount": 1300 }
  ],
  "grossSalary": 12000,
  "netSalary": 9300
}
```

### AI

- `GET /ai/status`
- `POST /ai/chat`

AI status payload:

```json
{
  "success": true,
  "data": {
    "available": false,
    "provider": "disabled",
    "reason": "disabled"
  }
}
```

AI chat payload:

```json
{
  "success": true,
  "answer": "תשובה קצרה בעברית",
  "source": "llama3.2:1b"
}
```

### Findings

- `GET /findings`
- `POST /findings/savings-forecast`

## Notes

- `analysisData` and raw OCR text are internal implementation details and are not exposed by public document endpoints.
- Canonical payslip endpoints are the supported contract for payslip UI surfaces.
