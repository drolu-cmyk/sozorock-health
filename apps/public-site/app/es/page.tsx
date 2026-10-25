
import { ApprovedHealthPage } from "../components/ApprovedHealthPages";
import { HealthStory } from "../components/HealthStory";
import { healthMetadata, healthPageSchema } from "../lib/health-metadata";

const title = "Acceso a la salud para cada código postal";
export const metadata = {
  ...healthMetadata(
    title,
    "La atención médica es muy escasa, está muy lejos y es muy difícil de obtener. SozoRock Health ayuda a cambiar las tres cosas con Health Equity Hubs, Health Access Day, atención primaria patrocinada y datos de condados gratuitos. Toda la atención la brindan proveedores con licencia.",
    "/es",
    { spanish: true },
  ),
  alternates: { canonical: "/es", languages: { "en-US": "/", "es-US": "/es" } },
};
function spanishSchema() {
  const schema = healthPageSchema(title, "/es");
  return { ...schema, "@graph": schema["@graph"].map((node, index) => (index === 0 ? { ...node, inLanguage: "es-US" } : node)) };
}
export default function SpanishHome() {
  return <><ApprovedHealthPage pathname="/es" spanish><HealthStory spanish /></ApprovedHealthPage><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(spanishSchema()) }} /></>;
}
