"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type AudioStatus = "idle" | "loading" | "playing" | "muted" | "unavailable";

interface AudioApi {
  status: AudioStatus;
  isPlaying: boolean;
  toggle: () => void;
  /** 0 = fully muffled, 1 = open. Used by route transitions. */
  setMuffle: (amount: number) => void;
}

const AudioContext_ = createContext<AudioApi | null>(null);

const STORAGE_KEY = "kairox.audio";
const TARGET_VOLUME = 0.35;
const FADE_IN_MS = 600;
const FADE_OUT_MS = 400;

function readPreference(): "on" | "off" | null {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === "on" || v === "off" ? v : null;
  } catch {
    return null;
  }
}

function writePreference(v: "on" | "off") {
  try {
    window.localStorage.setItem(STORAGE_KEY, v);
  } catch {
    /* private mode, blocked storage — the toggle still works this session */
  }
}

/**
 * One <audio> element for the whole app, wrapped in a WebAudio graph so we
 * can ramp gain instead of hard-cutting a synth pad.
 *
 * Autoplay is blocked everywhere until the user interacts with the page, so
 * we start silent, try play() once in a try/catch, and also arm a one-shot
 * pointerdown listener: the user's first click anywhere starts the track
 * unless they previously muted it.
 */
export function AudioProvider({
  src,
  children,
}: {
  /** Path without extension; .webm and .mp3 are both offered. */
  src: string;
  children: ReactNode;
}) {
  const elRef = useRef<HTMLAudioElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const filterRef = useRef<BiquadFilterNode | null>(null);
  const wantsAudioRef = useRef(false);

  const [status, setStatus] = useState<AudioStatus>("idle");

  const ensureGraph = useCallback(() => {
    const el = elRef.current;
    if (!el || ctxRef.current) return ctxRef.current;

    const Ctor: typeof AudioContext | undefined =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;

    const ctx = new Ctor();
    const source = ctx.createMediaElementSource(el);
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 20000;
    const gain = ctx.createGain();
    gain.gain.value = 0;

    source.connect(filter).connect(gain).connect(ctx.destination);

    ctxRef.current = ctx;
    gainRef.current = gain;
    filterRef.current = filter;
    return ctx;
  }, []);

  const rampTo = useCallback((value: number, ms: number) => {
    const ctx = ctxRef.current;
    const gain = gainRef.current;
    if (!ctx || !gain) return;
    const now = ctx.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(value, now + ms / 1000);
  }, []);

  const start = useCallback(async () => {
    const el = elRef.current;
    if (!el) return false;
    setStatus((s) => (s === "playing" ? s : "loading"));
    const ctx = ensureGraph();
    try {
      if (ctx?.state === "suspended") await ctx.resume();
      await el.play();
      rampTo(TARGET_VOLUME, FADE_IN_MS);
      wantsAudioRef.current = true;
      setStatus("playing");
      return true;
    } catch {
      setStatus((s) => (s === "unavailable" ? s : "idle"));
      return false;
    }
  }, [ensureGraph, rampTo]);

  const stop = useCallback(() => {
    const el = elRef.current;
    if (!el) return;
    rampTo(0, FADE_OUT_MS);
    window.setTimeout(() => {
      if (!wantsAudioRef.current) el.pause();
    }, FADE_OUT_MS + 40);
    wantsAudioRef.current = false;
    setStatus("muted");
  }, [rampTo]);

  const toggle = useCallback(() => {
    if (status === "unavailable") return;
    if (wantsAudioRef.current) {
      stop();
      writePreference("off");
    } else {
      void start();
      writePreference("on");
    }
  }, [start, status, stop]);

  const setMuffle = useCallback((amount: number) => {
    const ctx = ctxRef.current;
    const filter = filterRef.current;
    if (!ctx || !filter) return;
    const clamped = Math.min(1, Math.max(0, amount));
    const hz = 800 + (20000 - 800) * (1 - clamped);
    filter.frequency.cancelScheduledValues(ctx.currentTime);
    filter.frequency.linearRampToValueAtTime(hz, ctx.currentTime + 0.5);
  }, []);

  /* First-gesture start, unless the user explicitly muted before. */
  useEffect(() => {
    if (readPreference() === "off") return;

    // Deferred: calling start() synchronously here would setState during the
    // effect and cascade a render. The autoplay attempt is best-effort
    // anyway — it succeeds only on a return visit with a prior gesture.
    const attempt = window.setTimeout(() => void start(), 0);

    const onFirstGesture = () => {
      if (!wantsAudioRef.current) void start();
    };
    document.addEventListener("pointerdown", onFirstGesture, { once: true });
    document.addEventListener("keydown", onFirstGesture, { once: true });
    return () => {
      window.clearTimeout(attempt);
      document.removeEventListener("pointerdown", onFirstGesture);
      document.removeEventListener("keydown", onFirstGesture);
    };
  }, [start]);

  /* Pause with the tab, resume only if the user wanted sound. */
  useEffect(() => {
    const onVisibility = () => {
      const el = elRef.current;
      if (!el) return;
      if (document.hidden) {
        el.pause();
      } else if (wantsAudioRef.current) {
        void el.play().catch(() => undefined);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const api = useMemo<AudioApi>(
    () => ({
      status,
      isPlaying: status === "playing",
      toggle,
      setMuffle,
    }),
    [setMuffle, status, toggle],
  );

  return (
    <AudioContext_.Provider value={api}>
      <audio
        ref={elRef}
        loop
        preload="none"
        crossOrigin="anonymous"
        onError={() => setStatus("unavailable")}
      >
        <source src={`${src}.webm`} type="audio/webm" />
        <source src={`${src}.mp3`} type="audio/mpeg" />
      </audio>
      {children}
    </AudioContext_.Provider>
  );
}

export function useAudio(): AudioApi {
  const ctx = useContext(AudioContext_);
  if (!ctx) throw new Error("useAudio must be used inside <AudioProvider>");
  return ctx;
}
