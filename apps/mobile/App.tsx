import * as Speech from "expo-speech";
import {useEffect, useMemo, useState} from "react";
import {ExpoSpeechRecognitionModule, useSpeechRecognitionEvent} from "expo-speech-recognition";
import {
  AccessibilityInfo,
  ActivityIndicator,
  AppState,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import {accessApiUrl, mobileFeatures, privacyUrl} from "./src/config";

type Language = "en" | "es";
type Journey = "care" | "hub" | "language";
type Screen = "welcome" | "details" | "complete";
type RequestOutcome = "success" | "queued" | "empty" | "error";
type VoiceStatus = "loading" | "ready" | "unavailable" | "error";

const copy = {
  en: {
    language: "Español",
    eyebrow: "RESIDENT ACCESS LAYER",
    title: "What are you trying to get ready for?",
    subtitle: "Choose an option below. You can listen to this screen at any time.",
    hear: "Hear this screen",
    stop: "Stop listening",
    voiceLoading: "Checking device speech",
    voiceReady: "Device speech ready",
    voiceUnavailable: "Device speech unavailable — use the on-screen controls",
    speechError: "Speech playback could not start. You can continue using the screen.",
    startVoice: "Speak your request",
    stopVoice: "Stop voice input",
    voicePrompt: "Tap to describe what you are trying to prepare for.",
    voicePermissionError: "Voice input needs microphone and speech recognition permission. You can continue by tapping an option.",
    careTitle: "Prepare for a provider-led service",
    careBody: "Build the digital readiness needed to use an available service.",
    hubTitle: "Find a Health Equity Hub",
    hubBody: "Explore Library, Community-Based, or Home-Based support.",
    languageTitle: "Understand local support",
    languageBody: "Explore non-clinical education, readiness, and language options.",
    lowData: "Designed for shared tablets and low-data connections",
    privacy: "Non-clinical readiness support",
    privacyLink: "Privacy and data use",
    emergency: "If this is an emergency, call 911.",
    back: "Back",
    restart: "Start over",
    zip: "ZIP code",
    zipHint: "Enter your 5-digit ZIP code",
    hubCode: "Hub name or code",
    hubHint: "Enter the hub name or code shown at this location",
    support: "What kind of support are you looking for?",
    supportOptions: ["Virtual visit readiness", "Digital access support", "Community resources", "I’m not sure where to start"],
    continue: "Continue",
    required: "Enter the requested information to continue.",
    consentRequired: "Confirm consent before continuing.",
    consent: "I agree that SozoRock Health may use these selections to identify non-clinical readiness and support pathways.",
    languagePrompt: "Choose your preferred language",
    languages: ["English", "Español", "American Sign Language", "Another language"],
    completeTitle: "Your request is ready.",
    completeBody:
      "SozoRock Health will use your location and selection to show available non-clinical readiness and provider-led pathways. Provider availability depends on state licensure and participation.",
    reference: "ACCESS REQUEST",
    finish: "Return to welcome",
    loading: "Checking available pathways…",
    queuedTitle: "Your selections are ready.",
    queuedBody: "This device is not connected to the access service. Your selections remain on this screen. Reconnect or ask hub staff to continue.",
    emptyTitle: "No participating pathway is listed yet.",
    emptyBody: "Availability changes as licensed providers and community partners join in your state. You may return later or ask Health Equity Hub staff for help.",
    errorTitle: "We couldn’t check available pathways.",
    errorBody: "Your selections are still on this screen. Check the connection and try again.",
    retry: "Try again",
    lowDataMode: "Low-data core ready",
  },
  es: {
    language: "English",
    eyebrow: "ACCESO PARA RESIDENTES",
    title: "¿Para qué desea prepararse?",
    subtitle: "Elija una opción. Puede escuchar esta pantalla en cualquier momento.",
    hear: "Escuchar esta pantalla",
    stop: "Dejar de escuchar",
    voiceLoading: "Comprobando la voz del dispositivo",
    voiceReady: "Voz del dispositivo lista",
    voiceUnavailable: "La voz no está disponible — use los controles en pantalla",
    speechError: "No se pudo iniciar la reproducción. Puede continuar usando la pantalla.",
    startVoice: "Diga su solicitud",
    stopVoice: "Detener entrada de voz",
    voicePrompt: "Toque para describir para qué desea prepararse.",
    voicePermissionError: "La entrada de voz necesita permiso para el micrófono y el reconocimiento de voz. Puede continuar tocando una opción.",
    careTitle: "Prepararse para un servicio dirigido por un profesional",
    careBody: "Desarrolle la preparación digital necesaria para usar un servicio disponible.",
    hubTitle: "Encontrar un Centro de Equidad en Salud",
    hubBody: "Explore apoyo en bibliotecas, espacios comunitarios o en el hogar.",
    languageTitle: "Entender el apoyo local",
    languageBody: "Explore educación no clínica, preparación y opciones de idioma.",
    lowData: "Diseñado para tabletas compartidas y conexiones de pocos datos",
    privacy: "Apoyo de preparación no clínica",
    privacyLink: "Privacidad y uso de datos",
    emergency: "Si tiene una emergencia, llame al 911.",
    back: "Atrás",
    restart: "Empezar de nuevo",
    zip: "Código postal",
    zipHint: "Ingrese su código postal de 5 dígitos",
    hubCode: "Nombre o código del centro",
    hubHint: "Ingrese el nombre o código que aparece en este lugar",
    support: "¿Qué tipo de preparación busca?",
    supportOptions: ["Preparación para visita virtual", "Apoyo de acceso digital", "Recursos comunitarios", "No sé por dónde empezar"],
    continue: "Continuar",
    required: "Ingrese la información solicitada para continuar.",
    consentRequired: "Confirme su consentimiento antes de continuar.",
    consent: "Acepto que SozoRock Health use estas selecciones para identificar vías de preparación y apoyo no clínico.",
    languagePrompt: "Elija su idioma preferido",
    languages: ["English", "Español", "Lengua de señas americana", "Otro idioma"],
    completeTitle: "Su solicitud está lista.",
    completeBody:
      "SozoRock Health usará su ubicación y selección para mostrar vías de preparación no clínica y servicios dirigidos por profesionales. La disponibilidad depende de la licencia estatal y la participación.",
    reference: "SOLICITUD DE ACCESO",
    finish: "Volver al inicio",
    loading: "Buscando vías de acceso disponibles…",
    queuedTitle: "Sus selecciones están listas.",
    queuedBody: "Este dispositivo no está conectado al servicio. Sus selecciones permanecen en esta pantalla. Reconéctese o pida ayuda al personal del centro.",
    emptyTitle: "Aún no hay una vía participante disponible.",
    emptyBody: "La disponibilidad cambia cuando profesionales autorizados y socios comunitarios se unen en su estado. Puede volver más tarde o pedir apoyo al personal del Centro de Equidad en Salud.",
    errorTitle: "No pudimos consultar las opciones de acceso.",
    errorBody: "Sus selecciones siguen en esta pantalla. Verifique la conexión e inténtelo de nuevo.",
    retry: "Intentar de nuevo",
    lowDataMode: "Funciones básicas de pocos datos listas",
  },
} as const;

const journeyMeta = {
  care: {label: "PROVIDER READINESS", tone: "gold"},
  hub: {label: "HEALTH EQUITY HUB", tone: "clay"},
  language: {label: "LOCAL SUPPORT", tone: "blue"},
} as const;

const careSelectionCodes = [
  "virtual-visit-readiness",
  "digital-access-support",
  "community-resources",
  "not-sure",
] as const;
const languageSelectionCodes = ["en", "es", "asl", "other"] as const;

function selectionCode(
  journey: Journey,
  selectedOption: string,
  localizedCopy: (typeof copy)[Language],
) {
  const labels: readonly string[] =
    journey === "care"
      ? localizedCopy.supportOptions
      : journey === "language"
        ? localizedCopy.languages
        : [];
  const index = labels.indexOf(selectedOption);
  if (index < 0) return undefined;
  return journey === "care" ? careSelectionCodes[index] : languageSelectionCodes[index];
}

export default function App() {
  const {width} = useWindowDimensions();
  const isTablet = width >= 760;
  const [language, setLanguage] = useState<Language>("en");
  const [journey, setJourney] = useState<Journey | null>(null);
  const [screen, setScreen] = useState<Screen>("welcome");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>("loading");
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [reducedMotion, setReducedMotion] = useState(false);
  const [value, setValue] = useState("");
  const [selectedOption, setSelectedOption] = useState("");
  const [error, setError] = useState("");
  const [consented, setConsented] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [outcome, setOutcome] = useState<RequestOutcome>("success");
  const c = copy[language];

  useSpeechRecognitionEvent("start", () => setIsRecognizing(true));
  useSpeechRecognitionEvent("end", () => setIsRecognizing(false));
  useSpeechRecognitionEvent("result", event => {
    const nextTranscript = event.results[0]?.transcript?.trim() ?? "";
    setTranscript(nextTranscript);
    if (nextTranscript) AccessibilityInfo.announceForAccessibility(nextTranscript);
  });
  useSpeechRecognitionEvent("error", () => {
    setIsRecognizing(false);
    AccessibilityInfo.announceForAccessibility(c.voicePermissionError);
  });

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReducedMotion);
    const motionSubscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReducedMotion,
    );
    const appSubscription = AppState.addEventListener("change", state => {
      if (state !== "active") {
        Speech.stop();
        ExpoSpeechRecognitionModule.abort();
        setIsSpeaking(false);
        setIsRecognizing(false);
        setTranscript("");
        setJourney(null);
        setScreen("welcome");
        setValue("");
        setSelectedOption("");
        setError("");
        setConsented(false);
        setIsSubmitting(false);
      }
    });
    return () => {
      motionSubscription.remove();
      appSubscription.remove();
      Speech.stop();
      ExpoSpeechRecognitionModule.abort();
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    setVoiceStatus("loading");
    if (!mobileFeatures.deviceSpeech) {
      setVoiceStatus("unavailable");
      return () => {
        mounted = false;
      };
    }
    Speech.getAvailableVoicesAsync()
      .then(voices => {
        const localeAvailable = voices.some(voice =>
          voice.language.toLowerCase().startsWith(language),
        );
        if (mounted) setVoiceStatus(localeAvailable ? "ready" : "unavailable");
      })
      .catch(() => {
        if (mounted) setVoiceStatus("error");
      });
    return () => {
      mounted = false;
    };
  }, [language]);

  const spokenWelcome = useMemo(
    () =>
      `${c.title} ${c.subtitle} ${c.careTitle}. ${c.careBody} ${c.hubTitle}. ${c.hubBody} ${c.languageTitle}. ${c.languageBody}`,
    [c],
  );

  const reset = () => {
    Speech.stop();
    setIsSpeaking(false);
    ExpoSpeechRecognitionModule.abort();
    setIsRecognizing(false);
    setTranscript("");
    setJourney(null);
    setScreen("welcome");
    setValue("");
    setSelectedOption("");
    setError("");
    setConsented(false);
    setIsSubmitting(false);
  };

  const toggleLanguage = () => {
    Speech.stop();
    setIsSpeaking(false);
    setLanguage(current => (current === "en" ? "es" : "en"));
    setError("");
    setConsented(false);
  };

  const toggleSpeech = () => {
    if (isSpeaking) {
      Speech.stop();
      setIsSpeaking(false);
      return;
    }
    if (voiceStatus !== "ready") {
      AccessibilityInfo.announceForAccessibility(c.voiceUnavailable);
      return;
    }
    if (isRecognizing) {
      ExpoSpeechRecognitionModule.abort();
      setIsRecognizing(false);
    }
    setIsSpeaking(true);
    Speech.speak(spokenWelcome, {
      language: language === "es" ? "es-US" : "en-US",
      rate: reducedMotion ? 0.82 : 0.9,
      onDone: () => setIsSpeaking(false),
      onStopped: () => setIsSpeaking(false),
      onError: () => {
        setIsSpeaking(false);
        setVoiceStatus("error");
        AccessibilityInfo.announceForAccessibility(c.speechError);
      },
    });
  };

  const toggleVoiceInput = async () => {
    if (isRecognizing) {
      ExpoSpeechRecognitionModule.stop();
      return;
    }
    if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
      AccessibilityInfo.announceForAccessibility(c.voiceUnavailable);
      return;
    }
    if (isSpeaking) {
      Speech.stop();
      setIsSpeaking(false);
    }
    const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permission.granted) {
      AccessibilityInfo.announceForAccessibility(c.voicePermissionError);
      return;
    }
    setTranscript("");
    ExpoSpeechRecognitionModule.start({
      lang: language === "es" ? "es-US" : "en-US",
      continuous: false,
      interimResults: true,
      iosTaskHint: "search",
    });
  };

  const startJourney = (nextJourney: Journey) => {
    Speech.stop();
    setIsSpeaking(false);
    setJourney(nextJourney);
    setScreen("details");
    setValue("");
    setSelectedOption("");
    setError("");
    setConsented(false);
  };

  const submit = async () => {
    const isValid =
      journey === "language"
        ? Boolean(selectedOption)
        : journey === "care"
          ? /^\d{5}$/.test(value.trim())
          : Boolean(value.trim());
    if (!isValid) {
      setError(c.required);
      AccessibilityInfo.announceForAccessibility(c.required);
      return;
    }
    if (!consented) {
      setError(c.consentRequired);
      AccessibilityInfo.announceForAccessibility(c.consentRequired);
      return;
    }
    setError("");
    setIsSubmitting(true);
    if (!accessApiUrl) {
      setOutcome("queued");
      setScreen("complete");
      setIsSubmitting(false);
      AccessibilityInfo.announceForAccessibility(c.queuedTitle);
      return;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(`${accessApiUrl}/v1/access-requests`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-sozorock-client": "mobile-v1",
        },
        body: JSON.stringify({
          journey,
          location: value.trim() || undefined,
          selection: selectionCode(journey as Journey, selectedOption, c),
          locale: language,
          source: "mobile",
          consent: consented,
          consentVersion: "mobile-access-v1",
        }),
        signal: controller.signal,
      });
      if (response.status === 204) {
        setOutcome("empty");
      } else if (response.ok) {
        const payload = (await response.json().catch(() => null)) as {pathways?: unknown[]} | null;
        setOutcome(payload?.pathways?.length === 0 ? "empty" : "success");
      } else {
        throw new Error(`Access request failed with ${response.status}`);
      }
      setScreen("complete");
    } catch {
      setOutcome("error");
      setScreen("complete");
    } finally {
      clearTimeout(timeout);
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.paper} />
      <Header languageLabel={c.language} onLanguage={toggleLanguage} onHome={reset} />
      {screen === "welcome" ? (
        <WelcomeScreen
          copy={c}
          isTablet={isTablet}
          isSpeaking={isSpeaking}
          voiceStatus={voiceStatus}
          isRecognizing={isRecognizing}
          transcript={transcript}
          onSpeech={toggleSpeech}
          onVoiceInput={toggleVoiceInput}
          onJourney={startJourney}
        />
      ) : (
        <JourneyScreen
          copy={c}
          journey={journey as Journey}
          screen={screen}
          value={value}
          selectedOption={selectedOption}
          error={error}
          consented={consented}
          isSubmitting={isSubmitting}
          outcome={outcome}
          isTablet={isTablet}
          onValue={next => {
            setValue(next);
            setError("");
          }}
          onOption={next => {
            setSelectedOption(next);
            setError("");
          }}
          onBack={() => setScreen("welcome")}
          onSubmit={submit}
          onConsent={() => {
            setConsented(current => !current);
            setError("");
          }}
          onReset={reset}
        />
      )}
      <TrustFooter emergency={c.emergency} privacy={c.privacy} privacyLink={c.privacyLink} lowData={c.lowData} isTablet={isTablet} />
    </SafeAreaView>
  );
}

