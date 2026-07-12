import {CheckCircle, GlobeHemisphereWest, HouseLine, MapPin, Microphone, ShieldCheck, UserCircle} from "@phosphor-icons/react";
import {Audio} from "@remotion/media";
import {AbsoluteFill, Easing, Img, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig} from "remotion";
import campaignSource from "../gpt-live-campaign/campaign.json";

export type SocialFormat = "shorts" | "instagram" | "linkedin" | "x";
export type Locale = "en" | "es";
type Speaker = "resident" | "guide" | "narrator";
type Props = {format: SocialFormat; locale: Locale; voiceReady?: boolean};
type DialogueLine = {id: string; speaker: Speaker; startMs: number; endMs: number; text: string};
type Interruption = {interruptedLineId: string; interruptingLineId: string; yieldAtMs: number; fadeMs: number};

const campaign = campaignSource as unknown as {production: {interruption: Interruption}; locales: Record<Locale, {language: string; persona: string; closing: string; lines: DialogueLine[]}>};
const C = {ink: "#081d19", ink2: "#102d27", paper: "#fbf8ef", moss: "#8eb174", gold: "#efbc53", clay: "#d76b52", cyan: "#75c9c3", line: "rgba(251,248,239,.18)", quiet: "#bfd0c7"};
const serif = 'Georgia, "Times New Roman", serif';
const sans = 'Arial, Helvetica, sans-serif';

const labels = {
  en: {product: "Voice Access", boundary: "Non-clinical support", illustrative: "Illustrative resident journey", preview: "Visual preview · voice pending", listening: "Listening", speaking: "Responding", permission: "Permission before search", use: "Use county and language", county: "Delaware County", language: "English", choices: "Request preview", result: "Review first. Submit by tap or text.", request: "Non-clinical request details", details: "County · language · transportation", readiness: "Submission control", pending: "Nothing submitted yet", notClinical: "SozoRock Health", provider: "Licensed provider", prepare: "Preview and prepare", care: "Clinical care", open: "Ready for review", bring: "Review details", visit: "Digital readiness", followup: "Tap or text submission", private: "Private by design · non-clinical", resident: "Renata", close: "One natural conversation.", closer: "One clearer next step."},
  es: {product: "Acceso por Voz", boundary: "Apoyo no clínico", illustrative: "Recorrido ilustrativo de una residente", preview: "Vista previa · voz pendiente", listening: "Escuchando", speaking: "Respondiendo", permission: "Permiso antes de buscar", use: "Usar condado e idioma", county: "Condado de Delaware", language: "Español", choices: "Vista previa de la solicitud", result: "Revisa primero. Envía por toque o texto.", request: "Datos de la solicitud no clínica", details: "Condado · idioma · transporte", readiness: "Control del envío", pending: "Aún no se ha enviado nada", notClinical: "SozoRock Health", provider: "Proveedor autorizado", prepare: "Revisar y prepararse", care: "Atención clínica", open: "Lista para revisión", bring: "Revisar datos", visit: "Preparación digital", followup: "Envío por toque o texto", private: "Privado por diseño · no clínico", resident: "Renata", close: "Una conversación natural.", closer: "Un próximo paso más claro."}
} as const;

const eased = (frame: number, input: [number, number], output: [number, number]) => interpolate(frame, input, output, {extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(.16, 1, .3, 1)});

function Wordmark({width = 245}: {width?: number}) {
  const nameWidth = width * .68;
  return <div style={{width, display: "flex", alignItems: "center", gap: width * .035, color: C.paper}}>
    <span style={{display: "flex", alignItems: "flex-start"}}><Img src={staticFile("sozorock-wordmark-clean.png")} style={{width: nameWidth, height: nameWidth * .25, objectFit: "contain", objectPosition: "left center"}}/><sup style={{font: `700 ${Math.max(10, width*.05)}px/1 ${sans}`, color: C.gold, marginLeft: 1, marginTop: width*.015}}>®</sup></span>
    <span style={{font: `400 ${width*.14}px/1 ${serif}`, color: C.moss, whiteSpace: "nowrap"}}>Health</span>
  </div>;
}

