# File Upload Testing Report

**Feature:** Document Upload System
**Date:** 2026-01-28
**Tester:** Backend Lead

---

## Setup

- Multer installed: Yes
- UUID installed: Yes
- uploads/ directory created: Yes
- .gitkeep in place: Yes

---

## Test Cases

### Upload Tests

**Test 1: Valid PDF Upload**

- File: test-payslip.pdf (2.5MB)
- Expected: 201 with document metadata
- Result: PASS
- Response time: ~342ms
- File saved to: uploads/[uuid].pdf
- MongoDB record created: Yes

**Test 2: Large File (over 10MB)**

- File: large-document.pdf (12MB)
- Expected: 400 "הקובץ גדול מדי"
- Result: PASS

**Test 3: Non-PDF File**

- File: image.jpg
- Expected: 400 "רק קבצי PDF מורשים"
- Result: PASS

**Test 4: No File Provided**

- No file in request
- Expected: 400 "לא נבחר קובץ"
- Result: PASS

**Test 5: No Authentication**

- Valid file but no token
- Expected: 401 "Not authorized"
- Result: PASS

---

### Retrieval Tests

**Test 6: Get All Documents**

- User has 3 documents
- Expected: 200 with array of 3 documents
- Result: PASS
- Sorted by uploadedAt descending: Yes

**Test 7: Get Single Document**

- Valid document ID owned by user
- Expected: 200 with full document data
- Result: PASS

**Test 8: Get Non-existent Document**

- Invalid ID
- Expected: 404 "מסמך לא נמצא"
- Result: PASS

**Test 9: Get Another User's Document**

- Valid ID but belongs to different user
- Expected: 403 "אין הרשאה"
- Result: PASS

---

### Download Tests

**Test 10: Download Own Document**

- Expected: File download with correct name
- Result: PASS
- File integrity verified: Yes

**Test 11: Download Non-existent Document**

- Expected: 404
- Result: PASS

---

### Delete Tests

**Test 12: Delete Own Document**

- Expected: 200 and file removed from disk
- Result: PASS
- File deleted from uploads/: Yes
- MongoDB record deleted: Yes

**Test 13: Delete Non-existent Document**

- Expected: 404
- Result: PASS

**Test 14: Delete Another User's Document**

- Expected: 403
- Result: PASS

---

## Security Verification

- Only authenticated users can upload: YES
- Users can only see their own documents: YES
- Users can only delete their own documents: YES
- File path not exposed in API response: YES
- Unique filenames prevent collisions: YES

---

## Performance

- Average upload time (2MB file): ~340ms
- Average retrieval time: ~45ms
- Average delete time: ~78ms
- MongoDB queries optimized: Yes (indexed)

---

## Issues Found

None. All tests passed.

---

## Summary

**Total Tests:** 14
**Passed:** 14
**Failed:** 0
**Success Rate:** 100%

---
