import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import { Room, RoomEvent, Track } from "livekit-client";
import { supabase } from "@/api/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/lib/toast";

const HuddleContext = createContext(null);

export function HuddleProvider({ children }) {
  const { user, userProfile } = useAuth();
  const [activeHuddle, setActiveHuddle] = useState(null); // { id, channelId, roomName, channelName }
  const [room, setRoom] = useState(null);
  const [participants, setParticipants] = useState([]); // [{ identity, name, isLocal, isSpeaking, audioOn, videoOn }]
  const [audioOn, setAudioOn] = useState(true);
  const [videoOn, setVideoOn] = useState(false);
  const [screenShareOn, setScreenShareOn] = useState(false);
  const [expanded, setExpanded] = useState(false); // full-screen mode
  const [connecting, setConnecting] = useState(false);
  const roomRef = useRef(null);

  const refreshParticipants = useCallback((rm) => {
    if (!rm) return;
    const all = [
      ...Array.from(rm.remoteParticipants.values()),
      rm.localParticipant,
    ].filter(Boolean);
    setParticipants(
      all.map((p) => ({
        identity: p.identity,
        name: p.name || p.identity,
        isLocal: p.isLocal,
        isSpeaking: p.isSpeaking,
        audioOn: !p.isMicrophoneEnabled === false,
        videoOn: !p.isCameraEnabled === false,
      })),
    );
  }, []);

  const join = useCallback(
    async ({ channelId, channelName, roomName, asStarter = false }) => {
      if (!user?.id) {
        toast.error("Sign in to join huddles");
        return;
      }
      setConnecting(true);
      try {
        // Get a token from our edge function
        const { data, error } = await supabase.functions.invoke("generate-livekit-token", {
          body: {
            roomName,
            channelId,
            identity: user.id,
            name: userProfile?.full_name || user.email || "User",
          },
        });
        if (error) throw error;
        if (!data?.token || !data?.url) throw new Error("No LiveKit token returned");

        const rm = new Room({
          adaptiveStream: true,
          dynacast: true,
        });

        rm.on(RoomEvent.ParticipantConnected, () => refreshParticipants(rm));
        rm.on(RoomEvent.ParticipantDisconnected, () => refreshParticipants(rm));
        rm.on(RoomEvent.ActiveSpeakersChanged, () => refreshParticipants(rm));
        rm.on(RoomEvent.LocalTrackPublished, () => refreshParticipants(rm));
        rm.on(RoomEvent.TrackMuted, () => refreshParticipants(rm));
        rm.on(RoomEvent.TrackUnmuted, () => refreshParticipants(rm));
        rm.on(RoomEvent.Disconnected, () => {
          setActiveHuddle(null);
          setRoom(null);
          setParticipants([]);
          roomRef.current = null;
        });

        await rm.connect(data.url, data.token);
        await rm.localParticipant.setMicrophoneEnabled(true);

        roomRef.current = rm;
        setRoom(rm);
        refreshParticipants(rm);

        // Find or create the huddle row. The partial unique index enforces
        // only one ACTIVE huddle per channel, so check for existing first.
        let huddleId;
        const { data: existing } = await supabase
          .from("huddles")
          .select("id, participant_count")
          .eq("channel_id", channelId)
          .is("ended_at", null)
          .maybeSingle();

        if (existing) {
          // Active huddle already exists — just join it by bumping count
          huddleId = existing.id;
          await supabase
            .from("huddles")
            .update({ participant_count: (existing.participant_count || 0) + 1 })
            .eq("id", existing.id);
          toast.success(asStarter ? "Joined existing huddle" : "Joined huddle");
        } else {
          // No active huddle — create one
          const { data: created, error: insErr } = await supabase
            .from("huddles")
            .insert({
              channel_id: channelId,
              room_name: roomName,
              started_by: user.id,
              participant_count: 1,
            })
            .select("id")
            .single();
          if (insErr) throw insErr;
          huddleId = created.id;
          toast.success("Huddle started");
        }

        setActiveHuddle({ id: huddleId, channelId, channelName, roomName });
        setAudioOn(true);
        setVideoOn(false);
      } catch (err) {
        console.error("Failed to join huddle:", err);
        toast.error("Couldn't join huddle", { description: err.message });
      } finally {
        setConnecting(false);
      }
    },
    [user, userProfile, refreshParticipants],
  );

  const leave = useCallback(async () => {
    const rm = roomRef.current;
    const huddle = activeHuddle;
    try {
      if (rm) await rm.disconnect();
    } catch {}
    if (huddle?.id) {
      // Decrement participant count; if zero, mark ended
      const { data: h } = await supabase
        .from("huddles")
        .select("participant_count")
        .eq("id", huddle.id)
        .maybeSingle();
      const next = Math.max((h?.participant_count || 1) - 1, 0);
      if (next <= 0) {
        await supabase.from("huddles").update({ ended_at: new Date().toISOString(), participant_count: 0 }).eq("id", huddle.id);
      } else {
        await supabase.from("huddles").update({ participant_count: next }).eq("id", huddle.id);
      }
    }
    setActiveHuddle(null);
    setRoom(null);
    setParticipants([]);
    setExpanded(false);
    roomRef.current = null;
  }, [activeHuddle]);

  const toggleAudio = useCallback(async () => {
    const rm = roomRef.current;
    if (!rm) return;
    const next = !audioOn;
    await rm.localParticipant.setMicrophoneEnabled(next);
    setAudioOn(next);
  }, [audioOn]);

  const toggleVideo = useCallback(async () => {
    const rm = roomRef.current;
    if (!rm) return;
    const next = !videoOn;
    await rm.localParticipant.setCameraEnabled(next);
    setVideoOn(next);
  }, [videoOn]);

  const toggleScreenShare = useCallback(async () => {
    const rm = roomRef.current;
    if (!rm) return;
    const next = !screenShareOn;
    try {
      await rm.localParticipant.setScreenShareEnabled(next);
      setScreenShareOn(next);
    } catch (err) {
      console.error("Screen share failed:", err);
      toast.error("Screen share blocked");
    }
  }, [screenShareOn]);

  const value = {
    activeHuddle,
    room,
    participants,
    audioOn,
    videoOn,
    screenShareOn,
    expanded,
    connecting,
    setExpanded,
    join,
    leave,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
  };

  return <HuddleContext.Provider value={value}>{children}</HuddleContext.Provider>;
}

export function useHuddle() {
  const ctx = useContext(HuddleContext);
  if (!ctx) throw new Error("useHuddle must be used inside HuddleProvider");
  return ctx;
}
