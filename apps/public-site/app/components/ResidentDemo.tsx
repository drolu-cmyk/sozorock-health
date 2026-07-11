"use client";

import { useRef, useState } from "react";
import { HouseLine, MagnifyingGlass, Microphone, Translate, UsersThree } from "@phosphor-icons/react";

const choices = {
  English: [
    { title: "Find care", copy: "Start a pathway to a licensed provider.", icon: MagnifyingGlass },
    { title: "Check in at a hub", copy: "Library, Community, or Home support.", icon: UsersThree },
    { title: "Get language support", copy: "Choose the language that works for you.", icon: Translate },
  ],
  Español: [
    { title: "Encontrar atención", copy: "Inicie una ruta hacia un proveedor autorizado.", icon: MagnifyingGlass },
    { title: "Registrarse en un centro", copy: "Apoyo en biblioteca, comunidad o hogar.", icon: UsersThree },
    { title: "Apoyo de idioma", copy: "Elija el idioma que le resulte más cómodo.", icon: Translate },
  ],
};

export function ResidentDemo() {
  const [language, setLanguage] = useState<keyof typeof choices>("English");
  const [active, setActive] = useState<string | null>(null);
  const [voicePreview, setVoicePreview] = useState(false);
  const [voiceMessage, setVoiceMessage] = useState("");
  const recognitionRef = useRef<{start:()=>void;stop:()=>void}|null>(null);
  const isEnglish = language === "English";

  const toggleVoice = () => {
    if (voicePreview) {
      recognitionRef.current?.stop();
      setVoicePreview(false);
      return;
    }
    const voiceWindow = window as typeof window & {SpeechRecognition?:new()=>any;webkitSpeechRecognition?:new()=>any};
    const Recognition = voiceWindow.SpeechRecognition ?? voiceWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setVoiceMessage(isEnglish ? "Voice input is not available in this browser. You can continue by tapping a choice." : "La entrada de voz no está disponible en este navegador. Puede continuar tocando una opción.");
      return;
    }
    const recognition = new Recognition();
    recognition.lang = isEnglish ? "en-US" : "es-US";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onstart = () => { setVoicePreview(true); setVoiceMessage(isEnglish ? "Listening… Describe the kind of access support you need." : "Escuchando… Describa el tipo de apoyo de acceso que necesita."); };
    recognition.onresult = (event:any) => {
      const transcript = String(event.results?.[0]?.[0]?.transcript ?? "").trim();
      setVoiceMessage(transcript ? (isEnglish ? `We heard: “${transcript}” Choose a pathway below to continue.` : `Escuchamos: “${transcript}” Elija una ruta a continuación para continuar.`) : (isEnglish ? "We did not hear a response. You can try again or tap a choice." : "No escuchamos una respuesta. Puede intentarlo de nuevo o tocar una opción."));
    };
    recognition.onerror = () => setVoiceMessage(isEnglish ? "Voice input could not start. Check microphone permission or continue by tapping a choice." : "No se pudo iniciar la entrada de voz. Revise el permiso del micrófono o continúe tocando una opción.");
    recognition.onend = () => setVoicePreview(false);
    recognitionRef.current = recognition;
    recognition.start();
  };

  return <div className="resident-device" aria-label="Resident access preview">
    <div className="device-bar"><span>SozoRock Health</span><button type="button" onClick={() => { setLanguage(isEnglish ? "Español" : "English"); setActive(null); }}><Translate size={16} aria-hidden="true"/>{language}</button></div>
    <div className="resident-welcome"><span>{isEnglish ? "Welcome." : "Bienvenido."}</span><h3>{isEnglish ? "How can we support you today?" : "¿Cómo podemos ayudarle hoy?"}</h3><p>{isEnglish ? "Speak or tap. No account is needed to explore." : "Hable o toque. No necesita una cuenta para explorar."}</p></div>
    <button className={`voice-control ${voicePreview ? "is-ready" : ""}`} type="button" onClick={toggleVoice} aria-pressed={voicePreview}><Microphone weight="fill" size={28} aria-hidden="true"/><span>{voicePreview ? (isEnglish ? "Stop listening" : "Dejar de escuchar") : (isEnglish ? "Start voice intake" : "Iniciar entrada de voz")}</span></button>
    <p className="voice-status" role="status">{voiceMessage || (isEnglish ? "Voice input starts only after you choose the microphone. Text and tap choices remain available." : "La entrada de voz comienza solo después de elegir el micrófono. Las opciones de texto y toque siguen disponibles.")}</p>
    <div className="resident-choices">{choices[language].map(({title,copy,icon:Icon}) => <button type="button" key={title} className={active === title ? "is-active" : ""} onClick={() => setActive(title)}><Icon size={32} aria-hidden="true"/><strong>{title}</strong><span>{copy}</span></button>)}</div>
    {active && <div className="device-result" role="status"><HouseLine size={20} aria-hidden="true"/><span><strong>{active}</strong> {isEnglish ? "selected. The next step confirms your state and shows an eligible pathway." : "seleccionado. El siguiente paso confirma su estado y muestra una ruta disponible."}</span></div>}
    <footer>{isEnglish ? "Private by design · Non-clinical · Emergency help: call 911" : "Privado por diseño · No clínico · En caso de emergencia, llame al 911"}</footer>
  </div>;
}