function Header({
  languageLabel,
  onLanguage,
  onHome,
}: {
  languageLabel: string;
  onLanguage: () => void;
  onHome: () => void;
}) {
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityLabel="SozoRock Health home"
        accessibilityRole="button"
        hitSlop={12}
        onPress={onHome}
        style={({pressed}) => [styles.brandButton, pressed && styles.pressed]}
      >
        <View accessibilityLabel="SozoRock Health, registered trademark" accessible>
          <Text style={styles.wordmarkText}>
            <Text style={styles.wordmarkCapital}>S</Text>ozo
            <Text style={styles.wordmarkCapital}>R</Text>ock
            <Text style={styles.registered}>®</Text>
          </Text>
          <Text style={styles.healthLabel}>HEALTH</Text>
        </View>
      </Pressable>
      <Pressable
        accessibilityHint="Changes the app language"
        accessibilityLabel={`Change language to ${languageLabel}`}
        accessibilityRole="button"
        hitSlop={12}
        onPress={onLanguage}
        style={({pressed}) => [styles.languageButton, pressed && styles.pressed]}
      >
        <Text accessibilityElementsHidden importantForAccessibility="no" style={styles.globe}>◉</Text>
        <Text style={styles.languageText}>{languageLabel}</Text>
      </Pressable>
    </View>
  );
}

