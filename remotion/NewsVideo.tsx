import {
  AbsoluteFill,
  Audio,
  Img,
  OffthreadVideo,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export type Caption = { text: string; start: number; end: number };

export type NewsProps = {
  /** staticFile-relative path, e.g. "job/bg.png" or "job/talking.mp4" */
  bg: string;
  bgType: "image" | "video";
  /** staticFile-relative path to narration audio, e.g. "job/narration.wav" */
  audio: string;
  /** segment-level captions for the lower-third telop */
  captions: Caption[];
  /** headline shown in the top bar */
  title: string;
  /** channel / brand label shown next to the NEWS tag */
  brand: string;
  fps: number;
  durationInSeconds: number;
};

export const newsDefaultProps: NewsProps = {
  bg: "job/bg.png",
  bgType: "image",
  audio: "job/narration.wav",
  captions: [
    { text: "サンプルテロップです", start: 0, end: 3 },
    { text: "Remotion で合成されています", start: 3, end: 6 },
  ],
  title: "AIニュース",
  brand: "AI NEWS",
  fps: 30,
  durationInSeconds: 6,
};

const Background: React.FC<{ bg: string; bgType: NewsProps["bgType"] }> = ({ bg, bgType }) => {
  const src = staticFile(bg);
  if (bgType === "video") {
    return (
      <OffthreadVideo
        src={src}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
        muted
      />
    );
  }
  return <Img src={src} style={{ width: "100%", height: "100%", objectFit: "cover" }} />;
};

const TopBar: React.FC<{ title: string; brand: string }> = ({ title, brand }) => {
  const frame = useCurrentFrame();
  const slide = interpolate(frame, [0, 15], [-120, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: 110,
        transform: `translateY(${slide}px)`,
        display: "flex",
        alignItems: "center",
        gap: 24,
        padding: "0 48px",
        background: "linear-gradient(90deg, rgba(8,12,28,0.95), rgba(8,12,28,0.55))",
        borderBottom: "4px solid #e11d2a",
      }}
    >
      <div
        style={{
          background: "#e11d2a",
          color: "#fff",
          fontWeight: 800,
          fontSize: 34,
          letterSpacing: 2,
          padding: "10px 22px",
          borderRadius: 6,
          fontFamily: "'Hiragino Sans', 'Noto Sans JP', sans-serif",
        }}
      >
        {brand}
      </div>
      <div
        style={{
          color: "#fff",
          fontWeight: 700,
          fontSize: 46,
          fontFamily: "'Hiragino Sans', 'Noto Sans JP', sans-serif",
          textShadow: "0 2px 8px rgba(0,0,0,0.6)",
        }}
      >
        {title}
      </div>
    </div>
  );
};

const Telop: React.FC<{ captions: Caption[] }> = ({ captions }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const active = captions.find((c) => t >= c.start && t < c.end);
  if (!active) return null;
  const local = t - active.start;
  const appear = interpolate(local, [0, 0.18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 80,
        display: "flex",
        justifyContent: "center",
        padding: "0 120px",
        opacity: appear,
        transform: `translateY(${(1 - appear) * 24}px)`,
      }}
    >
      <div
        style={{
          maxWidth: 1500,
          background: "rgba(8,12,28,0.82)",
          borderLeft: "8px solid #e11d2a",
          color: "#fff",
          fontSize: 56,
          fontWeight: 700,
          lineHeight: 1.35,
          padding: "20px 40px",
          borderRadius: 8,
          textAlign: "center",
          fontFamily: "'Hiragino Sans', 'Noto Sans JP', sans-serif",
          textShadow: "0 2px 6px rgba(0,0,0,0.7)",
        }}
      >
        {active.text}
      </div>
    </div>
  );
};

export const NewsVideo: React.FC<NewsProps> = ({ bg, bgType, audio, captions, title, brand }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#05070f" }}>
      <Background bg={bg} bgType={bgType} />
      <Audio src={staticFile(audio)} />
      <Sequence>
        <TopBar title={title} brand={brand} />
        <Telop captions={captions} />
      </Sequence>
    </AbsoluteFill>
  );
};
