# Door Lock Integration

How to turn BioPulse face verification into a door opener — and the safety,
security and offline rules that decide whether it is a good door or a liability.

---

## 1. The rule that decides everything

> **The browser must never open a door, and the internet should not sit between
> a face and a lock.**

The kiosk UI runs in a browser on a tablet. A browser tab can be duplicated,
replayed, or scripted. So:

- The **server** makes the grant/deny decision (`POST /api/access/verify`).
- The **door controller** (a small computer at the door) holds the relay.
- The controller talks to the server over HTTPS with its own credential.

If the lock were driven from the page, anyone who can open DevTools on the
kiosk tablet has a master key.

---

## 2. Two architectures

### A. Local-first controller (recommended)

```
Camera ──► Door controller (Raspberry Pi) ──► Relay ──► Electric strike
                    │
                    └── HTTPS (best effort) ──► BioPulse API on Render
                                                 └── audit + attendance
```

The Pi runs the same 128-D face matching locally (`@vladmandic/face-api` in
Node, models already in the repo). It opens the relay **without waiting for the
network**, then posts the event to the cloud when it can.

- Unlock latency: ~300–800 ms, independent of the internet.
- Works during a Render cold start, a Wi-Fi outage, or a Neon pause.
- Cloud is the source of truth for *who may enter*, refreshed periodically
  (enrolments + terminations synced every few minutes and cached).

### B. Cloud decision, controller obeys

```
Tablet/reader ──► POST /api/access/verify on Render ──► relay command back
```

Simpler to build, but the door stops working when the internet does. On Render's
free tier the service sleeps after ~15 minutes idle, so the first scan of the
morning can take ~50 s. **Do not put a real door in front of this** unless the
controller keeps a local cache and falls back to it.

The API in this repo supports B directly; A reuses `server/face-match.ts` and
posts results with the same audit endpoints.

---

## 3. API (already implemented, `server/routes/access.ts`)

Configure one shared secret per door:

```bash
ACCESS_DEVICE_TOKENS="main-door:9f2c…,server-room:41ab…"
ACCESS_UNLOCK_MS=3000
ACCESS_COOLDOWN_SECONDS=20
```

Unset `ACCESS_DEVICE_TOKENS` → every access endpoint returns **503**. It fails
closed: a misconfigured server locks the door, it does not open it.

| Endpoint | Purpose |
|---|---|
| `POST /api/access/verify` | Face descriptor → `{granted, employee, unlock_ms}` |
| `POST /api/access/open` | Request-to-exit button (`REX`) or remote release |
| `GET /api/access/events` | Audit trail (every grant **and** denial) |
| `GET /api/access/health` | Unauthenticated liveness probe for the controller |

```bash
curl -X POST https://biopulse-api.onrender.com/api/access/verify \
  -H 'content-type: application/json' \
  -H 'x-device-token: 9f2c…' \
  -H 'x-door-id: main-door' \
  -d '{"descriptor":[0.031,-0.042, ... 128 floats ...]}'
```

```json
{ "granted": true, "reason": "FACE_MATCH",
  "employee": { "id": 16, "emp_code": "EMP0016", "full_name": "Senthil Muthukrishnan" },
  "confidence": 92.4, "door_id": "main-door", "unlock_ms": 3000 }
```

Deny reasons: `NO_CONFIDENT_MATCH`, `AMBIGUOUS`, `NO_ENROLLED_FACES`,
`RE_ENROLL_REQUIRED`, `ON_LEAVE`, `COOLDOWN`, `BAD_PAYLOAD`.

A refusal is **HTTP 200 with `granted: false`** on purpose — a 4xx/5xx would make
a naive controller retry in a loop.

---

## 4. Hardware (Bengaluru prices, indicative)

| Part | Why | ₹ approx |
|---|---|---|
| Raspberry Pi 4 (4 GB) or Pi 5 | Runs face matching + relay control | 5,000–9,000 |
| Official 5V/3A PSU | Undervoltage causes random reboots → doors that stick | 700 |
| Camera (USB or Pi Camera v3) | Capture frames | 1,500–3,000 |
| 2-channel relay module (opto-isolated) | Switches lock power, keeps Pi isolated | 250 |
| 12V 3A SMPS | Lock power, separate from the Pi | 600 |
| **Fail-safe** electric strike **or** maglock | Opens when power is cut | 900–2,000 |
| REX push button (exit) | Fire code requires a no-questions exit | 250 |
| Door position sensor (reed switch) | Propped-door alarm / audit | 200 |
| 1N4007 diode across the lock coil | Kills the back-EMF spike that welds relays | 10 |
| Enclosure + ferrules + cable | Neatness is reliability | 500 |

**Fail-safe vs fail-secure**

- **Fail-safe** (maglock / fail-safe strike): power loss **unlocks**. Required on
  escape routes. This is what you want for an office entrance.
- **Fail-secure**: power loss **locks**. Fine for a server room, not for a
  corridor people must exit through.

