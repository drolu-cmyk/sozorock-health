
import { LegalPage } from "../../components/LegalPage";
import { healthMetadata } from "../../lib/health-metadata";

export const metadata = healthMetadata(
  "Aviso de no discriminación",
  "El compromiso de The SozoRock Foundation con la igualdad de acceso, las adaptaciones razonables y cómo informar de una inquietud.",
  "/es/nondiscrimination",
  { spanish: true },
);

export default function SpanishNondiscriminationPage() {
  return (
    <LegalPage spanish path="/es/nondiscrimination" title="Aviso de no discriminación" titleSize="compact" updated="7 de septiembre de 2026">
      <h2>Igualdad de acceso y participación respetuosa</h2>
      <p>
        The SozoRock Foundation, Inc. se compromete a ofrecer sus programas,
        actividades y servicios digitales públicos sin discriminación ilegal.
        Las personas de comunidades rurales y desatendidas, y el público en
        general, son bienvenidas.
      </p>
      <h2>Características protegidas</h2>
      <p>
        De acuerdo con la ley aplicable, no discriminamos por raza, color,
        origen nacional, etnia, religión, sexo, embarazo, orientación sexual,
        identidad o expresión de género, edad, discapacidad, información
        genética, condición de veterano o militar, estado civil o familiar, ni
        por ninguna otra característica protegida por la ley.
      </p>
      <h2>Acceso a la comunicación y adaptaciones razonables</h2>
      <p>
        Trabajamos para ofrecer adaptaciones razonables y un acceso real a la
        información pública. Para pedir un formato accesible, apoyo en su idioma
        u otra adaptación, escriba a{" "}
        <a href="mailto:contact@sozorockfoundation.org">contact@sozorockfoundation.org</a>
        . Describa la actividad o la información y el apoyo que necesita. En una
        solicitud general no necesita revelar un diagnóstico.
      </p>
      <h2>Límites clínicos</h2>
      <p>
        SozoRock Health no presta atención clínica. Todo servicio clínico que se
        ofrezca por medio de un proveedor independiente con licencia se rige por
        las obligaciones legales, el ámbito profesional, las reglas de
        elegibilidad y las obligaciones de no discriminación de ese proveedor.
      </p>
      <h2>Informe de una inquietud</h2>
      <p>
        Si cree que sufrió discriminación en un programa o servicio digital
        público de SozoRock Health, escriba a{" "}
        <a href="mailto:contact@sozorockfoundation.org">contact@sozorockfoundation.org</a>
        . Incluya la fecha, el programa o la página involucrados, lo que sucedió
        y una forma segura de comunicarnos con usted. No envíe expedientes
        médicos ni otra información delicada que no sea necesaria. Revisaremos
        la inquietud y responderemos según corresponda.
      </p>
      <h2>Sin represalias</h2>
      <p>
        No permitimos represalias contra ninguna persona por plantear de buena
        fe una inquietud, pedir una adaptación o participar en una revisión.
      </p>
    </LegalPage>
  );
}
