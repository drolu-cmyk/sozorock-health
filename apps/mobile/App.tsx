import * as Speech from "expo-speech";
import {useEffect, useMemo, useState} from "react";
import {
  AccessibilityInfo,
  AppState,
  Image,
  KeyboardAvoidingView,
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

type Language = "en" | "es";
type Journey = "care" | "hub" | "language";
type Screen = "welcome" | "details" | "complete";

const copy = {
  en: {
    language: "Español",
    eyebrow: "RESIDENT ACCESS",
    title: "How can we support you today?",
    subtitle: "Choose an option below. You can listen to this screen at any time.",
    hear: "Hear this screen",
    stop: "Stop listening",
    careTitle: "Find care",
    careBody: "Connect with a licensed provider available in your state.",
    hubTitle: "Check in at a hub",
    hubBody: "Start at a Library, Community, or Home-Based Hub.",
    languageTitle: "Get language support",
    languageBody: "Choose a language or request interpretation support.",
    lowData: "Designed for shared tablets and low-data connections",
    privacy: "Non-clinical access support",
    emergency: "If this is an emergency, call 911.",
    back: "Back",
    restart: "Start over",
    zip: "ZIP code",
    zipHint: "Enter your 5-digit ZIP code",
    hubCode: "Hub name or code",
    hubHint: "Enter the hub name or code shown at this location",
    support: "What kind of support are you looking for?",
    supportOptions: ["Primary care", "Mental health", "Medication support", "I’m not sure"],
    continue: "Continue",
    required: "Enter the requested information to continue.",
    languagePrompt: "Choose your preferred language",
    languages: ["English", "Español", "American Sign Language", "Another language"],
    completeTitle: "Your request is ready.",
    completeBody:
      "SozoRock Health will use your location and selection to show the next available access pathway. Provider availability depends on state licensure and participation.",
    reference: "ACCESS REQUEST",
    finish: "Return to welcome",
  },
  es: {
    language: "English",
    eyebrow: "ACCESO PARA RESIDENTES",
    title: "¿Cómo podemos apoyarle hoy?",
    subtitle: "Elija una opción. Puede escuchar esta pantalla en cualquier momento.",
    hear: "Escuchar esta pantalla",
    stop: "Dejar de escuchar",
    careTitle: "Encontrar atención",
    careBody: "Conéctese con un proveedor autorizado disponible en su estado.",
    hubTitle: "Registrarse en un centro",
    hubBody: "Comience en un centro de biblioteca, comunidad o en el hogar.",
    languageTitle: "Obtener apoyo de idioma",
    languageBody: "Elija un idioma o solicite apoyo de interpretación.",
    lowData: "Diseñado para tabletas compartidas y conexiones de pocos datos",
    privacy: "Apoyo de acceso no clínico",
    emergency: "Si tiene una emergencia, llame al 911.",
    back: "Atrás",
    restart: "Empezar de nuevo",
    zip: "Código postal",
    zipHint: "Ingrese su código postal de 5 dígitos",
    hubCode: "Nombre o código del centro",
    hubHint: "Ingrese el nombre o código que aparece en este lugar",
    support: "¿Qué tipo de apoyo está buscando?",
    supportOptions: ["Atención primaria", "Salud mental", "Apoyo con medicamentos", "No estoy seguro"],
    continue: "Continuar",
    required: "Ingrese la información solicitada para continuar.",
    languagePrompt: "Elija su idioma preferido",
    languages: ["English", "Español", "Lengua de señas americana", "Otro idioma"],
    completeTitle: "Su solicitud está lista.",
    completeBody:
      "SozoRock Health usará su ubicación y selección para mostrar la próxima vía de acceso disponible. La disponibilidad del proveedor depende de su licencia estatal y participación.",
    reference: "SOLICITUD DE ACCESO",
    finish: "Volver al inicio",
  },
} as const;

const journeyMeta = {
  care: {number: "01", mark: "⌕", tone: "gold"},
  hub: {number: "02", mark: "⌂", tone: "clay"},
  language: {number: "03", mark: "A", tone: "blue"},
} as const;

export default function App() {
  const {width} = useWindowDimensions();
  const isTablet = width >= 760;
  const [language, setLanguage] = useState<Language>("en");
  const [journey, setJourney] = useState<Journey | null>(null);
  const [screen, setScreen] = useState<Screen>("welcome");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [value, setValue] = useState("");
  const [selectedOption, setSelectedOption] = useState("");
  const [error, setError] = useState("");
  const c = copy[language];

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReducedMotion);
    const motionSubscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReducedMotion,
    );
    const appSubscription = AppState.addEventListener("change", state => {
      if (state !== "active") {
        Speech.stop();
        setIsSpeaking(false);
        setJourney(null);
        setScreen("welcome");
        setValue("");
        setSelectedOption("");
        setError("");
      }
    });
    return () => {
      motionSubscription.remove();
      appSubscription.remove();
      Speech.stop();
    };
  }, []);

  const spokenWelcome = useMemo(
    () =>
      `${c.title} ${c.subtitle} ${c.careTitle}. ${c.careBody} ${c.hubTitle}. ${c.hubBody} ${c.languageTitle}. ${c.languageBody}`,
    [c],
  );

  const reset = () => {
    Speech.stop();
    setIsSpeaking(false);
    setJourney(null);
    setScreen("welcome");
    setValue("");
    setSelectedOption("");
    setError("");
  };

  const toggleLanguage = () => {
    Speech.stop();
    setIsSpeaking(false);
    setLanguage(current => (current === "en" ? "es" : "en"));
    setError("");
  };

  const toggleSpeech = () => {
    if (isSpeaking) {
      Speech.stop();
      setIsSpeaking(false);
      return;
    }
    setIsSpeaking(true);
    Speech.speak(spokenWelcome, {
      language: language === "es" ? "es-US" : "en-US",
      rate: reducedMotion ? 0.82 : 0.9,
      onDone: () => setIsSpeaking(false),
      onStopped: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
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
  };

  const submit = () => {
    const isValid = journey === "language" ? Boolean(selectedOption) : Boolean(value.trim());
    if (!isValid) {
      setError(c.required);
      AccessibilityInfo.announceForAccessibility(c.required);
      return;
    }
    setError("");
    setScreen("complete");
    AccessibilityInfo.announceForAccessibility(c.completeTitle);
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
          onSpeech={toggleSpeech}
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
          onReset={reset}
        />
      )}
      <TrustFooter emergency={c.emergency} privacy={c.privacy} lowData={c.lowData} />
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
        <Image
          accessibilityIgnoresInvertColors
          resizeMode="contain"
          source={require("./assets/sozorock-wordmark.png")}
          style={styles.wordmark}
        />
        <Text style={styles.healthLabel}>HEALTH</Text>
      </Pressable>
      <Pressable
        accessibilityHint="Changes the app language"
        accessibilityLabel={`Change language to ${languageLabel}`}
        accessibilityRole="button"
        hitSlop={12}
        onPress={onLanguage}
        style={({pressed}) => [styles.languageButton, pressed && styles.pressed]}
      >
        <Text style={styles.globe}>◎</Text>
        <Text style={styles.languageText}>{languageLabel}</Text>
      </Pressable>
    </View>
  );
}

