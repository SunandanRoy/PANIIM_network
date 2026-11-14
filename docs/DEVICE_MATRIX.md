# Device matrix (K-70): fill in on real phones

Each device: tap a real tag from cold (not signed in), sign in, connect, undo, re-tap, open the map, scan a QR,
type a code. Record pass/fail and notes. Target: every P0 flow passes on at least 8 devices.

| # | Device / OS / browser | NFC tap opens URL | Sign-in from tap (≤ 2 taps) | Connect + undo | Map renders (fps) | QR scan | Code entry | Notes |
|---|---|---|---|---|---|---|---|---|
| 1 | iPhone XS, iOS ?, Safari | | | | | | | |
| 2 | iPhone 11, Safari | | | | | | | |
| 3 | iPhone 13, installed app (PWA) | | | | | | | Safari vs PWA session (K-29) |
| 4 | iPhone 15, camera open | | | | | | | background read should fail gracefully |
| 5 | iPhone, airplane mode | | | | | | | offline queue message expected |
| 6 | Pixel, Chrome | | | | | | | |
| 7 | Samsung, Samsung Internet | | | | | | | |
| 8 | Xiaomi, Chrome | | | | | | | |
| 9 | Android with NFC off | | | | | | | QR / code fallback |
