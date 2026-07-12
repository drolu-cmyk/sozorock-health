import {Composition, Still} from "remotion";
import {LiveCampaign, LiveCampaignPoster, type Locale, type SocialFormat} from "./Video";

const FPS = 30;
const DURATION = 80 * FPS;

const formats: Array<{id: string; format: SocialFormat; width: number; height: number}> = [
  {id: "Shorts", format: "shorts", width: 1080, height: 1920},
  {id: "Instagram", format: "instagram", width: 1080, height: 1920},
  {id: "LinkedIn", format: "linkedin", width: 1080, height: 1350},
  {id: "X", format: "x", width: 1280, height: 720},
];

const locales: Array<{id: string; locale: Locale}> = [
  {id: "En", locale: "en"},
  {id: "Es", locale: "es"},
];

export const RemotionRoot = () => <>
  {locales.flatMap(({id: localeId, locale}) => formats.map(({id, format, width, height}) => (
    <Composition key={`${localeId}${id}`} id={`SozoRockLive${localeId}${id}`} component={LiveCampaign} durationInFrames={DURATION} fps={FPS} width={width} height={height} defaultProps={{format, locale}} />
  )))}
  {locales.flatMap(({id: localeId, locale}) => formats.map(({id, format, width, height}) => (
    <Still key={`${localeId}${id}Poster`} id={`SozoRockLive${localeId}${id}Poster`} component={LiveCampaignPoster} width={width} height={height} defaultProps={{format, locale}} />
  )))}
</>;