function WelcomeScreen({
  copy: c,
  isTablet,
  isSpeaking,
  onSpeech,
  onJourney,
}: {
  copy: (typeof copy)[Language];
  isTablet: boolean;
  isSpeaking: boolean;
  onSpeech: () => void;
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
          <Pressable
            accessibilityLabel={isSpeaking ? c.stop : c.hear}
            accessibilityRole="button"
            accessibilityState={{selected: isSpeaking}}
            onPress={onSpeech}
            style={({pressed}) => [
              styles.voiceButton,
              isSpeaking && styles.voiceButtonActive,
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
        <Text style={styles.cardNumber}>{meta.number}</Text>
        <View style={[styles.cardIcon, styles[`${meta.tone}Icon`]]}>
          <Text style={styles.cardMark}>{meta.mark}</Text>
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

function JourneyScreen({
  copy: c,
  journey,
  screen,
  value,
  selectedOption,
  error,
  isTablet,
  onValue,
  onOption,
  onBack,
  onSubmit,
  onReset,
}: {
  copy: (typeof copy)[Language];
  journey: Journey;
  screen: Screen;
  value: string;
  selectedOption: string;
  error: string;
  isTablet: boolean;
  onValue: (value: string) => void;
  onOption: (value: string) => void;
  onBack: () => void;
  onSubmit: () => void;
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
          <View style={styles.completeCard}>
            <Text style={styles.completeMark}>✓</Text>
            <Text style={styles.completeEyebrow}>{c.reference}</Text>
            <Text accessibilityRole="header" style={styles.completeTitle}>
              {c.completeTitle}
            </Text>
            <Text style={styles.completeBody}>{c.completeBody}</Text>
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
            <Text style={styles.formEyebrow}>{journeyMeta[journey].number} / 03</Text>
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
              accessibilityRole="button"
              onPress={onSubmit}
              style={({pressed}) => [styles.primaryButton, pressed && styles.primaryPressed]}
            >
              <Text style={styles.primaryButtonText}>{c.continue}</Text>
              <Text style={styles.primaryArrow}>→</Text>
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
  lowData,
}: {
  emergency: string;
  privacy: string;
  lowData: string;
}) {
  return (
    <View style={styles.footer}>
      <View style={styles.footerItem}>
        <Text style={styles.footerLock}>◇</Text>
        <View>
          <Text style={styles.footerTitle}>{privacy}</Text>
          <Text style={styles.footerBody}>{lowData}</Text>
        </View>
      </View>
      <Text accessibilityRole="alert" style={styles.emergency}>
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
  gold: "#B88018",
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
  wordmark: {height: 25, width: 145},
  healthLabel: {color: colors.clay, fontSize: 8, fontWeight: "800", letterSpacing: 5.2, marginLeft: 36, marginTop: -1},
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
  voiceButton: {alignItems: "center", alignSelf: "stretch", backgroundColor: colors.paleGold, borderColor: "#DFC37C", borderRadius: 999, borderWidth: 1, flexDirection: "row", justifyContent: "center", marginTop: 28, minHeight: 64, paddingHorizontal: 24},
  voiceButtonActive: {backgroundColor: colors.paleGreen, borderColor: "#98B09D"},
  voiceIcon: {height: 30, marginRight: 14, position: "relative", width: 22},
  microphoneHead: {borderColor: colors.gold, borderRadius: 7, borderWidth: 2, height: 17, left: 6, position: "absolute", top: 1, width: 10},
  microphoneStem: {borderBottomColor: colors.gold, borderBottomWidth: 2, borderLeftColor: colors.gold, borderLeftWidth: 2, borderRightColor: colors.gold, borderRightWidth: 2, borderRadius: 8, height: 20, left: 3, position: "absolute", top: 7, width: 16},
  voiceButtonText: {color: colors.ink, fontSize: 15, fontWeight: "800"},
  voiceButtonHint: {color: colors.gold, fontSize: 10, letterSpacing: 2, marginTop: 2},
  journeyGrid: {gap: 12, paddingBottom: 20},
  journeyGridTablet: {flex: 1.16},
  journeyCard: {backgroundColor: colors.white, borderColor: colors.line, borderRadius: 18, borderWidth: 1, minHeight: 162, padding: 20, shadowColor: colors.ink, shadowOffset: {width: 0, height: 6}, shadowOpacity: 0.055, shadowRadius: 18},
  cardPressed: {backgroundColor: "#F3EFE6", transform: [{scale: 0.992}]},
  cardTopline: {alignItems: "flex-start", flexDirection: "row", justifyContent: "space-between"},
  cardNumber: {color: colors.muted, fontSize: 11, fontWeight: "800", letterSpacing: 1.5},
  cardIcon: {alignItems: "center", borderRadius: 20, height: 40, justifyContent: "center", width: 40},
  goldIcon: {backgroundColor: colors.paleGold},
  clayIcon: {backgroundColor: colors.paleClay},
  blueIcon: {backgroundColor: colors.paleBlue},
  cardMark: {color: colors.ink, fontFamily: Platform.select({ios: "New York", default: "serif"}), fontSize: 24},
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
  primaryButton: {alignItems: "center", alignSelf: "stretch", backgroundColor: colors.ink, borderRadius: 12, flexDirection: "row", justifyContent: "center", marginTop: 24, minHeight: 58, paddingHorizontal: 22},
  primaryPressed: {backgroundColor: colors.green, transform: [{scale: 0.995}]},
  primaryButtonText: {color: colors.white, fontSize: 16, fontWeight: "800"},
  primaryArrow: {color: colors.white, fontSize: 20, marginLeft: 12},
  completeCard: {alignItems: "center", backgroundColor: colors.white, borderColor: colors.line, borderRadius: 22, borderWidth: 1, paddingHorizontal: 28, paddingVertical: 42},
  completeMark: {backgroundColor: colors.paleGreen, borderRadius: 35, color: colors.green, fontSize: 35, height: 70, lineHeight: 70, marginBottom: 20, overflow: "hidden", textAlign: "center", width: 70},
  completeEyebrow: {color: colors.green, fontSize: 11, fontWeight: "900", letterSpacing: 2},
  completeTitle: {color: colors.ink, fontFamily: Platform.select({ios: "New York", default: "serif"}), fontSize: 38, fontWeight: "500", letterSpacing: -1, marginTop: 10, textAlign: "center"},
  completeBody: {color: colors.muted, fontSize: 16, lineHeight: 25, marginTop: 16, maxWidth: 600, textAlign: "center"},
  footer: {alignItems: "center", backgroundColor: colors.white, borderTopColor: colors.line, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: "row", justifyContent: "space-between", minHeight: 68, paddingHorizontal: 24, paddingVertical: 10},
  footerItem: {alignItems: "center", flex: 1, flexDirection: "row"},
  footerLock: {color: colors.green, fontSize: 20, marginRight: 9},
  footerTitle: {color: colors.ink, fontSize: 11, fontWeight: "800"},
  footerBody: {color: colors.muted, fontSize: 9, marginTop: 2, maxWidth: 290},
  emergency: {color: colors.error, fontSize: 11, fontWeight: "800", marginLeft: 12, textAlign: "right"},
});