Never wire a maglock on a fire-escape route without tying it to the fire alarm
(fire alarm trips → lock releases). In most jurisdictions that is law, not
preference.

### Wiring sketch

```
            5V ──────────────┐
                              │
        ┌─────────────┐   ┌───┴────────┐        ┌──────────────┐
        │ Raspberry   │   │ Relay IN1  │  COM   │              │
        │ Pi GPIO17 ──┼──►│            │───┐    │  12V SMPS    │
        └─────────────┘   └────────────┘   │    │              │
                                            │    └──┬───────────┘
                              ┌─────────────┴──┐    │
                              │  Electric      │◄───┘
                              │  strike / lock │
                              └────────────────┘
                       diode across the coil, band toward +12V
```

GPIO 17 high → relay closed → lock energised → door releases for
`unlock_ms`, then GPIO goes low and the door re-locks.

---

## 5. Controller firmware (ESP32 / Pi)

The device only needs to do three things: read a frame, ask the API, drive a pin.
This is the complete decision loop:

```python
# Raspberry Pi, Python 3 — pip install RPi.GPIO requests
import time, requests, RPi.GPIO as GPIO
from face_lib import descriptor_from_camera   # your capture + 128-D embedding

DOOR, TOKEN = "main-door", "9f2c…"
API = "https://biopulse-api.onrender.com/api/access/verify"
RELAY_PIN = 17

GPIO.setmode(GPIO.BCM)
GPIO.setup(RELAY_PIN, GPIO.OUT, initial=GPIO.LOW)

def unlock(ms):
    GPIO.output(RELAY_PIN, GPIO.HIGH)
    time.sleep(ms / 1000)
    GPIO.output(RELAY_PIN, GPIO.LOW)

while True:
    vec = descriptor_from_camera()
    if vec is None:
        time.sleep(0.2)
        continue

    try:
        r = requests.post(API, json={"descriptor": vec},
                          headers={"x-device-token": TOKEN, "x-door-id": DOOR},
                          timeout=3).json()
    except requests.RequestException:
        # Network down. Decide deliberately: fail closed (default) or fall back
        # to a cached allow-list. Never "unlock because we could not check".
        time.sleep(1)
        continue

    if r.get("granted"):
        print("open for", r["employee"]["full_name"])
        unlock(r["unlock_ms"])
    else:
        print("denied:", r.get("reason"))
    time.sleep(1)
```

ESP32 variant: the board cannot run the face model comfortably, so use it as a
**relay bridge** — the Pi (or the tablet) does the embedding and the ESP32
receives an unlock command over the LAN, or polls the API. Keep the token in
NVS, never in the sketch source.

---

## 6. Rules that make it safe

1. **Server-side decision only.** The controller obeys a signed-in response; the
   page never gets a relay.
2. **Fail closed.** No token, no network, no cache, no decision → door stays
   locked. Except: a **REX button must always open**, wired directly to the lock
   circuit (not through software).
3. **Liveness.** The 128-D matcher will accept a sharp printed photo. Before a
   door depends on it, add blink/motion liveness or use a camera with
   depth/IR. This is the single biggest gap in the current stack.
4. **Audit everything.** `door_events` stores grants *and* denials with reason,
   employee, IP and timestamp. "Who opened the server room at 02:14" should be a
   query, not a guess.
5. **Anti-passback.** One badge-in, one entry: the built-in cooldown denies a
   second grant for the same employee within `ACCESS_COOLDOWN_SECONDS`.
6. **Terminations take effect immediately.** Access reads the live roster, so
   offboarding an employee in the app also removes their door access — provided
   the controller is online. In local-first (A), sync frequently and keep the
   cache TTL short.
7. **Protect the API itself.** See the next section; today the rest of the API is
   unauthenticated, and `cors()` is wide open.

---

## 7. Existing security gaps to close before a door exists

These are honest gaps in the current build, not hypotheticals:

| Gap | Risk | Fix |
|---|---|---|
| All `/api/*` routes are unauthenticated | Anyone who finds the URL can list, edit or delete staff | Admin session or API key on write routes |
| `cors()` allows any origin | A website could script the API from a visitor's browser | Allow-list the kiosk origin |
| No rate limiting on `/api/access/verify` | Brute-force attempts at faces and tokens | Per-device/IP limit, lockout after N denials |
| No liveness check | Printed photo opens the door | Blink/motion or IR camera |
| Device tokens are env-only and shared per door | Rotation means a redeploy | Acceptable to start; move to a `devices` table with hashed tokens later |

---

## 8. Rollout order

1. Enroll the people who need door access; confirm the kiosk identifies them.
2. Run the API test suite: `npm run test:door -- https://biopulse-api.onrender.com`.
3. Bench-test the relay with a lamp (not a lock) for a week; watch
   `/api/access/events` for false grants.
4. Fit the lock **fail-safe**, with a REX button, on an internal door first.
5. Only then move to the main entrance — and only after liveness is in place.
