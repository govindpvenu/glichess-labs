import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

const signalingUrl =
  import.meta.env.VITE_SIGNALING_URL || "http://localhost:3000";
const iceServers = [{ urls: "stun:stun.l.google.com:19302" }];

export default function App() {
  const [roomInput, setRoomInput] = useState("");
  const [joinedRoom, setJoinedRoom] = useState("");
  const [status, setStatus] = useState("Disconnected");
  const [message, setMessage] = useState("");
  const [joining, setJoining] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const socketRef = useRef(null);
  const peerRef = useRef(null);
  const pendingCandidatesRef = useRef([]);

  function closePeer() {
    if (peerRef.current) {
      peerRef.current.close();
      peerRef.current = null;
    }
    pendingCandidatesRef.current = [];
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
  }

  function endSession(nextStatus = "Disconnected", notify = true) {
    const socket = socketRef.current;
    socketRef.current = null;
    if (socket) {
      if (notify && socket.connected) socket.emit("leave-room");
      socket.disconnect();
    }
    closePeer();
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    setJoinedRoom("");
    setJoining(false);
    setMicOn(true);
    setCameraOn(true);
    setStatus(nextStatus);
  }

  useEffect(
    () => () => {
      socketRef.current?.disconnect();
      peerRef.current?.close();
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  function createPeer() {
    if (peerRef.current) return peerRef.current;
    const peer = new RTCPeerConnection({ iceServers });
    peerRef.current = peer;

    localStreamRef.current.getTracks().forEach((track) => {
      peer.addTrack(track, localStreamRef.current);
    });
    peer.ontrack = (event) => {
      if (remoteVideoRef.current)
        remoteVideoRef.current.srcObject = event.streams[0];
    };
    peer.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current?.emit("ice-candidate", event.candidate.toJSON());
        console.log("[WebRTC] ICE candidate sent");
      }
    };
    peer.onconnectionstatechange = () => {
      console.log("[WebRTC] Connection state:", peer.connectionState);
      if (peerRef.current !== peer) return;
      const states = {
        new: "Connecting",
        connecting: "Connecting",
        connected: "Connected",
        disconnected: "Disconnected",
        failed: "Failed",
        closed: "Disconnected",
      };
      setStatus(states[peer.connectionState] || "Connecting");
      if (peer.connectionState === "failed") {
        setMessage(
          "P2P connection failed. This network may need a TURN server.",
        );
      }
    };
    peer.oniceconnectionstatechange = () => {
      console.log("[WebRTC] ICE connection state:", peer.iceConnectionState);
    };
    peer.onsignalingstatechange = () => {
      console.log("[WebRTC] Signaling state:", peer.signalingState);
    };
    return peer;
  }

  async function addPendingCandidates(peer) {
    for (const candidate of pendingCandidatesRef.current.splice(0)) {
      await peer.addIceCandidate(candidate);
    }
  }

  async function makeOffer() {
    try {
      setStatus("Connecting");
      const peer = createPeer();
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      if (peerRef.current !== peer) return;
      socketRef.current?.emit("offer", peer.localDescription);
      console.log("[WebRTC] Offer created and sent");
    } catch (error) {
      console.error("[WebRTC] Offer failed:", error);
      setStatus("Failed");
      setMessage("Could not start the call.");
    }
  }

  async function handleOffer(offer) {
    try {
      setStatus("Connecting");
      const peer = createPeer();
      await peer.setRemoteDescription(offer);
      await addPendingCandidates(peer);
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      if (peerRef.current !== peer) return;
      socketRef.current?.emit("answer", peer.localDescription);
      console.log("[WebRTC] Answer created and sent");
    } catch (error) {
      console.error("[WebRTC] Answer failed:", error);
      setStatus("Failed");
      setMessage("Could not answer the call.");
    }
  }

  async function handleAnswer(answer) {
    try {
      const peer = peerRef.current;
      if (!peer) return;
      await peer.setRemoteDescription(answer);
      await addPendingCandidates(peer);
      console.log("[WebRTC] Answer received");
    } catch (error) {
      console.error("[WebRTC] Setting answer failed:", error);
      setStatus("Failed");
    }
  }

  async function handleCandidate(candidate) {
    console.log("[WebRTC] ICE candidate received");
    try {
      const peer = peerRef.current;
      if (peer?.remoteDescription) await peer.addIceCandidate(candidate);
      else pendingCandidatesRef.current.push(candidate);
    } catch (error) {
      console.error("[WebRTC] Adding ICE candidate failed:", error);
    }
  }

  async function joinRoom(event) {
    event.preventDefault();
    const room = roomInput.trim();
    if (!room || joining || joinedRoom) return;
    setJoining(true);
    setStatus("Connecting");
    setMessage("");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      const socket = io(signalingUrl, {
        autoConnect: false,
        reconnection: false,
      });
      socketRef.current = socket;
      socket.on("connect", () => {
        socket.emit("join-room", room, (result) => {
          if (!result.ok) {
            setMessage(result.error);
            endSession();
            return;
          }
          console.log(`[WebRTC] Room joined: ${room} (${result.role})`);
          setJoinedRoom(room);
          setJoining(false);
          setStatus("Connecting");
          setMessage(
            result.role === "first"
              ? "Waiting for another participant…"
              : "Joining call…",
          );
        });
      });
      socket.on("peer-joined", () => {
        setMessage("Joining call…");
        makeOffer();
      });
      socket.on("offer", handleOffer);
      socket.on("answer", handleAnswer);
      socket.on("ice-candidate", handleCandidate);
      socket.on("peer-left", () => {
        console.log("[WebRTC] Peer left");
        closePeer();
        setStatus("Disconnected");
        setMessage("Peer left. Waiting for another participant…");
      });
      socket.on("connect_error", (error) => {
        console.error("[Signaling] Connection failed:", error);
        endSession("Failed", false);
        setMessage(`Could not reach signaling server at ${signalingUrl}.`);
      });
      socket.on("disconnect", () => {
        if (socketRef.current !== socket) return;
        console.log("[Signaling] Disconnected");
        endSession("Disconnected", false);
        setMessage("Signaling server disconnected. Join again to retry.");
      });
      socket.connect();
    } catch (error) {
      console.error("[Media] Camera/microphone unavailable:", error);
      endSession("Failed", false);
      setMessage(
        "Camera and microphone access is required. Check browser permissions.",
      );
    }
  }

  function toggleTrack(kind) {
    const track = localStreamRef.current
      ?.getTracks()
      .find((item) => item.kind === kind);
    if (!track) return;
    track.enabled = !track.enabled;
    if (kind === "audio") setMicOn(track.enabled);
    else setCameraOn(track.enabled);
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-semibold">WebRTC P2P Demo</h1>
      <p className="mt-2 text-slate-400">
        Simple 1-to-1 video call with direct peer-to-peer media.
      </p>

      <form onSubmit={joinRoom} className="mt-8 flex flex-wrap items-end gap-3">
        <label className="flex-1 min-w-52 text-sm font-medium">
          Room ID
          <input
            className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 outline-none focus:border-sky-400"
            value={roomInput}
            onChange={(event) => setRoomInput(event.target.value)}
            placeholder="abc123"
            maxLength={80}
            disabled={joining || !!joinedRoom}
          />
        </label>
        <button
          className="rounded-lg bg-sky-500 px-5 py-2 font-semibold text-slate-950 disabled:opacity-50"
          disabled={joining || !!joinedRoom || !roomInput.trim()}
          type="submit"
        >
          {joining ? "Joining…" : "Join Room"}
        </button>
      </form>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <section>
          <h2 className="mb-2 font-medium">Local video</h2>
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="aspect-video w-full rounded-lg bg-slate-900 object-cover"
          />
        </section>
        <section>
          <h2 className="mb-2 font-medium">Remote video</h2>
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="aspect-video w-full rounded-lg bg-slate-900 object-cover"
          />
        </section>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          onClick={() => toggleTrack("audio")}
          disabled={!joinedRoom}
          className="rounded-lg border border-slate-600 px-4 py-2 disabled:opacity-50"
        >
          {micOn ? "Mute mic" : "Unmute mic"}
        </button>
        <button
          onClick={() => toggleTrack("video")}
          disabled={!joinedRoom}
          className="rounded-lg border border-slate-600 px-4 py-2 disabled:opacity-50"
        >
          {cameraOn ? "Disable camera" : "Enable camera"}
        </button>
        <button
          onClick={() => {
            endSession();
            setMessage("You left the room.");
          }}
          disabled={!joinedRoom}
          className="rounded-lg border border-rose-500 px-4 py-2 text-rose-300 disabled:opacity-50"
        >
          Leave call
        </button>
      </div>

      <p className="mt-6" role="status">
        Connection: <strong>{status}</strong>
        {joinedRoom && ` · Room: ${joinedRoom}`}
      </p>
      {message && <p className="mt-2 text-slate-400">{message}</p>}
    </main>
  );
}