function SystemBackground() {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const progress = eased(frame, [0, 80 * 30], [1150, 0]);
  const portrait = height > width;
  return <AbsoluteFill style={{background: C.ink, overflow: "hidden"}}>
    <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{position: "absolute", inset: 0}} aria-hidden>
      <defs><pattern id="dotgrid" width="42" height="42" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.5" fill="rgba(142,177,116,.16)"/></pattern></defs>
      <rect width="100%" height="100%" fill="url(#dotgrid)"/>
      <path d={portrait ? `M -80 ${height*.76} C ${width*.12} ${height*.7}, ${width*.12} ${height*.4}, ${width*.48} ${height*.42} S ${width*.76} ${height*.12}, ${width+90} ${height*.2}` : `M -80 ${height*.7} C ${width*.15} ${height*.76}, ${width*.2} ${height*.25}, ${width*.48} ${height*.42} S ${width*.78} ${height*.7}, ${width+80} ${height*.2}`} fill="none" stroke={C.gold} strokeWidth={4} strokeLinecap="round" strokeDasharray="18 11" strokeDashoffset={progress}/>
      <path d={portrait ? `M -60 ${height*.82} C ${width*.2} ${height*.75}, ${width*.26} ${height*.54}, ${width*.52} ${height*.49} S ${width*.82} ${height*.25}, ${width+60} ${height*.28}` : `M -50 ${height*.8} C ${width*.17} ${height*.68}, ${width*.28} ${height*.34}, ${width*.5} ${height*.48} S ${width*.75} ${height*.62}, ${width+50} ${height*.28}`} fill="none" stroke="rgba(117,201,195,.23)" strokeWidth={16}/>
    </svg>
  </AbsoluteFill>;
}

function Header({locale}: {locale: Locale}) {
  const {width, height} = useVideoConfig();
  const portrait = height > width;
  return <div style={{position: "absolute", zIndex: 30, top: portrait ? 74 : 32, left: portrait ? 68 : 58, right: portrait ? 68 : 58, display: "flex", alignItems: "center", justifyContent: "space-between"}}>
    <Wordmark width={portrait ? 260 : 210}/>
    <div style={{font: `800 ${portrait ? 25 : 18}px/1 ${sans}`, letterSpacing: 2.5, textTransform: "uppercase", color: C.moss, textAlign: "right"}}>{labels[locale].product}<br/><span style={{color: C.quiet, fontSize: ".76em"}}>{labels[locale].boundary}</span><br/><span style={{color: C.gold, fontSize: ".58em", letterSpacing: 1.6}}>{labels[locale].illustrative}</span></div>
  </div>;
}

function PreviewBadge({locale}: {locale: Locale}) {
  const {width, height} = useVideoConfig();
  const portrait = height > width;
  return <div style={{position: "absolute", zIndex: 60, top: portrait ? 170 : 20, left: "50%", translate: "-50% 0", padding: portrait ? "10px 16px" : "8px 13px", border: `1px solid ${C.gold}`, background: C.ink, color: C.gold, font: `800 ${portrait ? 18 : 14}px ${sans}`, letterSpacing: portrait ? 2.4 : 2, textTransform: "uppercase", whiteSpace: "nowrap"}}>{labels[locale].preview}</div>;
}

function VoiceCore({active}: {active: boolean}) {
  const frame = useCurrentFrame();
  const size = 226;
  const pulse = 1 + Math.sin(frame / 7) * .045;
  const bars = Array.from({length: 19}, (_, index) => 13 + Math.abs(Math.sin((frame + index * 8) / 8)) * (active ? 54 : 20));
  return <div style={{display: "flex", flexDirection: "column", alignItems: "center", gap: 28}}>
    <div style={{width: size, height: size, borderRadius: "50%", border: `2px solid ${C.cyan}`, display: "grid", placeItems: "center", position: "relative", scale: pulse, boxShadow: active ? "0 0 86px rgba(117,201,195,.22)" : "none"}}>
      {[1.28,1.54].map((scale, i) => <div key={scale} style={{position: "absolute", inset: 0, borderRadius: "50%", border: `1px solid ${i ? C.gold : C.cyan}`, opacity: .24 + Math.sin((frame+i*10)/15)*.08, scale}}/>)}
      <Microphone size={82} weight="duotone" color={active ? C.gold : C.cyan}/>
    </div>
    <div style={{height: 72, display: "flex", alignItems: "center", gap: 7}}>{bars.map((height, index) => <span key={index} style={{width: 6, height, borderRadius: 5, background: index % 4 === 0 ? C.gold : C.cyan, opacity: active ? 1 : .48}}/>)}</div>
  </div>;
}

