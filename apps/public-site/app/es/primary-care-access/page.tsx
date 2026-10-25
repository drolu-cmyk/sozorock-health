
import { ApprovedHealthPage } from "../../components/ApprovedHealthPages";
import { healthMetadata, healthPageSchema, programSocialImage } from "../../lib/health-metadata";

const title = "Programa de Acceso a la Atención Primaria en Nueva York";
export const metadata = healthMetadata(
  title,
  "Un año de atención primaria patrocinada para hasta 25 personas en Nueva York que viven con una enfermedad crónica, a partir de enero de 2027. Conozca los requisitos, los datos y cómo patrocinar.",
  "/es/primary-care-access",
  { spanish: true, image: programSocialImage },
);

function spanishSchema() {
  const schema = healthPageSchema(title, "/es/primary-care-access");
  return { ...schema, "@graph": schema["@graph"].map((node, index) => (index === 0 ? { ...node, inLanguage: "es-US" } : node)) };
}

export default function SpanishProgramPage() {
  return <><ApprovedHealthPage pathname="/es/primary-care-access" spanish /><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(spanishSchema()) }} /></>;
}
