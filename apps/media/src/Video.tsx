import {Buildings, HouseLine, MagnifyingGlass, Microphone, ShieldCheck, Translate, UsersThree} from "@phosphor-icons/react";
import {Audio} from "@remotion/media";
import {AbsoluteFill, Easing, Img, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig} from "remotion";

export type JourneyFormat = "youtube" | "x" | "linkedin" | "instagram";
type Props = {format: JourneyFormat};

const colors = {ink: "#102219", ivory: "#f7f3e9", white: "#fffdf8", moss: "#56703d", gold: "#ca8b13", clay: "#bb4329", cobalt: "#064276", sage: "#dfe8d7"};
const captions = [
  {from: 0, to: 165, text: "Access to care should not depend on where someone lives."},
  {from: 165, to: 360, text: "Meet Maya. She opens SozoRock Health at a trusted community hub and chooses her language."},
  {from: 360, to: 690, text: "She can speak, tap, or type. The voice guide listens, confirms what she needs, and keeps the next step clear."},
  {from: 690, to: 930, text: "SozoRock finds an available pathway in her county and checks provider readiness for her state."},
  {from: 930, to: 1170, text: "Maya connects through the provider’s existing platform. Clinical decisions stay with the licensed provider."},
  {from: 1170, to: 1350, text: "One human conversation. One clearer path forward. SozoRock Health."},
];

const fade = (frame: number, start: number, end: number) => interpolate(frame, [start, start + 18, end - 18, end], [0, 1, 1, 0], {extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1)});

function Brand({inverse = false}: {inverse?: boolean}) {
  return <div style={{display: "flex", alignItems: "flex-start", gap: 12}}>
    <Img src={staticFile("sozorock-wordmark-transparent.png")} style={{width: 190, height: 55, objectFit: "contain", objectPosition: "left center", filter: inverse ? "brightness(0) invert(1)" : "none"}} />
    <sup style={{fontFamily: "Arial, sans-serif", fontSize: 18, lineHeight: 1, color: inverse ? colors.ivory : colors.ink, marginLeft: -18, marginTop: 2}}>®</sup>
  </div>;
}