function CaptionRail({locale}: {locale: Locale}) {
  const frame = useCurrentFrame();
  const {width, height, fps} = useVideoConfig();
  const ms = frame / fps * 1000;
  const portrait = height > width;
  const active = campaign.locales[locale].lines.filter((line) => ms >= line.startMs && ms < line.endMs).slice(-2);
  if (!active.length) return null;
  return <div style={{position: "absolute", zIndex: 50, left: portrait ? 62 : 78, right: portrait ? 62 : 78, bottom: portrait ? 102 : 42, display: "grid", gap: 10, justifyItems: "center"}}>
    {active.map((line) => <div key={line.id} style={{maxWidth: portrait ? 920 : 1100, borderLeft: `6px solid ${line.speaker === "resident" ? C.clay : C.cyan}`, background: "rgba(3,15,12,.94)", color: C.paper, padding: portrait ? "18px 24px" : "10px 18px", font: `700 ${portrait ? 31 : 24}px/1.34 ${sans}`, boxShadow: "0 8px 32px rgba(0,0,0,.24)"}}><span style={{color: line.speaker === "resident" ? "#f29a82" : C.cyan, marginRight: 10}}>{line.speaker === "resident" ? labels[locale].resident : labels[locale].product}</span>{line.text}</div>)}
  </div>;
}

function Conversation({locale, mode}: {locale: Locale; mode: "opening" | "correction"}) {
  const frame = useCurrentFrame();
  const {width, height, fps} = useVideoConfig();
  const portrait = height > width;
  const ms = frame / fps * 1000;
  const lines = campaign.locales[locale].lines;
  const active = [...lines].reverse().find((line: DialogueLine) => ms >= line.startMs) ?? lines[0];
  const guideActive = active.speaker !== "resident";
  const displayLines = lines.filter((line) => line.startMs <= ms && line.endMs >= (mode === "opening" ? 0 : 10000)).slice(-4);
  return <AbsoluteFill style={{padding: portrait ? "250px 72px 300px" : "126px 72px 118px", display: "grid", gridTemplateColumns: portrait ? "1fr" : "1fr .82fr", alignItems: "center", gap: portrait ? 60 : 76, color: C.paper}}>
    <div style={{display: "flex", flexDirection: "column", gap: 30}}>
      <div style={{display: "flex", alignItems: "center", gap: 20}}><UserCircle size={portrait ? 76 : 58} color={C.clay} weight="duotone"/><div><div style={{font: `800 ${portrait ? 34 : 28}px ${sans}`}}>{campaign.locales[locale].persona}</div><div style={{font: `600 ${portrait ? 23 : 18}px ${sans}`, color: C.quiet}}>{mode === "opening" ? (locale === "en" ? "Finding a place to begin" : "Buscando por dónde empezar") : (locale === "en" ? "Correcting the request in real time" : "Corrigiendo la solicitud en tiempo real")}</div></div></div>
      <div style={{borderTop: `1px solid ${C.line}`, display: "grid"}}>{displayLines.map((line) => <div key={line.id} style={{padding: portrait ? "24px 0" : "16px 0", borderBottom: `1px solid ${C.line}`, opacity: line.id === active.id ? 1 : .48, font: `${line.id === active.id ? 750 : 500} ${portrait ? 30 : 23}px/1.4 ${sans}`, color: line.speaker === "resident" ? C.paper : C.cyan}}>{line.speaker === "resident" ? labels[locale].resident : labels[locale].product} · {line.text}</div>)}</div>
    </div>
    <div style={{display: "grid", placeItems: "center", alignSelf: "center"}}><VoiceCore active={guideActive}/><div style={{marginTop: 26, color: guideActive ? C.cyan : C.moss, font: `800 ${portrait ? 25 : 20}px ${sans}`, letterSpacing: 2.5, textTransform: "uppercase"}}>{guideActive ? labels[locale].speaking : labels[locale].listening}</div></div>
  </AbsoluteFill>;
}

