"use client";

import { useEffect, useRef, useState } from "react";
import { HouseLine, MagnifyingGlass, Microphone, Translate, UsersThree } from "@phosphor-icons/react";

const choices = {
  English: [
    { title: "Prepare for a visit", copy: "Get digitally ready for a provider-led service.", icon: MagnifyingGlass },
    { title: "Find a Health Equity Hub", copy: "Explore Library, Community-Based, or Home support.", icon: UsersThree },
    { title: "Understand local support", copy: "Find non-clinical education and readiness options.", icon: Translate },
  ],
  Español: [
    { title: "Prepararse para una visita", copy: "Prepárese digitalmente para un servicio dirigido por un proveedor.", icon: MagnifyingGlass },
    { title: "Encontrar un centro de equidad", copy: "Explore apoyo en biblioteca, comunidad u hogar.", icon: UsersThree },
    { title: "Entender el apoyo local", copy: "Encuentre educación y preparación no clínicas.", icon: Translate },
  ],
};

export function ResidentDemo() {
  const [language, setLanguage] = useState<keyof typeof choices>("English");
  const [active, setActive] = useState<string | null>(null);
  const [voicePreview, setVoicePreview] = useState(false);
  const [voiceMessage, setVoiceMessage] = useState("");
  const [voiceConsent, setVoiceConsent] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const recognitionRef = useRef<{start:()=>void;stop:()=>void}|null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const mediaRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isEnglish = language === "English";

  const stopVoice = () => {
    recognitionRef.current?.stop();
    mediaRef.current?.getTracks().forEach((track) => track.stop());
    peerRef.current?.close();
    recognitionRef.current = null;
    mediaRef.current = null;
    peerRef.current = null;
    if (audioRef.current) audioRef.current.srcObject = null;
    setVoicePreview(false);
  };

  const startBrowserFallback = () => {
    const voiceWindow = window as typeof window & {SpeechRecognition?:new()=>any;webkitSpeechRecognition?:new()=>any};
    const Recognition = voiceWindow.SpeechRecognition ?? voiceWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setVoiceMessage(isEnglish ? "Voice is not available in this browser. You can continue by tapping a choice." : "La voz no está disponible en este navegador. Puede continuar tocando una opción.");
      return;
    }
    const recognition = new Recognition();
    recognition.lang = isEnglish ? "en-US" : "es-US";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onstart = () => { setVoicePreview(true); setVoiceMessage(isEnglish ? "Listening… Tell us what you are trying to prepare for." : "Escuchando… Díganos para qué está tratando de prepararse."); };
    recognition.onresult = (event:any) => {
      const transcript = String(event.results?.[0]?.[0]?.transcript ?? "").trim();
      setVoiceMessage(transcript ? (isEnglish ? `We heard: “${transcript}” Choose a readiness pathway below to continue.` : `Escuchamos: “${transcript}” Elija una ruta de preparación para continuar.`) : (isEnglish ? "We did not hear a response. Try again or tap a choice." : "No escuchamos una respuesta. Inténtelo de nuevo o toque una opción."));
    };
    recognition.onerror = () => setVoiceMessage(isEnglish ? "Voice could not start. Check microphone permission or continue by tapping." : "No se pudo iniciar la voz. Revise el permiso del micrófono o continúe tocando.");
    recognition.onend = () => setVoicePreview(false);
    recognitionRef.current = recognition;
    recognition.start();
  };

  const toggleVoice = async () => {
    if (voicePreview) {
      stopVoice();
      return;
    }
    if (!voiceConsent) {
      setConsentOpen(true);
      setVoiceMessage(isEnglish ? "Review the voice privacy note before connecting." : "Revise la nota de privacidad de voz antes de conectarse.");
      return;
    }
    setVoiceMessage(isEnglish ? "Connecting live Voice Access…" : "Conectando Voice Access en vivo…");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      const peer = new RTCPeerConnection();
      mediaRef.current = stream;
      peerRef.current = peer;
      const audio = audioRef.current ?? new Audio();
      audio.autoplay = true;
      audioRef.current = audio;
      peer.ontrack = (event) => { audio.srcObject = event.streams[0]; };
      stream.getTracks().forEach((track) => peer.addTrack(track, stream));
      const channel = peer.createDataChannel("sozorock-voice");
      channel.onopen = () => {
        setVoicePreview(true);
        setVoiceMessage(isEnglish ? "Voice Access is ready. Speak naturally; you can interrupt at any time." : "Voice Access está listo. Hable con naturalidad; puede interrumpir en cualquier momento.");
        channel.send(JSON.stringify({ type: "response.create", response: { instructions: isEnglish ? "Greet the resident briefly and ask what they are trying to get ready for." : "Salude brevemente en español y pregunte para qué está tratando de prepararse." } }));
      };
      channel.onerror = () => stopVoice();
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      const response = await fetch("/api/voice/call", { method: "POST", headers: { "Content-Type": "application/sdp" }, body: offer.sdp });
      if (!response.ok) throw new Error("Realtime unavailable");
      await peer.setRemoteDescription({ type: "answer", sdp: await response.text() });
      window.setTimeout(() => { if (peerRef.current === peer) { stopVoice(); setVoiceMessage(isEnglish ? "The five-minute voice session ended. Start a new session whenever you are ready." : "La sesión de voz de cinco minutos terminó. Inicie una nueva sesión cuando esté listo."); } }, 300_000);
    } catch {
      stopVoice();
      setVoiceMessage(isEnglish ? "Using the device voice option." : "Usando la opción de voz del dispositivo.");
      startBrowserFallback();
    }
  };

  useEffect(() => () => stopVoice(), []);

  return <div className="resident-device" aria-label="Resident access preview">
    <div className="device-bar"><span>SozoRock Health</span><button type="button" onClick={() => { setLanguage(isEnglish ? "Español" : "English"); setActive(null); }}><Translate size={16} aria-hidden="true"/>{language}</button></div>
    <div className="resident-welcome"><span>{isEnglish ? "Voice Access" : "Acceso por voz"}</span><h3>{isEnglish ? "What are you trying to get ready for?" : "¿Para qué está tratando de prepararse?"}</h3><p>{isEnglish ? "Speak or tap. No account is needed to explore." : "Hable o toque. No necesita una cuenta para explorar."}</p></div>
    <button className={`voice-control ${voicePreview ? "is-ready" : ""}`} type="button" onClick={toggleVoice} aria-pressed={voicePreview}><Microphone weight="fill" size={28} aria-hidden="true"/><span>{voicePreview ? (isEnglish ? "Stop listening" : "Dejar de escuchar") : (isEnglish ? "Start voice intake" : "Iniciar entrada de voz")}</span></button>
    {consentOpen && <div className="voice-consent" role="group" aria-labelledby="voice-consent-heading"><strong id="voice-consent-heading">{isEnglish ? "Before Voice Access begins" : "Antes de comenzar Voice Access"}</strong><p>{isEnglish ? "Your microphone audio is processed by OpenAI for this live, non-clinical conversation. Do not share medical records or protected health information. Stop at any time; this screen does not retain raw audio." : "OpenAI procesa el audio de su micrófono para esta conversación no clínica en vivo. No comparta expedientes médicos ni información de salud protegida. Puede detenerse en cualquier momento; esta pantalla no conserva audio sin procesar."}</p><a href="/privacy">{isEnglish ? "Read the privacy notice" : "Lea el aviso de privacidad"}</a><div><button type="button" onClick={()=>setConsentOpen(false)}>{isEnglish ? "Not now" : "Ahora no"}</button><button type="button" onClick={()=>{setVoiceConsent(true);setConsentOpen(false);setVoiceMessage(isEnglish ? "Voice permission confirmed. Choose the microphone again to connect." : "Permiso de voz confirmado. Elija el micrófono nuevamente para conectarse.")}}>{isEnglish ? "I agree" : "Acepto"}</button></div></div>}
    <p className="voice-status" role="status">{voiceMessage || (isEnglish ? "Voice starts only after you choose the microphone. Tap choices remain available at every step." : "La voz comienza solo después de elegir el micrófono. Las opciones táctiles siguen disponibles en cada paso.")}</p>
    <div className="resident-choices">{choices[language].map(({title,copy,icon:Icon}) => <button type="button" key={title} className={active === title ? "is-active" : ""} onClick={() => setActive(title)}><Icon size={32} aria-hidden="true"/><strong>{title}</strong><span>{copy}</span></button>)}</div>
    {active && <div className="device-result" role="status"><HouseLine size={20} aria-hidden="true"/><span><strong>{active}</strong> {isEnglish ? "selected. The next step confirms your state and shows an eligible pathway." : "seleccionado. El siguiente paso confirma su estado y muestra una ruta disponible."}</span></div>}
    <footer>{isEnglish ? "Private by design · Non-clinical · Emergency help: call 911" : "Privado por diseño · No clínico · En caso de emergencia, llame al 911"}</footer>
  </div>;
}
