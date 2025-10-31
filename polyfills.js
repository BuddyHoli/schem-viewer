// src/polyfills.js
// Polyfills für Browser/Capacitor WebView (Buffer für prismarine-nbt)
import { Buffer } from "buffer";

// make Buffer available globally (prismarine-nbt erwartet Node Buffer)
if (typeof window !== "undefined" && !window.Buffer) {
  window.Buffer = Buffer;
}