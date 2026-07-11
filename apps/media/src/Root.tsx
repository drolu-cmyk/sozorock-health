import {Composition, Still} from "remotion";
import {ResidentJourney, ResidentJourneyStill, type JourneyFormat} from "./Video";

const formats: Array<{id: string; format: JourneyFormat; width: number; height: number}> = [
  {id: "ResidentJourneyYouTube", format: "youtube", width: 1920, height: 1080},
  {id: "ResidentJourneyX", format: "x", width: 1280, height: 720},
  {id: "ResidentJourneyLinkedIn", format: "linkedin", width: 1080, height: 1080},
  {id: "ResidentJourneyInstagram", format: "instagram", width: 1080, height: 1350},
];

export const RemotionRoot = () => <>
  {formats.map(({id, format, width, height}) => <Composition key={id} id={id} component={ResidentJourney} durationInFrames={1350} fps={30} width={width} height={height} defaultProps={{format}} />)}
  {formats.map(({id, format, width, height}) => <Still key={`${id}Still`} id={`${id}Still`} component={ResidentJourneyStill} width={width} height={height} defaultProps={{format}} />)}
</>;
