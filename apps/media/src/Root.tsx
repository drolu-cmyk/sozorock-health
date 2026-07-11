import {Composition, Still} from "remotion";
import {ResidentJourney80, ResidentJourneyPoster, type SocialFormat} from "./Video";

const FPS = 30;
const DURATION = 80 * FPS;

const formats: Array<{id: string; format: SocialFormat; width: number; height: number}> = [
  {id: "SozoRockJourneyShorts", format: "shorts", width: 1080, height: 1920},
  {id: "SozoRockJourneyInstagram", format: "instagram", width: 1080, height: 1920},
  {id: "SozoRockJourneyLinkedIn", format: "linkedin", width: 1080, height: 1350},
  {id: "SozoRockJourneyX", format: "x", width: 1280, height: 720},
];

export const RemotionRoot = () => <>
  {formats.map(({id, format, width, height}) => (
    <Composition key={id} id={id} component={ResidentJourney80} durationInFrames={DURATION} fps={FPS} width={width} height={height} defaultProps={{format}} />
  ))}
  {formats.map(({id, format, width, height}) => (
    <Still key={`${id}Poster`} id={`${id}Poster`} component={ResidentJourneyPoster} width={width} height={height} defaultProps={{format}} />
  ))}
</>;
