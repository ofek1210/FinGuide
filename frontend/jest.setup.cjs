const { TextEncoder, TextDecoder } = require("util");

// Force non-production React builds so react-dom/test-utils exposes act correctly.
process.env.NODE_ENV = "test";

if (typeof global.TextEncoder === "undefined") {
  global.TextEncoder = TextEncoder;
}
if (typeof global.TextDecoder === "undefined") {
  global.TextDecoder = TextDecoder;
}
