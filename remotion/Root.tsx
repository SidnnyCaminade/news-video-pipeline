import { Composition } from "remotion";
import { NewsVideo, newsDefaultProps, type NewsProps } from "./NewsVideo";

export const RemotionRoot = () => {
  return (
    <Composition
      id="NewsVideo"
      component={NewsVideo}
      durationInFrames={300}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={newsDefaultProps}
      calculateMetadata={({ props }: { props: NewsProps }) => {
        const fps = props.fps ?? 30;
        return {
          fps,
          durationInFrames: Math.max(1, Math.round((props.durationInSeconds ?? 10) * fps)),
        };
      }}
    />
  );
};
