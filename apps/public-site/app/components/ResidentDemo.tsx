"use client";

import { useState } from "react";
import { HouseLine, MagnifyingGlass, Microphone, Translate, UsersThree } from "@phosphor-icons/react";

const choices = [
  { title: "Find care", copy: "Start a pathway to a licensed provider.", icon: MagnifyingGlass },
  { title: "Check in at a hub", copy: "Library, Community, or Home support.", icon: UsersThree },
  { title: "Get language support", copy: "English and Spanish at launch.", icon: Translate },
];

export function ResidentDemo() {
  const [language, setLanguage] = useState<"English"|"Español">("English");
  const [active, setActive] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  return <div className="resident-device" aria-label="Resident access preview">
    <div className="device-bar"><span>SozoRock Health</span><button onClick={() => setLanguage(language === "English" ? "Español" : "English")}><Translate size={16} aria-hidden="true" />{language}</button></div>
    <div className="resident-welcome"><span>Welcome.</span><h3>{language === "English" ? "How can we support you today?" : "¿Cómo podemos ayudarle hoy?"}</h3><p>{language === "English" ? "Speak or tap. No account is needed to explore." : "Hable o toque. No necesita una cuenta para explorar."}</p></div>
    <button className={`voice-control ${listening ? "is-listening" : ""}`} onClick={() => setListening(!listening)} aria-pressed={listening}><Microphone weight="fill" size={28} aria-hidden="true" /><span>{listening ? "Listening — tap to stop" : "Use your voice"}</span></button>
    <div className="resident-choices">{choices.map(({title,copy,icon:Icon}) => <button key={title} className={active === title ? "is-active" : ""} onClick={() => setActive(title)}><Icon size={32} aria-hidden="true" /><strong>{title}</strong><span>{copy}</span></button>)}</div>
    {active && <div className="device-result" role="status"><HouseLine size={20} aria-hidden="true" /><span><strong>{active}</strong> selected. The next step will confirm your state and show an eligible pathway.</span></div>}
    <footer>Private by design · Non-clinical · Emergency help: call 911</footer>
  </div>;
}