function WelcomeScreen({
  copy: c,
  isTablet,
  isSpeaking,
  voiceStatus,
  isRecognizing,
  transcript,
  onSpeech,
  onVoiceInput,
  onJourney,
}: {
  copy: (typeof copy)[Language];
  isTablet: boolean;
  isSpeaking: boolean;
  voiceStatus: VoiceStatus;
  isRecognizing: boolean;
  transcript: string;
  onSpeech: () => void;
  onVoiceInput: () => void;
  onJourney: (journey: Journey) => void;
}) {
  return (
    <ScrollView
      contentContainerStyle={[styles.welcomeScroll, isTablet && styles.welcomeScrollTablet]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.welcome, isTablet && styles.welcomeTablet]}>
        <View style={[styles.introduction, isTablet && styles.introductionTablet]}>
          <Text style={styles.eyebrow}>{c.eyebrow}</Text>
          <View style={styles.eyebrowRule} />
          <Text accessibilityRole="header" style={[styles.title, isTablet && styles.titleTablet]}>
            {c.title}
          </Text>
          <Text style={styles.subtitle}>{c.subtitle}</Text>
          <View accessibilityLiveRegion="polite" style={styles.readinessRow}>
            <View style={[styles.readinessDot, voiceStatus === "ready" && styles.readinessDotReady]} />
            <Text style={styles.readinessText}>
              {voiceStatus === "loading"
                ? c.voiceLoading
                : voiceStatus === "ready"
                  ? c.voiceReady
                  : c.voiceUnavailable}
            </Text>
            <View style={styles.readinessDivider} />
            <Text style={styles.readinessText}>{c.lowDataMode}</Text>
          </View>
          <Pressable
            accessibilityLabel={isSpeaking ? c.stop : c.hear}
            accessibilityRole="button"
            accessibilityState={{disabled: voiceStatus !== "ready", selected: isSpeaking}}
            disabled={voiceStatus !== "ready"}
            onPress={onSpeech}
            style={({pressed}) => [
              styles.voiceButton,
              isSpeaking && styles.voiceButtonActive,
              voiceStatus !== "ready" && styles.voiceButtonDisabled,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.voiceIcon}>
              <View style={styles.microphoneStem} />
              <View style={styles.microphoneHead} />
            </View>
            <View>
              <Text style={styles.voiceButtonText}>{isSpeaking ? c.stop : c.hear}</Text>
              <Text style={styles.voiceButtonHint}>{isSpeaking ? "••••  •••  ••••" : "—  —  —"}</Text>
            </View>
          </Pressable>
          <Pressable
            accessibilityLabel={isRecognizing ? c.stopVoice : c.startVoice}
            accessibilityRole="button"
            accessibilityState={{selected: isRecognizing}}
            onPress={onVoiceInput}
            style={({pressed}) => [styles.voiceInputButton, isRecognizing && styles.voiceButtonActive, pressed && styles.pressed]}
          >
            <Text style={styles.voiceButtonText}>{isRecognizing ? c.stopVoice : c.startVoice}</Text>
            <Text accessibilityLiveRegion="polite" style={styles.voiceInputHint}>{transcript || c.voicePrompt}</Text>
          </Pressable>
        </View>
        <View style={[styles.journeyGrid, isTablet && styles.journeyGridTablet]}>
          <JourneyCard
            body={c.careBody}
            journey="care"
            title={c.careTitle}
            onPress={() => onJourney("care")}
          />
          <JourneyCard
            body={c.hubBody}
            journey="hub"
            title={c.hubTitle}
            onPress={() => onJourney("hub")}
          />
          <JourneyCard
            body={c.languageBody}
            journey="language"
            title={c.languageTitle}
            onPress={() => onJourney("language")}
          />
        </View>
      </View>
    </ScrollView>
  );
}

