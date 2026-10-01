# WebRTC P2P Demo

A minimal two-person video call experiment. Two browsers enter the same room ID, grant camera and microphone access, and attempt a direct WebRTC connection. The Express/Socket.IO server only relays connection setup messages. It never carries audio or video.

## Architecture

```text
Browser A ── Socket.IO signaling ──► Express server ◄── Socket.IO signaling ── Browser B
Browser A ◄══════════════════ direct WebRTC audio/video ══════════════════► Browser B
```

The first participant waits. When the second joins, the first creates an offer. The second sets that offer as its remote description, creates an answer, and sends it back. Both browsers exchange ICE candidates through Socket.IO. After ICE finds a usable path, encrypted media flows directly between the browsers. The server keeps room membership in memory and limits each room to two sockets.

The only configured ICE server is `stun:stun.l.google.com:19302`. STUN helps each browser discover its public network address. This demo intentionally has **no TURN fallback**: it is meant to reveal whether direct P2P works on your networks. Calls may fail behind restrictive NATs or firewalls.

## Local development

Requires Node.js 20 or newer. Use two terminals from the repository root:

**Terminal 1 — signaling server**

```bash
cd server
npm install
npm run dev
```

**Terminal 2 — frontend**

```bash
cd client
npm install
npm run dev
```

Open `http://localhost:5173` in two browser tabs. The frontend defaults to `http://localhost:3000` for signaling. To change it, copy `client/.env.example` to `client/.env.local`, edit `VITE_SIGNALING_URL`, and restart the frontend.

If port `3001` is already used, start the server with `PORT=33011 npm run dev` and set `VITE_SIGNALING_URL=http://localhost:33011` in `client/.env.local` before starting the frontend.

## Test the call

1. Open the frontend in Browser A and Browser B. Enter the same room ID and allow camera and microphone access in each.
2. Confirm both local previews appear, followed by remote video/audio and **Connection: Connected**.
3. Open both browser consoles and inspect the room, offer/answer, ICE candidate, connection, ICE connection, and signaling state logs.
4. Toggle microphone and camera; confirm the other browser sees/hears the change.
5. Leave in one browser. Its camera should stop and the other browser should show that the peer left. Rejoin with the same ID and repeat.
6. Try a third tab with the same ID while both are present; it should show **Room is full**.

For two physical devices, use the HTTPS deployment below. Camera/microphone access requires a secure context; `localhost` is allowed for local testing, but a plain `http://` LAN IP generally is not. Use headphones when testing two tabs on one computer to avoid feedback.

## Free deployment example

1. Deploy `server` as a **Render Web Service** on the Free plan. Set the root directory to `server`, build command to `npm install`, and start command to `npm start`. Render provides `PORT` and a public `https://...onrender.com` URL. Socket.IO uses HTTPS/WSS through that URL; no separate WebSocket port is needed.
2. Deploy `client` as a **Vercel Vite project**. Set the root directory to `client`, build command to `npm run build`, and output directory to `dist`. Set `VITE_SIGNALING_URL` to the Render **HTTPS** URL, then redeploy so Vite includes the value in the build.
3. Optionally set Render's `CLIENT_ORIGIN` environment variable to the exact Vercel origin (for example, `https://your-app.vercel.app`) and redeploy. If unset, this demo permits any origin for ease of testing.
4. Open the Vercel HTTPS URL on both devices and join the same room. The browser connects to Render over secure signaling; media still attempts a direct P2P path.

Render Free services can take about a minute to wake after inactivity, and may restart. A signaling disconnect ends the current room session; join again after the server is available. Rooms are in memory, so restarting the server also clears them.

References: [Render free services](https://render.com/docs/free), [Render WebSockets](https://render.com/docs/websocket), [Vercel Vite deployment](https://vercel.com/docs/frameworks/frontend/vite), [secure contexts for camera/microphone](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia).
