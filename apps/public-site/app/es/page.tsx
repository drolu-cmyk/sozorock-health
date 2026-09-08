import { HealthHome } from "../components/HealthHome";
import { healthMetadata } from "../lib/health-metadata";
export const metadata = {
  ...healthMetadata(
    "Sistemas para el acceso a la salud",
    "Modelos de acceso comunitario, inteligencia territorial, preparación digital y desarrollo de la fuerza laboral. Conozca SozoRock Health.",
    "/es",
    { spanish: true },
  ),
  alternates: { canonical: "/es", languages: { "en-US": "/", "es-US": "/es" } },
};
export default function SpanishHome() {
  return <HealthHome spanish />;
}
