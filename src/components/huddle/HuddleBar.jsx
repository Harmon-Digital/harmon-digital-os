import React, { useEffect, useRef } from "react";
import { useHuddle } from "@/contexts/HuddleContext";
import { Mic, MicOff, Video, VideoOff, Monitor, MonitorOff, PhoneOff, Maximize2, Minimize2, Hash, Loader2 } from "lucide-react";
import { Track } from "livekit-client";

function initials(name) {
  return (name || "?")
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** Expanded video grid rendered with raw LiveKit tracks (no @livekit/components-react needed) */
function VideoGrid({ room, participants }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!room || !containerRef.current) return;
    const container = containerRef.current;

    const attachAll = () => {
      container.innerHTML = "";
      const allParticipants = [
        ...Array.from(room.remoteParticipants.values()),
        room.localParticipant,
      ];
      allParticipants.forEach((p) => {
        const tile = document.createElement("div");
        tile.className =
          "relative bg-gray-900 rounded-md overflow-hidden flex items-center justify-center min-h-[160px]";

        // Find video + mic publications by iterating all trackPublications
        // (getTrackPublication(source) can be unreliable for local tracks).
        const allPubs = p.trackPublications
          ? Array.from(p.trackPublications.values())
          : [];
        let videoPub = null;
        let micPub = null;
        let isScreenShare = false;
        for (const pub of allPubs) {
          if (pub.kind === "video" && pub.track && !pub.isMuted) {
            // Prefer screen share over camera if both exist
            if (pub.source === Track.Source.ScreenShare) {
              videoPub = pub;
              isScreenShare = true;
              break;
            } else if (!videoPub) {
              videoPub = pub;
            }
          } else if (pub.kind === "audio" && pub.source === Track.Source.Microphone) {
            micPub = pub;
          }
        }

        if (videoPub?.track) {
          const el = videoPub.track.attach();
          el.className = "w-full h-full object-cover bg-gray-900";
          el.autoplay = true;
          el.playsInline = true;
          el.muted = p.isLocal; // local video must be muted to avoid echo
          // Mirror self-view camera (not screen share)
          if (p.isLocal && !isScreenShare) el.style.transform = "scaleX(-1)";
          tile.appendChild(el);
        } else {
          // Avatar fallback when no video
          const av = document.createElement("div");
          av.className =
            "w-16 h-16 rounded-full bg-gray-700 text-white text-xl font-medium flex items-center justify-center";
          av.textContent = initials(p.name || p.identity);
          tile.appendChild(av);
        }

        // Name label
        const label = document.createElement("div");
        label.className =
          "absolute bottom-2 left-2 bg-black/60 text-white text-[11px] font-medium px-2 py-0.5 rounded";
        label.textContent = (p.name || p.identity || "User") + (p.isLocal ? " (You)" : "");
        tile.appendChild(label);

        // Mic-off badge
        if (!micPub || micPub.isMuted) {
          const micIcon = document.createElement("div");
          micIcon.className =
            "absolute top-2 right-2 bg-red-600 text-white p-1 rounded-full";
          micIcon.innerHTML =
            '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="2" y1="2" x2="22" y2="22"/><path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2"/><path d="M5 10v2a7 7 0 0 0 12 5"/><path d="M15 9.34V5a3 3 0 0 0-5.68-1.33"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12"/><line x1="12" y1="19" x2="12" y2="23"/></svg>';
          tile.appendChild(micIcon);
        }

        // Audio attach (remote participants only, to avoid echo from self)
        if (!p.isLocal && micPub?.track) {
          const audioEl = micPub.track.attach();
          audioEl.style.display = "none";
          tile.appendChild(audioEl);
        }

        container.appendChild(tile);
      });
    };

    attachAll();

    // Re-render when tracks change
    const handler = () => attachAll();
    room.on("trackSubscribed", handler);
    room.on("trackUnsubscribed", handler);
    room.on("trackMuted", handler);
    room.on("trackUnmuted", handler);
    room.on("participantConnected", handler);
    room.on("participantDisconnected", handler);
    room.on("localTrackPublished", handler);
    room.on("localTrackUnpublished", handler);
    room.on("trackPublished", handler);
    room.on("trackUnpublished", handler);

    return () => {
      room.off("trackSubscribed", handler);
      room.off("trackUnsubscribed", handler);
      room.off("trackMuted", handler);
      room.off("trackUnmuted", handler);
      room.off("participantConnected", handler);
      room.off("participantDisconnected", handler);
      room.off("localTrackPublished", handler);
      room.off("localTrackUnpublished", handler);
      room.off("trackPublished", handler);
      room.off("trackUnpublished", handler);
      try {
        if (container) container.innerHTML = "";
      } catch {}
    };
  }, [room, participants]);

  // Grid layout: 1 = full, 2 = side-by-side, 3-4 = 2x2, 5-6 = 3x2, etc.
  const count = participants.length;
  const cols = count <= 1 ? 1 : count <= 4 ? 2 : count <= 9 ? 3 : 4;

  return (
    <div
      ref={containerRef}
      className="grid gap-2 p-3 flex-1 overflow-y-auto"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    />
  );
}

