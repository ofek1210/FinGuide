# FinGuide Backend API Documentation

## Base URL

http://localhost:5000/api

## Authentication

Protected endpoints require JWT token in Authorization header:

```
Authorization: Bearer <token>
```

---

## Endpoints

### 1. Health Check

**GET** `/health`

**Response 200:**

```json
{
  "success": true,
  "message": "Server is running",
  "timestamp": "2025-01-28T12:00:00.000Z"
}
```

---

### 2. Register User

**POST** `/auth/register`

**Content-Type:** `application/json`

**Request Body:**

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "SecurePass123"
}
```

**Validation Rules:**

- `name`: 2-50 characters, required
- `email`: valid email format, required
- `password`: minimum 6 characters, must contain uppercase, lowercase, and number

**Success Response 201:**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "507f1f77bcf86cd799439011",
      "name": "John Doe",
      "email": "john@example.com"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  "message": "ההרשמה בוצעה בהצלחה"
}
```

**Error Response 400 - Validation:**

```json
{
  "success": false,
  "message": "שגיאות בולידציה",
  "errors": [
    {
      "field": "email",
      "message": "אימייל לא תקין",
      "value": "invalid-email"
    }
  ]
}
```

**Error Response 400 - User Exists:**

```json
{
  "success": false,
  "message": "משתמש עם אימייל זה כבר קיים"
}
```

---

### 3. Login User

**POST** `/auth/login`

**Content-Type:** `application/json`

**Request Body:**

```json
{
  "email": "john@example.com",
  "password": "SecurePass123"
}
```

**Success Response 200:**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "507f1f77bcf86cd799439011",
      "name": "John Doe",
      "email": "john@example.com"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  "message": "התחברות בוצעה בהצלחה"
}
```

**Error Response 401:**

```json
{
  "success": false,
  "message": "אימייל או סיסמה לא נכונים"
}
```

**Error Response 400 - Validation:**

```json
{
  "success": false,
  "message": "שגיאות בולידציה",
  "errors": [...]
}
```

---

### 4. Get Current User

**GET** `/auth/me`

**Headers:**

```
Authorization: Bearer <token>
```

**Success Response 200:**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "507f1f77bcf86cd799439011",
      "name": "John Doe",
      "email": "john@example.com",
      "createdAt": "2025-01-28T10:00:00.000Z"
    }
  }
}
```

**Error Response 401:**

```json
{
  "success": false,
  "message": "לא מורשה, אין token"
}
```

---

## Status Codes

- **200**: OK - Request succeeded
- **201**: Created - Resource created successfully
- **400**: Bad Request - Invalid input or validation error
- **401**: Unauthorized - Authentication failed or token missing
- **404**: Not Found - Resource not found
- **500**: Internal Server Error - Server error

---

## Testing Examples

### Register New User

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@finguide.com","password":"Test123"}'
```

### Login

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@finguide.com","password":"Test123"}'
```

### Get Current User

```bash
curl http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Test Validation Error

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"A","email":"invalid","password":"123"}'
```

---

## Document Management

כל endpoints של מסמכים דורשים authentication.

---

### Upload Document

**POST** `/documents/upload`

**Headers:**

```
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Form Data:**

- `document`: [PDF file]

**Request Example (curl):**

```bash
curl -X POST http://localhost:5000/api/documents/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "document=@/path/to/payslip.pdf"
```

**Success Response 201:**

```json
{
  "success": true,
  "message": "הקובץ הועלה בהצלחה",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "originalName": "payslip-jan-2025.pdf",
    "fileSize": 245678,
    "uploadedAt": "2025-01-28T12:00:00.000Z",
    "status": "pending"
  }
}
```

**Error Responses:**

- **400**: No file selected
- **400**: File too large (max 10MB)
- **400**: Invalid file type (PDF only)
- **401**: No token or invalid token

---

### Get All Documents

**GET** `/documents`

**Headers:**

```
Authorization: Bearer <token>
```

**Success Response 200:**

```json
{
  "success": true,
  "count": 3,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "originalName": "payslip-jan-2025.pdf",
      "filename": "uuid-generated-name.pdf",
      "fileSize": 245678,
      "mimeType": "application/pdf",
      "status": "completed",
      "uploadedAt": "2025-01-28T12:00:00.000Z",
      "processedAt": "2025-01-28T12:05:00.000Z"
    }
  ]
}
```

---

### Get Single Document

**GET** `/documents/:id`

**Headers:**

```
Authorization: Bearer <token>
```

**Success Response 200:**

```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "originalName": "payslip-jan-2025.pdf",
    "fileSize": 245678,
    "status": "completed",
    "uploadedAt": "2025-01-28T12:00:00.000Z",
    "analysisData": {}
  }
}
```

**Error Responses:**

- **404**: Document not found
- **403**: Not authorized (not your document)

---

### Delete Document

**DELETE** `/documents/:id`

**Headers:**

```
Authorization: Bearer <token>
```

**Success Response 200:**

```json
{
  "success": true,
  "message": "המסמך נמחק בהצלחה"
}
```

**Error Responses:**

- **404**: Document not found
- **403**: Not authorized

---

### Download Document

**GET** `/documents/:id/download`

**Headers:**

```
Authorization: Bearer <token>
```

Returns the original PDF file for download.

---