function JourneyCard({
  journey,
  title,
  body,
  onPress,
}: {
  journey: Journey;
  title: string;
  body: string;
  onPress: () => void;
}) {
  const meta = journeyMeta[journey];
  return (
    <Pressable
      accessibilityHint={body}
      accessibilityLabel={title}
      accessibilityRole="button"
      onPress={onPress}
      style={({pressed}) => [styles.journeyCard, pressed && styles.cardPressed]}
    >
      <View style={styles.cardTopline}>
        <Text style={styles.cardNumber}>{meta.label}</Text>
        <View style={[styles.cardIcon, styles[`${meta.tone}Icon`]]}>
          <JourneyIcon journey={journey} />
        </View>
      </View>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardBody}>{body}</Text>
      <View style={styles.cardAction}>
        <Text style={styles.cardActionText}>CONTINUE</Text>
        <Text style={styles.cardArrow}>→</Text>
      </View>
    </Pressable>
  );
}

function JourneyIcon({journey}: {journey: Journey}) {
  if (journey === "care") {
    return (
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.searchIcon}>
        <View style={styles.searchLens} />
        <View style={styles.searchHandle} />
      </View>
    );
  }
  if (journey === "hub") {
    return (
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.hubIcon}>
        <View style={styles.hubRoof} />
        <View style={styles.hubBuilding}>
          <View style={styles.hubDoor} />
        </View>
      </View>
    );
  }
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.languageIcon}>
      <View style={styles.languageBubble}>
        <Text style={styles.languageGlyph}>A</Text>
      </View>
      <View style={styles.languageBubbleSmall}>
        <Text style={styles.languageGlyphSmall}>a</Text>
      </View>
    </View>
  );
}