export default function HuddleBar() {
  const {
    activeHuddle,
    room,
    participants,
    audioOn,
    videoOn,
    screenShareOn,
    expanded,
    connecting,
    setExpanded,
    leave,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
  } = useHuddle();

  if (!activeHuddle && !connecting) return null;

  if (connecting) {
    return (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] bg-gray-900 text-white rounded-md shadow-lg px-3 py-2 flex items-center gap-2 text-[13px]">
        <Loader2 className="w-4 h-4 animate-spin" />
        Connecting…
      </div>
    );
  }

  const speakingNames = participants
    .filter((p) => p.isSpeaking && !p.isLocal)
    .map((p) => p.name)
    .slice(0, 2);

  return (
    <>
      {/* Expanded full-screen huddle view */}
      {expanded && (
        <div className="fixed inset-0 z-[70] bg-gray-950 flex flex-col">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 h-12 border-b border-gray-800">
            <Hash className="w-4 h-4 text-gray-400" />
            <span className="text-[13px] text-white font-medium">{activeHuddle.channelName || "Huddle"}</span>
            <span className="text-[11px] text-gray-500">
              {participants.length} {participants.length === 1 ? "person" : "people"}
            </span>
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded"
              title="Minimize"
            >
              <Minimize2 className="w-4 h-4" />
            </button>
          </div>

          {/* Video grid */}
          <VideoGrid room={room} participants={participants} />

          {/* Controls */}
          <div className="flex items-center justify-center gap-2 p-3 border-t border-gray-800">
            {/* Mic: red when muted, neutral when on */}
            <button
              type="button"
              onClick={toggleAudio}
              className={`inline-flex items-center justify-center w-11 h-11 rounded-full transition-colors ${
                audioOn ? "bg-gray-800 text-white hover:bg-gray-700" : "bg-red-600 text-white hover:bg-red-700"
              }`}
              title={audioOn ? "Mute microphone" : "Unmute microphone"}
            >
              {audioOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
            </button>

            {/* Camera: red when off, blue when on */}
            <button
              type="button"
              onClick={toggleVideo}
              className={`inline-flex items-center justify-center w-11 h-11 rounded-full transition-colors ${
                videoOn ? "bg-gray-800 text-white hover:bg-gray-700" : "bg-red-600 text-white hover:bg-red-700"
              }`}
              title={videoOn ? "Turn camera off" : "Turn camera on"}
            >
              {videoOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
            </button>

            {/* Screen share: blue when active, neutral when off */}
            <button
              type="button"
              onClick={toggleScreenShare}
              className={`inline-flex items-center justify-center w-11 h-11 rounded-full transition-colors ${
                screenShareOn ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-gray-800 text-white hover:bg-gray-700"
              }`}
              title={screenShareOn ? "Stop sharing screen" : "Share screen"}
            >
              {screenShareOn ? <MonitorOff className="w-4 h-4" /> : <Monitor className="w-4 h-4" />}
            </button>

            {/* Divider */}
            <div className="w-px h-6 bg-gray-800 mx-1" />

            {/* Leave: red pill with label */}
            <button
              type="button"
              onClick={leave}
              className="inline-flex items-center gap-2 px-4 h-11 rounded-full bg-red-600 text-white text-[13px] font-medium hover:bg-red-700"
              title="Leave huddle"
            >
              <PhoneOff className="w-4 h-4" />
              Leave
            </button>
          </div>
        </div>
      )}

      {/* Persistent slim bar (always visible, even when expanded is closed) */}
      {!expanded && (
        <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-[60] bg-gray-900 text-white rounded-full shadow-2xl px-2 py-1.5 flex items-center gap-1 ring-1 ring-white/10">
          {/* Channel name + speaking indicator */}
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="flex items-center gap-2 px-2 py-1 rounded-full hover:bg-white/10 transition-colors"
            title="Expand huddle"
          >
            <span className="relative flex items-center justify-center w-5 h-5">
              <span className="absolute inset-0 rounded-full bg-green-500 animate-pulse opacity-30" />
              <span className="w-2 h-2 rounded-full bg-green-400" />
            </span>
            <span className="text-[12px] font-medium max-w-[140px] truncate">
              {activeHuddle.channelName || "Huddle"}
            </span>
            <span className="text-[11px] text-gray-400 tabular-nums">
              {participants.length}
            </span>
          </button>

          {/* Quick avatar stack of other participants */}
          {participants.filter((p) => !p.isLocal).slice(0, 3).map((p) => (
            <div
              key={p.identity}
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium shrink-0 ${
                p.isSpeaking ? "bg-green-600 ring-2 ring-green-400" : "bg-gray-700"
              }`}
              title={p.name}
            >
              {initials(p.name)}
            </div>
          ))}
          {participants.filter((p) => !p.isLocal).length > 3 && (
            <span className="text-[10px] text-gray-400 px-0.5">+{participants.filter((p) => !p.isLocal).length - 3}</span>
          )}

          <div className="w-px h-5 bg-white/10 mx-1" />

          {/* Inline controls */}
          <button
            type="button"
            onClick={toggleAudio}
            className={`p-1.5 rounded-full transition-colors ${
              audioOn ? "hover:bg-white/10 text-white" : "bg-red-600 hover:bg-red-700 text-white"
            }`}
            title={audioOn ? "Mute" : "Unmute"}
          >
            {audioOn ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={toggleVideo}
            className={`p-1.5 rounded-full transition-colors ${
              videoOn ? "bg-blue-600 hover:bg-blue-700 text-white" : "hover:bg-white/10 text-white"
            }`}
            title={videoOn ? "Camera off" : "Camera on"}
          >
            {videoOn ? <Video className="w-3.5 h-3.5" /> : <VideoOff className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={toggleScreenShare}
            className={`p-1.5 rounded-full transition-colors ${
              screenShareOn ? "bg-blue-600 hover:bg-blue-700 text-white" : "hover:bg-white/10 text-white"
            }`}
            title={screenShareOn ? "Stop sharing" : "Share screen"}
          >
            <Monitor className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="p-1.5 rounded-full hover:bg-white/10 text-white"
            title="Expand"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={leave}
            className="ml-0.5 p-1.5 rounded-full bg-red-600 hover:bg-red-700 text-white"
            title="Leave huddle"
          >
            <PhoneOff className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </>
  );
}

