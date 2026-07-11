import {Buildings, HouseLine, MapPin, Microphone, ShieldCheck, Translate, UsersThree} from "@phosphor-icons/react";
import {Audio} from "@remotion/media";
import {AbsoluteFill, Easing, Img, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig} from "remotion";

export type SocialFormat = "shorts" | "instagram" | "linkedin" | "x";
type Props = {format: SocialFormat};

const C = {ink: "#10251d", ivory: "#f4f0e6", paper: "#fffdf8", moss: "#526b42", gold: "#d69a1f", clay: "#b64a32", blue: "#0b426d", mist: "#dce5da", line: "#c9c9bc"};
const serif = 'Georgia, "Times New Roman", serif';
const sans = 'Arial, Helvetica, sans-serif';

const captions = [
  {start: 0, end: 240, text: "A care journey can begin with something simple: being heard."},
  {start: 240, end: 540, text: "Meet Maya. Today, getting to care means distance, time, and one more unfamiliar system."},
  {start: 540, end: 900, text: "At a trusted Health Equity Hub, local support and a prepared provider pathway are ready around her."},
  {start: 900, end: 1200, text: "Maya says, I need help finding care near me. The guide confirms her request in plain language."},
  {start: 1200, end: 1530, text: "With permission, the Resident Access Layer checks county, language, digital readiness, and provider readiness."},
  {start: 1530, end: 1860, text: "A clear option appears. Maya chooses it, then moves securely to the provider's own platform."},
  {start: 1860, end: 2160, text: "SozoRock does not diagnose, prescribe, or replace care. It makes the path to a licensed provider easier to follow."},
  {start: 2160, end: 2400, text: "One calm conversation. One clearer next step. Access where people live."},
];

const appear = (frame: number, from: number, to: number) => interpolate(frame, [from, from + 16, to - 16, to], [0, 1, 1, 0], {extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1)});
const rise = (frame: number, from: number) => interpolate(frame, [from, from + 24], [34, 0], {extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1)});

function Wordmark({light = false}: {light?: boolean}) {
  return <Img src={staticFile("sozorock-wordmark-transparent.png")} style={{width: 230, height: 67, objectFit: "contain", objectPosition: "left center", filter: light ? "brightness(0) invert(1)" : "none"}} />;
}

function EditorialLabel({children, light = false}: {children: React.ReactNode; light?: boolean}) {
  return <div style={{fontFamily: sans, fontSize: 22, lineHeight: 1.2, fontWeight: 800, letterSpacing: 4, textTransform: "uppercase", color: light ? C.ivory : C.moss}}>{children}</div>;
}

function Scene({from, to, children}: {from: number; to: number; children: React.ReactNode}) {
  const frame = useCurrentFrame();
  return <Sequence from={from} durationInFrames={to - from}><AbsoluteFill style={{opacity: appear(frame, from, to)}}>{children}</AbsoluteFill></Sequence>;
}

function CaptionRail() {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const landscape = width > height;
  const caption = captions.find((item) => frame >= item.start && frame < item.end) ?? captions.at(-1)!;
  return <div style={{position: "absolute", left: "7.5%", right: "7.5%", bottom: "5.5%", zIndex: 30, display: "flex", justifyContent: "center"}}>
    <div style={{maxWidth: 1040, padding: landscape ? "11px 18px" : "15px 22px", background: "rgba(9,28,22,.94)", color: C.paper, fontFamily: sans, fontSize: landscape ? 22 : 28, lineHeight: 1.32, fontWeight: 700, textAlign: "center", borderRadius: 6}}>{caption.text}</div>
  </div>;
}

function PhotoScene({portrait}: {portrait: boolean}) {
  return <AbsoluteFill>
    <Img src={staticFile("rural-road-aerial.png")} style={{width: "100%", height: "100%", objectFit: "cover", objectPosition: portrait ? "58% center" : "center 52%", scale: 1.04}} />
    <AbsoluteFill style={{background: portrait ? "linear-gradient(180deg, rgba(8,29,25,.18) 0%, rgba(8,29,25,.9) 76%)" : "linear-gradient(90deg, rgba(8,29,25,.92) 0%, rgba(8,29,25,.24) 72%)"}} />
  </AbsoluteFill>;
}

