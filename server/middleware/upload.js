// middleware/upload.js
// --------------------
// the actual multer instance moved into routes/samples.js once it needed
// disk storage keyed by studentId, so this file just keeps the size ceiling
// that both it and sampleController's error messages read from - one number,
// not two copies that could drift apart.

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB per file