function Permission({locale}: {locale: Locale}) {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const portrait = height > width;
  const reveal = eased(frame, [840, 1040], [0, 1]);
  return <AbsoluteFill style={{padding: portrait ? "260px 72px 310px" : "130px 82px 120px", color: C.paper, display: "flex", flexDirection: "column", justifyContent: "center"}}>
    <div style={{font: `800 ${portrait ? 25 : 19}px ${sans}`, color: C.moss, textTransform: "uppercase", letterSpacing: 3}}>{labels[locale].permission}</div>
    <h1 style={{font: `400 ${portrait ? 86 : 74}px/.98 ${serif}`, maxWidth: 990, margin: "25px 0 50px"}}>{labels[locale].use}?</h1>
    <div style={{display: "grid", gridTemplateColumns: portrait ? "1fr" : "1fr 1fr", gap: 22, maxWidth: 980}}>
      {[{Icon: MapPin, text: labels[locale].county}, {Icon: GlobeHemisphereWest, text: labels[locale].language}].map(({Icon, text}, index) => <div key={String(text)} style={{display: "flex", alignItems: "center", gap: 24, padding: "28px 30px", borderTop: `2px solid ${index ? C.cyan : C.gold}`, background: "rgba(255,255,255,.045)", opacity: reveal, translate: `0 ${(1-reveal)*30}px`}}><span style={{color: index ? C.cyan : C.gold}}><Icon size={52}/></span><strong style={{font: `700 ${portrait ? 32 : 27}px ${sans}`}}>{text}</strong><CheckCircle size={36} color={C.moss} weight="fill" style={{marginLeft: "auto"}}/></div>)}
    </div>
    <div style={{marginTop: 40, display: "flex", gap: 14, alignItems: "center", color: C.quiet, font: `600 ${portrait ? 25 : 20}px ${sans}`}}><ShieldCheck size={32} color={C.moss}/>{locale === "en" ? "Nothing moves forward without a clear yes." : "Nada avanza sin un sí claro."}</div>
  </AbsoluteFill>;
}

function Options({locale}: {locale: Locale}) {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const portrait = height > width;
  const interrupt = frame >= Math.round(46.7 * 30);
  const rows = [{icon: <CheckCircle size={43}/>, title: labels[locale].request, note: labels[locale].details}, {icon: <ShieldCheck size={43}/>, title: labels[locale].readiness, note: labels[locale].pending}];
  return <AbsoluteFill style={{padding: portrait ? "250px 72px 330px" : "125px 74px 125px", color: C.paper, display: "grid", gridTemplateColumns: portrait ? "1fr" : ".9fr 1.1fr", gap: portrait ? 40 : 60, alignItems: "center"}}>
    <div><div style={{font: `800 ${portrait ? 25 : 19}px ${sans}`, color: C.moss, textTransform: "uppercase", letterSpacing: 3}}>{labels[locale].choices}</div><h1 style={{font: `400 ${portrait ? 80 : 67}px/1 ${serif}`, margin: "25px 0"}}>{labels[locale].result}</h1><p style={{font: `500 ${portrait ? 29 : 23}px/1.45 ${sans}`, color: C.quiet}}>{locale === "en" ? "Voice shows the information only. Nothing is submitted and no provider match is claimed." : "La voz solo muestra la información. No se envía nada ni se afirma una asignación de proveedor."}</p></div>
    <div style={{display: "grid", gap: 20}}>{rows.map((row, index) => <div key={row.title} style={{display: "grid", gridTemplateColumns: "64px 1fr", gap: 20, padding: portrait ? "30px" : "24px", background: "rgba(251,248,239,.06)", borderLeft: `5px solid ${index ? C.cyan : C.gold}`}}><span style={{color: index ? C.cyan : C.gold}}>{row.icon}</span><div><strong style={{font: `750 ${portrait ? 30 : 25}px ${sans}`}}>{row.title}</strong><div style={{marginTop: 8, color: C.quiet, font: `600 ${portrait ? 23 : 19}px ${sans}`}}>{row.note}</div></div></div>)}
      {interrupt && <div style={{padding: "22px 26px", border: `2px solid ${C.clay}`, background: "rgba(215,107,82,.12)", color: C.paper, font: `750 ${portrait ? 29 : 23}px/1.35 ${sans}`}}>{locale === "en" ? "Renata interrupts: “Wait—does that mean you found a provider?”" : "Renata interrumpe: «Espera, ¿eso significa que encontraste un proveedor?»"}</div>}
    </div>
  </AbsoluteFill>;
}

