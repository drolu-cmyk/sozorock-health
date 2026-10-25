export const dynamic = "force-static";
export const revalidate = 3600;

import { ApprovedHealthPage } from "../../components/ApprovedHealthPages";
import { healthMetadata, healthPageSchema } from "../../lib/health-metadata";

const title = "Programa de Acceso a la Atención Primaria en Nueva York";
export const metadata = healthMetadata(
  title,
  "Un año de atención primaria patrocinada para hasta 25 personas en Nueva York que viven con una enfermedad crónica, a partir de enero de 2027. Conozca los requisitos, los datos y cómo patrocinar.",
  "/es/primary-care-access",
  { spanish: true },
);

function spanishSchema() {
  const schema = healthPageSchema(title, "/es/primary-care-access");
  return { ...schema, "@graph": schema["@graph"].map((node, index) => (index === 0 ? { ...node, inLanguage: "es-US" } : node)) };
}

export default function SpanishProgramPage() {
  return <><ApprovedHealthPage pathname="/es/primary-care-access" spanish /><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(spanishSchema()) }} /></>;
}
