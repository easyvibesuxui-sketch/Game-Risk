import { useEffect, useRef, useState, type ReactNode } from "react";

export const videoUrl = (file: string) => `${import.meta.env.BASE_URL}video/${file}`;

interface Props {
  /** File name without extension; a WebM and an MP4 of it sit in public/video. */
  name: string;
  poster?: string;
  /** Called when the clip ends, is skipped, or cannot play. */
  onDone?: () => void;
  /** Keep the last frame on screen instead of calling onDone at the end. */
  hold?: boolean;
  skipLabel?: string;
  children?: ReactNode;
  className?: string;
}

/**
 * Full-screen film. Starts muted so browsers allow autoplay, with a button to
 * turn the sound on; tries unmuted first when the page already had a click.
 */
export function Cinematic({ name, poster, onDone, hold, skipLabel = "Skip", children, className }: Props) {
  const ref = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [ended, setEnded] = useState(false);
  const done = useRef(false);

  const finish = () => {
    if (done.current) return;
    done.current = true;
    onDone?.();
  };

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.muted = false;
    v.play()
      .then(() => setMuted(false))
      .catch(() => {
        v.muted = true;
        setMuted(true);
        v.play().catch(() => finish());
      });
  }, []);

  const toggleSound = () => {
    const v = ref.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
    if (v.paused) void v.play();
  };

  return (
    <div className={`cinematic${ended ? " ended" : ""}${className ? ` ${className}` : ""}`}>
      <video
        ref={ref}
        poster={poster ?? videoUrl(`${name}.jpg`)}
        playsInline
        muted={muted}
        preload="auto"
        onEnded={() => {
          setEnded(true);
          if (!hold) finish();
        }}
      >
        <source src={videoUrl(`${name}.webm`)} type="video/webm" />
        {/* The last source failing means nothing here can play: move on. */}
        <source src={videoUrl(`${name}.mp4`)} type="video/mp4" onError={() => finish()} />
      </video>
      <div className="cinematic-shade" />
      {children}
      <div className="cinematic-controls">
        <button type="button" className="btn ghost light" onClick={toggleSound}>
          {muted ? "Sound on" : "Mute"}
        </button>
        {!(hold && ended) && (
          <button type="button" className="btn ghost light" onClick={finish}>
            {skipLabel}
          </button>
        )}
      </div>
    </div>
  );
}