function Boundary({locale}: {locale: Locale}) {
  const {width, height} = useVideoConfig();
  const portrait = height > width;
  const blocks = [{icon: <HouseLine size={62}/>, title: labels[locale].notClinical, lead: labels[locale].prepare, points: locale === "en" ? ["Review request details", "Prepare for a future visit", "Choose whether to submit"] : ["Revisar los datos de la solicitud", "Prepararse para una futura visita", "Elegir si se envía"]}, {icon: <ShieldCheck size={62}/>, title: labels[locale].provider, lead: labels[locale].care, points: locale === "en" ? ["Diagnosis", "Treatment", "Prescribing"] : ["Diagnóstico", "Tratamiento", "Recetas"]}];
  return <AbsoluteFill style={{padding: portrait ? "250px 72px 320px" : "130px 76px 130px", color: C.paper, display: "grid", gridTemplateColumns: portrait ? "1fr" : "1fr 1fr", gap: portrait ? 28 : 40, alignItems: "center"}}>{blocks.map((block, index) => <div key={block.title} style={{minHeight: portrait ? 430 : 390, padding: portrait ? "42px" : "34px", background: index ? C.paper : "rgba(255,255,255,.05)", color: index ? C.ink : C.paper, borderTop: `7px solid ${index ? C.cyan : C.gold}`, display: "flex", flexDirection: "column"}}><span style={{color: index ? C.ink2 : C.gold}}>{block.icon}</span><div style={{marginTop: 20, color: index ? C.ink2 : C.moss, font: `800 ${portrait ? 22 : 18}px ${sans}`, textTransform: "uppercase", letterSpacing: 2.5}}>{block.lead}</div><h2 style={{font: `400 ${portrait ? 54 : 43}px/1 ${serif}`, margin: "14px 0 26px"}}>{block.title}</h2>{block.points.map((point) => <div key={point} style={{padding: "11px 0", borderTop: `1px solid ${index ? "rgba(8,29,25,.18)" : C.line}`, font: `650 ${portrait ? 25 : 20}px ${sans}`}}>{point}</div>)}</div>)}</AbsoluteFill>;
}

