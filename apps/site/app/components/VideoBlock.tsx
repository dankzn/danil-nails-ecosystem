export function VideoBlock({
  label,
  note,
  src
}: {
  label: string;
  note: string;
  src?: string;
}) {
  return (
    <div className="video-block">
      {src ? (
        <video
          className="video-block-media"
          src={src}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
        />
      ) : (
        <div className="video-block-placeholder">
          <span className="video-block-play" aria-hidden="true" />
          <span className="video-block-label">{label}</span>
          <span className="video-block-note">{note}</span>
        </div>
      )}
    </div>
  );
}