function Phone({stage}: {stage: "welcome" | "voice" | "route" | "connected"}) {
  const frame = useCurrentFrame();
  const bars = Array.from({length: 19}, (_, i) => 16 + Math.abs(Math.sin((frame + i * 11) / 10)) * 46);
  return <div style={{width: 430, height: 780, background: colors.white, border: `12px solid ${colors.ink}`, borderRadius: 48, boxShadow: "0 40px 90px rgba(16,34,25,.25)", padding: "42px 34px", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden"}}>
    <div style={{display: "flex", justifyContent: "space-between", alignItems: "center"}}><Brand/><span style={{fontFamily: "Arial", fontSize: 18, color: colors.moss}}>English</span></div>
    {stage === "welcome" && <div style={{marginTop: 80}}><p style={label}>Welcome, Maya</p><h2 style={phoneHeading}>How can we support you today?</h2><p style={phoneBody}>Speak, tap, or type. No account is needed to explore.</p><div style={{display: "grid", gap: 18, marginTop: 42}}><Choice icon={<MagnifyingGlass size={34}/>} title="Find care"/><Choice icon={<Buildings size={34}/>} title="Check in at a hub"/><Choice icon={<Translate size={34}/>} title="Language support"/></div></div>}
    {stage === "voice" && <div style={{display: "flex", flex: 1, flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center"}}><p style={label}>Listening</p><div style={{width: 116, height: 116, borderRadius: 58, background: colors.gold, display: "grid", placeItems: "center", color: colors.white, boxShadow: "0 0 0 18px rgba(202,139,19,.14)"}}><Microphone size={52} weight="fill"/></div><div style={{display: "flex", gap: 6, alignItems: "center", height: 90, marginTop: 34}}>{bars.map((height, i)=><span key={i} style={{width: 6, height, borderRadius: 4, background: i % 3 === 0 ? colors.clay : colors.moss}}/>)}</div><h2 style={{...phoneHeading, fontSize: 38, marginTop: 18}}>“I need help finding care near me.”</h2><p style={phoneBody}>Voice can be stopped at any time. A text option is always available.</p></div>}
    {stage === "route" && <div style={{marginTop: 76}}><div style={{width: 72, height: 72, borderRadius: 36, background: colors.sage, display: "grid", placeItems: "center", color: colors.moss}}><ShieldCheck size={40} weight="fill"/></div><p style={{...label, marginTop: 32}}>Pathway found</p><h2 style={phoneHeading}>Care options for Albany County, New York</h2><div style={{marginTop: 30, padding: 26, border: `1px solid ${colors.moss}`, borderRadius: 18}}><strong style={{font: "700 26px Arial"}}>Community Hub</strong><p style={phoneBody}>Language support available · Provider readiness confirmed</p></div><button style={phoneButton}>Continue securely</button></div>}
    {stage === "connected" && <div style={{display: "flex", flex: 1, flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center"}}><div style={{width: 126, height: 126, borderRadius: 63, background: colors.sage, display: "grid", placeItems: "center", color: colors.moss}}><UsersThree size={64} weight="fill"/></div><p style={{...label, marginTop: 34}}>Ready to connect</p><h2 style={phoneHeading}>Your provider’s secure platform will open next.</h2><p style={phoneBody}>SozoRock supports access. Your licensed provider remains responsible for care.</p><button style={phoneButton}>Open provider platform</button></div>}
    <div style={{position: "absolute", bottom: 22, left: 34, right: 34, display: "flex", justifyContent: "center", gap: 8, color: "#58645d", font: "16px Arial"}}><ShieldCheck size={20}/> Private · Non-clinical</div>
  </div>;
}

const label: React.CSSProperties = {fontFamily: "Arial, sans-serif", textTransform: "uppercase", letterSpacing: 3, fontSize: 18, fontWeight: 700, color: colors.moss};
const phoneHeading: React.CSSProperties = {fontFamily: "Georgia, serif", fontSize: 44, lineHeight: 1.04, fontWeight: 400, color: colors.ink, margin: "14px 0 18px"};
const phoneBody: React.CSSProperties = {fontFamily: "Arial, sans-serif", fontSize: 22, lineHeight: 1.45, color: "#425047", margin: 0};
const phoneButton: React.CSSProperties = {marginTop: 34, border: 0, background: colors.gold, color: colors.ink, borderRadius: 4, padding: "20px 24px", font: "700 22px Arial"};

function Choice({icon, title}: {icon: React.ReactNode; title: string}) {return <div style={{display: "flex", alignItems: "center", gap: 18, border: "1px solid #cfd5ce", padding: "20px", borderRadius: 14, font: "700 23px Arial", color: colors.ink}}><span style={{color: colors.moss}}>{icon}</span>{title}</div>}

function Caption() {
  const frame = useCurrentFrame();
  const current = captions.find(({from, to}) => frame >= from && frame < to) ?? captions[captions.length - 1];
  return <div style={{position: "absolute", left: "7%", right: "7%", bottom: "9%", display: "flex", justifyContent: "center", zIndex: 20}}><div style={{background: "rgba(16,34,25,.92)", color: colors.white, padding: "18px 26px", borderRadius: 8, font: "600 30px/1.28 Arial", textAlign: "center", maxWidth: 1250}}>{current.text}</div></div>;
}

function Scene({from, to, children}: {from: number; to: number; children: React.ReactNode}) {const frame=useCurrentFrame(); return <div style={{position:"absolute", inset:0, opacity:fade(frame, from, to)}}>{children}</div>}

export function ResidentJourney({format}: Props) {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const portrait = height > width;
  const square = height === width;
  const phoneScale = portrait ? 1.08 : square ? .92 : .88;
  return <AbsoluteFill style={{background: colors.ivory, color: colors.ink, overflow: "hidden"}}>
    <Audio src={staticFile("resident-journey-narration.wav")}/>
    <Scene from={0} to={165}><AbsoluteFill><Img src={staticFile("rural-road-aerial.png")} style={{width:"100%", height:"100%", objectFit:"cover"}}/><div style={{position:"absolute", inset:0, background:"linear-gradient(90deg, rgba(16,34,25,.92), rgba(16,34,25,.28))"}}/><div style={{position:"absolute", left:"7%", top:"15%", maxWidth: portrait ? "82%" : "54%", color:colors.white}}><Brand inverse/><h1 style={{fontFamily:"Georgia", fontWeight:400, fontSize:portrait?92:110, lineHeight:1.02, margin:"70px 0 28px"}}>Access begins with one clear conversation.</h1><p style={{font:"34px/1.45 Arial", maxWidth:900}}>A resident journey with SozoRock Health.</p></div></AbsoluteFill></Scene>
    <Scene from={165} to={360}><JourneyLayout portrait={portrait} title="Choose a path that feels clear." copy="Large controls, plain language, and voice support make the first step easier." phone={<Phone stage="welcome"/>} scale={phoneScale}/></Scene>
    <Scene from={360} to={690}><JourneyLayout portrait={portrait} title="Speak naturally. Stay in control." copy="The experience confirms intent, keeps a text fallback visible, and never gives clinical advice." phone={<Phone stage="voice"/>} scale={phoneScale}/></Scene>
    <Scene from={690} to={930}><JourneyLayout portrait={portrait} title="Find a ready pathway." copy="County, hub, language, and provider readiness come together in one simple next step." phone={<Phone stage="route"/>} scale={phoneScale}/></Scene>
    <Scene from={930} to={1170}><JourneyLayout portrait={portrait} title="Connect without replacing care." copy="Providers keep their own clinical platforms. SozoRock removes access barriers around the connection." phone={<Phone stage="connected"/>} scale={phoneScale}/></Scene>
    <Scene from={1170} to={1350}><AbsoluteFill style={{background:colors.ink, color:colors.white, display:"flex", alignItems:"center", justifyContent:"center", textAlign:"center", padding:"8%"}}><div><Brand inverse/><h1 style={{fontFamily:"Georgia", fontWeight:400, fontSize:portrait?98:120, lineHeight:1.02, maxWidth:1400, margin:"70px auto 30px"}}>One clearer path forward.</h1><p style={{font:"34px/1.45 Arial", color:colors.sage}}>Nationwide in scope. Local in activation.</p><div style={{display:"inline-flex", marginTop:42, background:colors.gold, color:colors.ink, padding:"22px 30px", font:"700 28px Arial"}}>health.sozorockfoundation.org</div></div></AbsoluteFill></Scene>
    <Caption/>
    <div style={{position:"absolute", top:"4%", right:"5%", font:"700 18px Arial", letterSpacing:2.5, textTransform:"uppercase", color:frame<165||frame>=1170?colors.white:colors.moss}}>Resident journey · {format}</div>
  </AbsoluteFill>;
}

function JourneyLayout({portrait, title, copy, phone, scale}: {portrait:boolean; title:string; copy:string; phone:React.ReactNode; scale:number}) {return <AbsoluteFill style={{display:"flex", flexDirection:portrait?"column":"row", alignItems:"center", justifyContent:"center", gap:portrait?40:120, padding:portrait?"9% 8% 13%":"7% 8% 10%"}}><div style={{maxWidth:portrait?820:740, textAlign:portrait?"center":"left"}}><Brand/><h1 style={{fontFamily:"Georgia", fontWeight:400, fontSize:portrait?82:92, lineHeight:1.02, margin:"58px 0 28px"}}>{title}</h1><p style={{font:"32px/1.5 Arial", color:"#425047"}}>{copy}</p></div><div style={{scale, transformOrigin:"center"}}>{phone}</div></AbsoluteFill>}

export function ResidentJourneyStill({format}: Props) {return <AbsoluteFill style={{background:colors.ivory}}><JourneyLayout portrait={format==="instagram"} title="Speak naturally. Find a clearer path." copy="Voice-first access, language support, and provider readiness—designed around the resident." phone={<Phone stage="voice"/>} scale={format==="instagram"?1.04:.9}/></AbsoluteFill>}