function Handoff({locale}: {locale: Locale}) {
  const {width, height} = useVideoConfig();
  const portrait = height > width;
  return <AbsoluteFill style={{padding: portrait ? "260px 72px 330px" : "130px 80px", color: C.paper, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center"}}>
    <div style={{width: portrait ? 170 : 130, height: portrait ? 170 : 130, borderRadius: "50%", display: "grid", placeItems: "center", background: C.gold, color: C.ink}}><CheckCircle size={portrait ? 88 : 66} weight="duotone"/></div>
    <div style={{font: `800 ${portrait ? 24 : 19}px ${sans}`, color: C.moss, textTransform: "uppercase", letterSpacing: 3, marginTop: 32}}>{labels[locale].open}</div>
    <h1 style={{font: `400 ${portrait ? 82 : 68}px/.99 ${serif}`, maxWidth: 1050, margin: "24px 0 42px"}}>{locale === "en" ? "The details are visible. The resident chooses whether to submit." : "Los datos están visibles. La persona elige si quiere enviar."}</h1>
    <div style={{display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 16}}>{[labels[locale].bring, labels[locale].visit, labels[locale].followup].map((item) => <span key={item} style={{padding: "17px 22px", border: `1px solid ${C.line}`, font: `700 ${portrait ? 24 : 20}px ${sans}`, color: C.quiet}}>{item}</span>)}</div>
  </AbsoluteFill>;
}

function Closing({locale}: {locale: Locale}) {
  const {width, height} = useVideoConfig();
  const portrait = height > width;
  return <AbsoluteFill style={{padding: portrait ? "240px 72px 290px" : "120px 76px", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", color: C.paper}}><div><Wordmark width={portrait ? 350 : 280}/><h1 style={{font: `400 ${portrait ? 100 : 88}px/.95 ${serif}`, maxWidth: 1080, margin: "48px auto 30px"}}>{labels[locale].close}<br/><span style={{color: C.gold}}>{labels[locale].closer}</span></h1><p style={{font: `650 ${portrait ? 29 : 23}px/1.45 ${sans}`, color: C.quiet, maxWidth: 880, margin: "0 auto"}}>{campaign.locales[locale].closing}</p><div style={{marginTop: 44, font: `800 ${portrait ? 26 : 21}px ${sans}`, color: C.moss}}>health.sozorockfoundation.org</div></div></AbsoluteFill>;
}

function AudioTracks({locale, voiceReady}: {locale: Locale; voiceReady: boolean}) {
  const {fps} = useVideoConfig();
  const interruption = campaign.production.interruption;
  return <>{voiceReady && campaign.locales[locale].lines.map((line) => {
    const from = Math.round(line.startMs / 1000 * fps);
    const approvedEndMs = line.id === interruption.interruptedLineId ? interruption.yieldAtMs : line.endMs;
    const durationInFrames = Math.max(1, Math.round((approvedEndMs - line.startMs) / 1000 * fps));
    const fadeFrames = Math.max(2, Math.min(Math.round(interruption.fadeMs / 1000 * fps), Math.floor(durationInFrames / 4)));
    const fadeOutEnd = Math.max(1, durationInFrames - 1);
    const fadeOutStart = Math.max(fadeFrames, fadeOutEnd - fadeFrames);
    const baseVolume = line.speaker === "resident" ? .94 : 1;
    return <Sequence key={line.id} from={from} durationInFrames={durationInFrames} layout="none"><Audio src={staticFile(`gpt-live-campaign/${locale}-${line.id}-${line.speaker}.mp3`)} trimAfter={durationInFrames} volume={(audioFrame) => Math.min(interpolate(audioFrame, [0, fadeFrames], [0, baseVolume], {extrapolateLeft: "clamp", extrapolateRight: "clamp"}), interpolate(audioFrame, [fadeOutStart, fadeOutEnd], [baseVolume, 0], {extrapolateLeft: "clamp", extrapolateRight: "clamp"}))}/></Sequence>;
  })}<Audio src={staticFile("gpt-live-campaign/ambient-bed.wav")} volume={(audioFrame) => interpolate(audioFrame, [0, 60, 2280, 2399], [0, .42, .42, 0], {extrapolateLeft: "clamp", extrapolateRight: "clamp"})}/></>;
}

export function LiveCampaign({format, locale, voiceReady = false}: Props) {
  const frame = useCurrentFrame();
  const phase = frame < 321 ? <Conversation locale={locale} mode="opening"/> : frame < 858 ? <Conversation locale={locale} mode="correction"/> : frame < 1179 ? <Permission locale={locale}/> : frame < 1539 ? <Options locale={locale}/> : frame < 1953 ? <Boundary locale={locale}/> : frame < 2145 ? <Handoff locale={locale}/> : <Closing locale={locale}/>;
  return <AbsoluteFill style={{overflow: "hidden", background: C.ink}}><SystemBackground/><Header locale={locale}/>{phase}<AudioTracks locale={locale} voiceReady={voiceReady}/><CaptionRail locale={locale}/>{!voiceReady && <PreviewBadge locale={locale}/>}<div style={{position: "absolute", zIndex: 40, left: "4.5%", bottom: "3.2%", color: C.moss, font: `800 15px ${sans}`, letterSpacing: 2.4, textTransform: "uppercase"}}>{format} · {campaign.locales[locale].language}</div><div style={{position: "absolute", zIndex: 40, right: "4.5%", bottom: "3.2%", color: C.quiet, font: `700 15px ${sans}`}}>{labels[locale].private}</div></AbsoluteFill>;
}

export function LiveCampaignPoster({locale, voiceReady = false}: Props) {
  return <AbsoluteFill style={{background: C.ink, overflow: "hidden"}}><SystemBackground/><Header locale={locale}/>{!voiceReady && <PreviewBadge locale={locale}/>}<AbsoluteFill style={{display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", color: C.paper, padding: "11%"}}><div><VoiceCore active/><div style={{marginTop: 58, color: C.moss, font: `800 24px ${sans}`, textTransform: "uppercase", letterSpacing: 3}}>{labels[locale].product}</div><h1 style={{font: `400 94px/.98 ${serif}`, maxWidth: 1000, margin: "28px auto"}}>{locale === "en" ? "A conversation that makes the next step visible." : "Una conversación que hace visible el próximo paso."}</h1></div></AbsoluteFill></AbsoluteFill>;
}