function VoiceDevice({stage}: {stage: "welcome" | "listen" | "confirm" | "handoff"}) {
  const frame = useCurrentFrame();
  const bars = Array.from({length: 17}, (_, i) => 20 + Math.abs(Math.sin((frame + i * 8) / 11)) * 52);
  return <div style={{width: 440, height: 800, background: C.paper, border: `10px solid ${C.ink}`, borderRadius: 52, boxShadow: "0 34px 80px rgba(16,37,29,.24)", padding: "42px 34px 48px", display: "flex", flexDirection: "column", position: "relative"}}>
    <div style={{display: "flex", alignItems: "center", justifyContent: "space-between"}}><Wordmark/><span style={{font: `600 18px ${sans}`, color: C.moss}}>English</span></div>
    {stage === "welcome" && <div style={{marginTop: 82}}><EditorialLabel>Welcome, Maya</EditorialLabel><h2 style={deviceHeading}>What are you trying to get ready for?</h2><p style={deviceBody}>Use your voice, tap a choice, or type. You are always in control.</p><div style={{display: "grid", gap: 18, marginTop: 38}}><DeviceChoice icon={<Microphone size={34}/>} text="Speak"/><DeviceChoice icon={<Translate size={34}/>} text="Choose a language"/><DeviceChoice icon={<MapPin size={34}/>} text="Prepare for a visit"/></div></div>}
    {stage === "listen" && <div style={deviceCenter}><EditorialLabel>Listening</EditorialLabel><div style={{width: 118, height: 118, borderRadius: 59, marginTop: 34, background: C.gold, color: C.ink, display: "grid", placeItems: "center"}}><Microphone size={56} weight="fill"/></div><div style={{display: "flex", alignItems: "center", gap: 7, height: 100, marginTop: 30}}>{bars.map((h, i) => <span key={i} style={{width: 7, height: h, borderRadius: 7, background: i % 4 === 0 ? C.clay : C.moss}}/>)}</div><h2 style={{...deviceHeading, fontSize: 42, marginTop: 16}}>“I need help finding care near me.”</h2><p style={deviceBody}>Take your time. I’ll confirm before moving on.</p></div>}
    {stage === "confirm" && <div style={{marginTop: 76}}><EditorialLabel>Here’s what I heard</EditorialLabel><h2 style={deviceHeading}>You want help finding an available care option near Albany County.</h2><div style={{marginTop: 28, padding: "24px 26px", borderLeft: `5px solid ${C.gold}`, background: C.ivory}}><p style={{...deviceBody, fontWeight: 700}}>Is that right?</p></div><div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 30}}><div style={devicePrimary}>Yes, continue</div><div style={deviceSecondary}>Change it</div></div></div>}
    {stage === "handoff" && <div style={deviceCenter}><div style={{width: 120, height: 120, borderRadius: 60, background: C.mist, color: C.moss, display: "grid", placeItems: "center"}}><UsersThree size={64} weight="fill"/></div><EditorialLabel>Ready when you are</EditorialLabel><h2 style={deviceHeading}>Open the provider’s secure platform.</h2><p style={deviceBody}>The licensed provider remains responsible for care and clinical decisions.</p><div style={{...devicePrimary, width: "100%", marginTop: 32}}>Continue securely</div></div>}
    <div style={{position: "absolute", left: 34, right: 34, bottom: 23, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "#536159", font: `600 16px ${sans}`}}><ShieldCheck size={19}/> Private · Non-clinical</div>
  </div>;
}