function JourneyScreen({
  copy: c,
  journey,
  screen,
  value,
  selectedOption,
  error,
  consented,
  isSubmitting,
  outcome,
  isTablet,
  onValue,
  onOption,
  onBack,
  onSubmit,
  onConsent,
  onReset,
}: {
  copy: (typeof copy)[Language];
  journey: Journey;
  screen: Screen;
  value: string;
  selectedOption: string;
  error: string;
  consented: boolean;
  isSubmitting: boolean;
  outcome: RequestOutcome;
  isTablet: boolean;
  onValue: (value: string) => void;
  onOption: (value: string) => void;
  onBack: () => void;
  onSubmit: () => Promise<void>;
  onConsent: () => void;
  onReset: () => void;
}) {
  const title = journey === "care" ? c.careTitle : journey === "hub" ? c.hubTitle : c.languageTitle;
  const body = journey === "care" ? c.careBody : journey === "hub" ? c.hubBody : c.languageBody;
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.journeyScreen}
    >
      <ScrollView
        contentContainerStyle={[styles.journeyScroll, isTablet && styles.journeyScrollTablet]}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          accessibilityLabel={c.back}
          accessibilityRole="button"
          hitSlop={12}
          onPress={onBack}
          style={({pressed}) => [styles.backButton, pressed && styles.pressed]}
        >
          <Text style={styles.backArrow}>←</Text>
          <Text style={styles.backText}>{c.back}</Text>
        </Pressable>
        <View style={styles.stepRule} />
        {screen === "complete" ? (
          <View accessibilityLiveRegion="polite" style={styles.completeCard}>
            <Text style={[styles.completeMark, outcome === "error" && styles.completeMarkError]}>
              {outcome === "error" ? "!" : outcome === "empty" ? "—" : "✓"}
            </Text>
            <Text style={styles.completeEyebrow}>{c.reference}</Text>
            <Text accessibilityRole="header" style={styles.completeTitle}>
              {outcome === "queued"
                ? c.queuedTitle
                : outcome === "empty"
                  ? c.emptyTitle
                  : outcome === "error"
                    ? c.errorTitle
                    : c.completeTitle}
            </Text>
            <Text style={styles.completeBody}>
              {outcome === "queued"
                ? c.queuedBody
                : outcome === "empty"
                  ? c.emptyBody
                  : outcome === "error"
                    ? c.errorBody
                    : c.completeBody}
            </Text>
            {outcome === "error" && (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{busy: isSubmitting, disabled: isSubmitting}}
                disabled={isSubmitting}
                onPress={onSubmit}
                style={({pressed}) => [styles.secondaryButton, pressed && styles.pressed]}
              >
                {isSubmitting ? (
                  <ActivityIndicator color={colors.ink} />
                ) : (
                  <Text style={styles.secondaryButtonText}>{c.retry}</Text>
                )}
              </Pressable>
            )}
            <Pressable
              accessibilityRole="button"
              onPress={onReset}
              style={({pressed}) => [styles.primaryButton, pressed && styles.primaryPressed]}
            >
              <Text style={styles.primaryButtonText}>{c.finish}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.formCard}>
            <Text style={styles.formEyebrow}>{journeyMeta[journey].label}</Text>
            <Text accessibilityRole="header" style={styles.formTitle}>
              {title}
            </Text>
            <Text style={styles.formBody}>{body}</Text>
            {journey === "language" ? (
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>{c.languagePrompt}</Text>
                <View style={styles.optionGrid}>
                  {c.languages.map(option => (
                    <Pressable
                      accessibilityRole="radio"
                      accessibilityState={{checked: selectedOption === option}}
                      key={option}
                      onPress={() => onOption(option)}
                      style={({pressed}) => [
                        styles.optionButton,
                        selectedOption === option && styles.optionButtonSelected,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          selectedOption === option && styles.optionTextSelected,
                        ]}
                      >
                        {option}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : (
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>{journey === "care" ? c.zip : c.hubCode}</Text>
                <TextInput
                  accessibilityLabel={journey === "care" ? c.zip : c.hubCode}
                  autoCapitalize={journey === "care" ? "none" : "words"}
                  autoComplete={journey === "care" ? "postal-code" : "off"}
                  keyboardType={journey === "care" ? "number-pad" : "default"}
                  maxLength={journey === "care" ? 5 : 80}
                  onChangeText={onValue}
                  placeholder={journey === "care" ? c.zipHint : c.hubHint}
                  placeholderTextColor={colors.muted}
                  returnKeyType="done"
                  style={styles.input}
                  value={value}
                />
                {journey === "care" && (
                  <>
                    <Text style={[styles.fieldLabel, styles.supportLabel]}>{c.support}</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View style={styles.chipRow}>
                        {c.supportOptions.map(option => (
                          <Pressable
                            accessibilityRole="radio"
                            accessibilityState={{checked: selectedOption === option}}
                            key={option}
                            onPress={() => onOption(option)}
                            style={({pressed}) => [
                              styles.chip,
                              selectedOption === option && styles.chipSelected,
                              pressed && styles.pressed,
                            ]}
                          >
                            <Text
                              style={[
                                styles.chipText,
                                selectedOption === option && styles.chipTextSelected,
                              ]}
                            >
                              {option}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </ScrollView>
                  </>
                )}
              </View>
            )}
            {error ? (
              <Text accessibilityLiveRegion="polite" style={styles.errorText}>
                {error}
              </Text>
            ) : null}
            <Pressable
              accessibilityHint={c.consent}
              accessibilityLabel={c.consent}
              accessibilityRole="checkbox"
              accessibilityState={{checked: consented}}
              onPress={onConsent}
              style={({pressed}) => [styles.consentRow, pressed && styles.pressed]}
            >
              <View style={[styles.checkbox, consented && styles.checkboxChecked]}>
                {consented && <Text style={styles.checkboxMark}>✓</Text>}
              </View>
              <Text style={styles.consentText}>{c.consent}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{busy: isSubmitting, disabled: isSubmitting}}
              disabled={isSubmitting}
              onPress={onSubmit}
              style={({pressed}) => [styles.primaryButton, pressed && styles.primaryPressed]}
            >
              {isSubmitting ? (
                <>
                  <ActivityIndicator color={colors.white} />
                  <Text style={[styles.primaryButtonText, styles.loadingText]}>{c.loading}</Text>
                </>
              ) : (
                <>
                  <Text style={styles.primaryButtonText}>{c.continue}</Text>
                  <Text style={styles.primaryArrow}>→</Text>
                </>
              )}
            </Pressable>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function TrustFooter({
  emergency,
  privacy,
  privacyLink,
  lowData,
  isTablet,
}: {
  emergency: string;
  privacy: string;
  privacyLink: string;
  lowData: string;
  isTablet: boolean;
}) {
  return (
    <View style={[styles.footer, !isTablet && styles.footerCompact]}>
      <View style={styles.footerItem}>
        <Text style={styles.footerLock}>◇</Text>
        <View>
          <Text style={styles.footerTitle}>{privacy}</Text>
          <Text style={styles.footerBody}>{lowData}</Text>
          {privacyUrl ? (
            <Pressable
              accessibilityRole="link"
              hitSlop={8}
              onPress={() => Linking.openURL(privacyUrl)}
            >
              <Text style={styles.privacyLink}>{privacyLink}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      <Text accessibilityRole="alert" style={[styles.emergency, !isTablet && styles.emergencyCompact]}>
        {emergency}
      </Text>
    </View>
  );
}

const colors = {
  ink: "#10241F",
  muted: "#68716C",
  paper: "#F8F5EE",
  white: "#FFFEFA",
  line: "#D9D4C9",
  green: "#385847",
  paleGreen: "#E7EEE8",
  gold: "#8A5F0F",
  paleGold: "#F4E8CA",
  clay: "#B84B31",
  paleClay: "#F6E4DF",
  blue: "#1B5962",
  paleBlue: "#E1EFF0",
  error: "#A93226",
};

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: colors.paper},
  header: {
    alignItems: "center",
    borderBottomColor: colors.line,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 76,
    paddingHorizontal: 24,
  },
  brandButton: {alignItems: "flex-start", justifyContent: "center"},
  wordmarkText: {color: colors.ink, fontFamily: Platform.select({ios: "New York", default: "serif"}), fontSize: 25, fontWeight: "500", letterSpacing: -1.45},
  wordmarkCapital: {fontSize: 27, fontWeight: "700"},
  registered: {fontFamily: Platform.select({ios: "Helvetica Neue", default: "sans-serif"}), fontSize: 8, fontWeight: "700", letterSpacing: 0},
  healthLabel: {color: colors.clay, fontSize: 8, fontWeight: "800", letterSpacing: 5.2, marginLeft: 36, marginTop: -2},
  languageButton: {alignItems: "center", flexDirection: "row", minHeight: 48, paddingHorizontal: 8},
  globe: {color: colors.ink, fontSize: 24, marginRight: 8},
  languageText: {color: colors.ink, fontSize: 15, fontWeight: "700"},
  pressed: {opacity: 0.62},
  welcomeScroll: {flexGrow: 1, padding: 20},
  welcomeScrollTablet: {justifyContent: "center", paddingHorizontal: 40, paddingVertical: 32},
  welcome: {alignSelf: "center", maxWidth: 1120, width: "100%"},
  welcomeTablet: {alignItems: "center", flexDirection: "row", gap: 48},
  introduction: {alignItems: "center", paddingHorizontal: 6, paddingVertical: 24},
  introductionTablet: {alignItems: "flex-start", flex: 0.84, paddingHorizontal: 0},
  eyebrow: {color: colors.green, fontSize: 12, fontWeight: "800", letterSpacing: 2.2},
  eyebrowRule: {backgroundColor: colors.green, height: 2, marginBottom: 22, marginTop: 12, width: 38},
  title: {color: colors.ink, fontFamily: Platform.select({ios: "New York", default: "serif"}), fontSize: 42, fontWeight: "500", letterSpacing: -1.4, lineHeight: 47, maxWidth: 560, textAlign: "center"},
  titleTablet: {fontSize: 52, lineHeight: 57, textAlign: "left"},
  subtitle: {color: colors.muted, fontSize: 17, lineHeight: 25, marginTop: 17, maxWidth: 500, textAlign: "center"},
  readinessRow: {alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 7, justifyContent: "center", marginTop: 17},
  readinessDot: {backgroundColor: colors.muted, borderRadius: 4, height: 7, width: 7},
  readinessDotReady: {backgroundColor: colors.green},
  readinessDivider: {backgroundColor: colors.line, height: 14, width: 1},
  readinessText: {color: colors.muted, fontSize: 11, fontWeight: "700"},
  voiceButton: {alignItems: "center", alignSelf: "stretch", backgroundColor: colors.paleGold, borderColor: "#DFC37C", borderRadius: 999, borderWidth: 1, flexDirection: "row", justifyContent: "center", marginTop: 28, minHeight: 64, paddingHorizontal: 24},
  voiceButtonActive: {backgroundColor: colors.paleGreen, borderColor: "#98B09D"},
  voiceButtonDisabled: {backgroundColor: "#EEEAE1", borderColor: colors.line, opacity: 0.72},
  voiceIcon: {height: 30, marginRight: 14, position: "relative", width: 22},
  microphoneHead: {borderColor: colors.gold, borderRadius: 7, borderWidth: 2, height: 17, left: 6, position: "absolute", top: 1, width: 10},
  microphoneStem: {borderBottomColor: colors.gold, borderBottomWidth: 2, borderLeftColor: colors.gold, borderLeftWidth: 2, borderRightColor: colors.gold, borderRightWidth: 2, borderRadius: 8, height: 20, left: 3, position: "absolute", top: 7, width: 16},
  voiceButtonText: {color: colors.ink, fontSize: 15, fontWeight: "800"},
  voiceButtonHint: {color: colors.gold, fontSize: 10, letterSpacing: 2, marginTop: 2},
  voiceInputButton: {alignItems: "center", alignSelf: "stretch", backgroundColor: colors.paper, borderColor: colors.green, borderRadius: 18, borderWidth: 1, justifyContent: "center", marginTop: 12, minHeight: 64, paddingHorizontal: 20, paddingVertical: 10},
  voiceInputHint: {color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 4, textAlign: "center"},
  journeyGrid: {gap: 12, paddingBottom: 20},
  journeyGridTablet: {flex: 1.16},
  journeyCard: {backgroundColor: colors.white, borderColor: colors.line, borderRadius: 18, borderWidth: 1, minHeight: 162, padding: 20, shadowColor: colors.ink, shadowOffset: {width: 0, height: 6}, shadowOpacity: 0.055, shadowRadius: 18},
  cardPressed: {backgroundColor: "#F3EFE6", transform: [{scale: 0.992}]},
  cardTopline: {alignItems: "flex-start", flexDirection: "row", justifyContent: "space-between"},
  cardNumber: {color: colors.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1.25},
  cardIcon: {alignItems: "center", borderRadius: 20, height: 40, justifyContent: "center", width: 40},
  goldIcon: {backgroundColor: colors.paleGold},
  clayIcon: {backgroundColor: colors.paleClay},
  blueIcon: {backgroundColor: colors.paleBlue},
  searchIcon: {height: 27, position: "relative", width: 27},
  searchLens: {borderColor: colors.ink, borderRadius: 9, borderWidth: 1.8, height: 18, left: 1, position: "absolute", top: 1, width: 18},
  searchHandle: {backgroundColor: colors.ink, height: 2, left: 17, position: "absolute", top: 19, transform: [{rotate: "45deg"}], width: 10},
  hubIcon: {alignItems: "center", height: 27, justifyContent: "flex-end", position: "relative", width: 29},
  hubRoof: {borderBottomColor: colors.ink, borderBottomWidth: 1.8, borderRightColor: colors.ink, borderRightWidth: 1.8, height: 17, position: "absolute", top: 0, transform: [{rotate: "45deg"}], width: 17},
  hubBuilding: {alignItems: "center", borderBottomColor: colors.ink, borderBottomWidth: 1.8, borderLeftColor: colors.ink, borderLeftWidth: 1.8, borderRightColor: colors.ink, borderRightWidth: 1.8, height: 16, justifyContent: "flex-end", width: 23},
  hubDoor: {borderColor: colors.ink, borderWidth: 1.5, height: 9, width: 6},
  languageIcon: {height: 28, position: "relative", width: 30},
  languageBubble: {alignItems: "center", borderColor: colors.ink, borderRadius: 9, borderWidth: 1.6, height: 21, justifyContent: "center", left: 0, position: "absolute", top: 0, width: 23},
  languageBubbleSmall: {alignItems: "center", backgroundColor: colors.white, borderColor: colors.ink, borderRadius: 7, borderWidth: 1.4, bottom: 0, height: 15, justifyContent: "center", position: "absolute", right: 0, width: 17},
  languageGlyph: {color: colors.ink, fontSize: 11, fontWeight: "800"},
  languageGlyphSmall: {color: colors.ink, fontSize: 9, fontWeight: "800"},
  cardTitle: {color: colors.ink, fontFamily: Platform.select({ios: "New York", default: "serif"}), fontSize: 25, fontWeight: "600", letterSpacing: -0.4, marginTop: -4},
  cardBody: {color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 7, maxWidth: 430},
  cardAction: {alignItems: "center", flexDirection: "row", marginTop: 17},
  cardActionText: {color: colors.green, fontSize: 10, fontWeight: "900", letterSpacing: 1.6},
  cardArrow: {color: colors.green, fontSize: 17, marginLeft: 8},
  journeyScreen: {flex: 1},
  journeyScroll: {flexGrow: 1, padding: 20},
  journeyScrollTablet: {alignSelf: "center", maxWidth: 840, paddingVertical: 36, width: "100%"},
  backButton: {alignItems: "center", alignSelf: "flex-start", flexDirection: "row", minHeight: 48},
  backArrow: {color: colors.ink, fontSize: 23, marginRight: 8},
  backText: {color: colors.ink, fontSize: 15, fontWeight: "800"},
  stepRule: {backgroundColor: colors.gold, height: 3, marginBottom: 18, width: 54},
  formCard: {backgroundColor: colors.white, borderColor: colors.line, borderRadius: 22, borderWidth: 1, padding: 26},
  formEyebrow: {color: colors.gold, fontSize: 11, fontWeight: "900", letterSpacing: 2},
  formTitle: {color: colors.ink, fontFamily: Platform.select({ios: "New York", default: "serif"}), fontSize: 38, fontWeight: "500", letterSpacing: -1, lineHeight: 43, marginTop: 12},
  formBody: {color: colors.muted, fontSize: 16, lineHeight: 24, marginTop: 10, maxWidth: 650},
  fieldGroup: {marginTop: 30},
  fieldLabel: {color: colors.ink, fontSize: 14, fontWeight: "800", marginBottom: 10},
  input: {backgroundColor: colors.paper, borderColor: "#AFA99D", borderRadius: 12, borderWidth: 1, color: colors.ink, fontSize: 18, minHeight: 58, paddingHorizontal: 17},
  supportLabel: {marginTop: 25},
  chipRow: {flexDirection: "row", gap: 9, paddingBottom: 4},
  chip: {backgroundColor: colors.paper, borderColor: colors.line, borderRadius: 999, borderWidth: 1, minHeight: 46, paddingHorizontal: 17, paddingVertical: 13},
  chipSelected: {backgroundColor: colors.green, borderColor: colors.green},
  chipText: {color: colors.ink, fontSize: 14, fontWeight: "700"},
  chipTextSelected: {color: colors.white},
  optionGrid: {gap: 10},
  optionButton: {backgroundColor: colors.paper, borderColor: colors.line, borderRadius: 12, borderWidth: 1, justifyContent: "center", minHeight: 58, paddingHorizontal: 17},
  optionButtonSelected: {backgroundColor: colors.paleGreen, borderColor: colors.green, borderWidth: 2},
  optionText: {color: colors.ink, fontSize: 16, fontWeight: "700"},
  optionTextSelected: {color: colors.green},
  errorText: {color: colors.error, fontSize: 14, fontWeight: "700", marginTop: 18},
  consentRow: {alignItems: "flex-start", flexDirection: "row", marginTop: 22, minHeight: 48, paddingVertical: 8},
  checkbox: {alignItems: "center", borderColor: colors.muted, borderRadius: 5, borderWidth: 1.5, height: 24, justifyContent: "center", marginRight: 12, width: 24},
  checkboxChecked: {backgroundColor: colors.green, borderColor: colors.green},
  checkboxMark: {color: colors.white, fontSize: 15, fontWeight: "900"},
  consentText: {color: colors.ink, flex: 1, fontSize: 13, lineHeight: 19},
  primaryButton: {alignItems: "center", alignSelf: "stretch", backgroundColor: colors.ink, borderRadius: 12, flexDirection: "row", justifyContent: "center", marginTop: 24, minHeight: 58, paddingHorizontal: 22},
  primaryPressed: {backgroundColor: colors.green, transform: [{scale: 0.995}]},
  primaryButtonText: {color: colors.white, fontSize: 16, fontWeight: "800"},
  loadingText: {marginLeft: 10},
  primaryArrow: {color: colors.white, fontSize: 20, marginLeft: 12},
  secondaryButton: {alignItems: "center", borderColor: colors.ink, borderRadius: 12, borderWidth: 1, justifyContent: "center", marginTop: 22, minHeight: 54, paddingHorizontal: 24},
  secondaryButtonText: {color: colors.ink, fontSize: 15, fontWeight: "800"},
  completeCard: {alignItems: "center", backgroundColor: colors.white, borderColor: colors.line, borderRadius: 22, borderWidth: 1, paddingHorizontal: 28, paddingVertical: 42},
  completeMark: {backgroundColor: colors.paleGreen, borderRadius: 35, color: colors.green, fontSize: 35, height: 70, lineHeight: 70, marginBottom: 20, overflow: "hidden", textAlign: "center", width: 70},
  completeMarkError: {backgroundColor: colors.paleClay, color: colors.error},
  completeEyebrow: {color: colors.green, fontSize: 11, fontWeight: "900", letterSpacing: 2},
  completeTitle: {color: colors.ink, fontFamily: Platform.select({ios: "New York", default: "serif"}), fontSize: 38, fontWeight: "500", letterSpacing: -1, marginTop: 10, textAlign: "center"},
  completeBody: {color: colors.muted, fontSize: 16, lineHeight: 25, marginTop: 16, maxWidth: 600, textAlign: "center"},
  footer: {alignItems: "center", backgroundColor: colors.white, borderTopColor: colors.line, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: "row", justifyContent: "space-between", minHeight: 68, paddingHorizontal: 24, paddingVertical: 10},
  footerCompact: {alignItems: "flex-start", paddingHorizontal: 20, paddingVertical: 12},
  footerItem: {alignItems: "center", flex: 1, flexDirection: "row"},
  footerLock: {color: colors.green, fontSize: 20, marginRight: 9},
  footerTitle: {color: colors.ink, fontSize: 11, fontWeight: "800"},
  footerBody: {color: colors.muted, fontSize: 9, marginTop: 2, maxWidth: 290},
  privacyLink: {color: colors.green, fontSize: 10, fontWeight: "800", marginTop: 3, textDecorationLine: "underline"},
  emergency: {color: colors.error, fontSize: 11, fontWeight: "800", marginLeft: 12, textAlign: "right"},
  emergencyCompact: {maxWidth: 116},
});
