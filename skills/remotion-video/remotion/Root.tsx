import type {JSX} from "react";

import {Composition, registerRoot} from "remotion";

import {DEFAULT_COMPOSITION_ID, DEFAULT_RENDER_SPEC} from "./defaults";
import {BrandedStarterComposition} from "./BrandedStarter";
import type {RenderSpecInputProps} from "./types";

export function Root(): JSX.Element {
  return (
    <Composition
      id={DEFAULT_COMPOSITION_ID}
      component={BrandedStarterComposition}
      defaultProps={{renderSpec: DEFAULT_RENDER_SPEC} as RenderSpecInputProps}
      calculateMetadata={({props}) => {
        const renderSpec = props.renderSpec ?? DEFAULT_RENDER_SPEC;

        return {
          durationInFrames: Math.max(1, Math.round(renderSpec.duration_seconds * renderSpec.fps)),
          fps: renderSpec.fps,
          width: renderSpec.width,
          height: renderSpec.height,
        };
      }}
    />
  );
}

registerRoot(Root);

export default Root;