const deviceHeading: React.CSSProperties = {fontFamily: serif, fontSize: 47, lineHeight: 1.05, fontWeight: 400, color: C.ink, margin: "17px 0 20px"};
const deviceBody: React.CSSProperties = {fontFamily: sans, fontSize: 23, lineHeight: 1.45, color: "#435149", margin: 0};
const deviceCenter: React.CSSProperties = {display: "flex", flex: 1, flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center"};
const devicePrimary: React.CSSProperties = {background: C.gold, color: C.ink, padding: "19px 18px", textAlign: "center", borderRadius: 5, font: `800 21px ${sans}`};
const deviceSecondary: React.CSSProperties = {border: `2px solid ${C.ink}`, color: C.ink, padding: "17px 18px", textAlign: "center", borderRadius: 5, font: `800 21px ${sans}`};
function DeviceChoice({icon, text}: {icon: React.ReactNode; text: string}) {return <div style={{display: "flex", alignItems: "center", gap: 17, padding: "20px", borderBottom: `1px solid ${C.line}`, color: C.ink, font: `750 23px ${sans}`}}><span style={{color: C.moss}}>{icon}</span>{text}</div>}

function StoryLayout({portrait, label, title, body, device}: {portrait: boolean; label: string; title: string; body: string; device: React.ReactNode}) {
  return <AbsoluteFill style={{background: C.ivory, color: C.ink, padding: portrait ? "8% 8% 12%" : "4.5% 8% 9%", display: "flex", flexDirection: portrait ? "column" : "row", alignItems: "center", justifyContent: "center", gap: portrait ? 52 : 70}}>
    <div style={{maxWidth: portrait ? 820 : 560, textAlign: portrait ? "center" : "left"}}><Wordmark/><div style={{marginTop: portrait ? 52 : 24}}><EditorialLabel>{label}</EditorialLabel></div><h1 style={{fontFamily: serif, fontSize: portrait ? 83 : 70, lineHeight: .99, fontWeight: 400, margin: portrait ? "28px 0" : "18px 0"}}>{title}</h1><p style={{fontFamily: sans, fontSize: portrait ? 31 : 24, lineHeight: 1.4, color: "#425148", margin: 0}}>{body}</p></div>
    <div style={{scale: portrait ? .96 : .65, transformOrigin: "center"}}>{device}</div>
  </AbsoluteFill>;
}

function NetworkScene({portrait}: {portrait: boolean}) {
  const items = [
    {icon: <Buildings size={56}/>, title: "Health Equity Hubs", text: "A trusted, digitally ready place to begin."},
    {icon: <UsersThree size={56}/>, title: "Health Access Days", text: "Local support and prepared provider pathways."},
    {icon: <HouseLine size={56}/>, title: "Home access", text: "The same clear starting point from home."},
  ];
  return <AbsoluteFill style={{background: C.ink, color: C.paper, padding: portrait ? "11% 8% 14%" : "8%", display: "flex", flexDirection: "column", justifyContent: "center"}}>
    <Wordmark light/><EditorialLabel light>Resident Access Layer</EditorialLabel><h1 style={{fontFamily: serif, fontSize: portrait ? 96 : 108, lineHeight: 1, fontWeight: 400, maxWidth: 1100, margin: "32px 0 54px"}}>Understand where to start. Prepare for a provider-led pathway.</h1>
    <div style={{display: "grid", gridTemplateColumns: portrait ? "1fr" : "repeat(3, 1fr)", gap: portrait ? 22 : 34}}>{items.map((item) => <div key={item.title} style={{display: "grid", gridTemplateColumns: portrait ? "86px 1fr" : "1fr", gap: 18, padding: portrait ? "26px 0" : "30px 0", borderTop: `1px solid rgba(244,240,230,.38)`, color: C.ivory}}><span style={{color: C.gold}}>{item.icon}</span><div><strong style={{font: `700 29px ${sans}`}}>{item.title}</strong><p style={{font: `23px/1.4 ${sans}`, color: C.mist, margin: "8px 0 0"}}>{item.text}</p></div></div>)}</div>
  </AbsoluteFill>;
}

export function ResidentJourney80({format}: Props) {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const portrait = height / width > 1.2;
  return <AbsoluteFill style={{background: C.ivory, overflow: "hidden"}}>
    <Audio src={staticFile("resident-journey-80s-narration.mp3")} />
    <Scene from={0} to={240}><PhotoScene portrait={portrait}/><div style={{position: "absolute", left: "8%", right: "8%", top: portrait ? "11%" : "15%", color: C.paper, translate: `0 ${rise(frame, 0)}px`}}><Wordmark light/><EditorialLabel light>A resident journey</EditorialLabel><h1 style={{fontFamily: serif, fontSize: portrait ? 102 : 118, lineHeight: .98, fontWeight: 400, maxWidth: portrait ? 850 : 900, margin: "34px 0"}}>Readiness starts with being heard.</h1></div></Scene>
    <Scene from={240} to={540}><PhotoScene portrait={portrait}/><div style={{position: "absolute", left: "8%", right: "8%", bottom: portrait ? "21%" : "23%", color: C.paper}}><EditorialLabel light>Meet Maya</EditorialLabel><h1 style={{fontFamily: serif, fontSize: portrait ? 92 : 108, lineHeight: 1, fontWeight: 400, maxWidth: 1000, margin: "28px 0"}}>Distance should not decide whether the next step feels possible.</h1><p style={{font: `30px/1.45 ${sans}`, maxWidth: 780, color: C.mist}}>A trusted hub brings the doorway closer.</p></div></Scene>
    <Scene from={540} to={900}><StoryLayout portrait={portrait} label="Begin your way" title="A voice that makes room for a pause." body="No rush. No unfamiliar clinical language. Voice, touch, and text remain equally available." device={<VoiceDevice stage="welcome"/>}/></Scene>
    <Scene from={900} to={1200}><StoryLayout portrait={portrait} label="Listen, then confirm" title="Natural language. Clear permission." body="The guide reflects Maya’s request back before using it to find an access pathway." device={<VoiceDevice stage="listen"/>}/></Scene>
    <Scene from={1200} to={1530}><StoryLayout portrait={portrait} label="Maya stays in control" title="Nothing moves forward without a yes." body="County, language, digital readiness, and provider readiness are checked only after a clear confirmation." device={<VoiceDevice stage="confirm"/>}/></Scene>
    <Scene from={1530} to={1860}><StoryLayout portrait={portrait} label="The handoff" title="Access support meets licensed care." body="SozoRock opens the provider’s platform. The provider owns the clinical relationship." device={<VoiceDevice stage="handoff"/>}/></Scene>
    <Scene from={1860} to={2160}><NetworkScene portrait={portrait}/></Scene>
    <Scene from={2160} to={2400}><PhotoScene portrait={portrait}/><AbsoluteFill style={{display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", color: C.paper, padding: "8%"}}><div><Wordmark light/><h1 style={{fontFamily: serif, fontSize: portrait ? 103 : 120, lineHeight: .98, fontWeight: 400, maxWidth: 1050, margin: "42px auto 28px"}}>One calm conversation. One clearer next step.</h1><p style={{font: `700 29px/1.4 ${sans}`, color: C.mist}}>Nationwide in scope. Local in activation. Strictly non-clinical.</p><div style={{marginTop: 45, color: C.gold, font: `800 28px ${sans}`, letterSpacing: 1}}>health.sozorockfoundation.org</div></div></AbsoluteFill></Scene>
    <CaptionRail/>
    <div style={{position: "absolute", top: "3.2%", right: "4.5%", zIndex: 40, font: `800 17px ${sans}`, letterSpacing: 3, textTransform: "uppercase", color: frame < 540 || frame >= 1860 ? C.paper : C.moss}}>SozoRock Health · {format}</div>
  </AbsoluteFill>;
}

export function ResidentJourneyPoster({format}: Props) {
  const portrait = format !== "x";
  return <AbsoluteFill><PhotoScene portrait={portrait}/><div style={{position: "absolute", left: "8%", right: "8%", bottom: "12%", color: C.paper}}><Wordmark light/><EditorialLabel light>Resident journey</EditorialLabel><h1 style={{fontFamily: serif, fontSize: portrait ? 103 : 112, lineHeight: .98, fontWeight: 400, maxWidth: 900, margin: "32px 0"}}>Readiness starts with being heard.</h1><p style={{font: `700 29px/1.4 ${sans}`, color: C.mist}}>Voice Access. Digital readiness. Provider-led pathways.</p></div></AbsoluteFill>;
}
