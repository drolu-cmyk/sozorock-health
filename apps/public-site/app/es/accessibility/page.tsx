export const dynamic = "force-static";
export const revalidate = 3600;

import { LegalPage } from "../../components/LegalPage";
import { healthMetadata } from "../../lib/health-metadata";

export const metadata = healthMetadata(
  "Declaración de accesibilidad",
  "El compromiso de SozoRock Health con la accesibilidad y cómo pedir un formato accesible o informar de una barrera.",
  "/es/accessibility",
  { spanish: true },
);

export default function SpanishAccessibilityPage() {
  return (
    <LegalPage spanish path="/es/accessibility" eyebrow="Nuestro compromiso" title="Accesibilidad" updated="7 de septiembre de 2026">
      <h2>Nuestro objetivo de accesibilidad</h2>
      <p>
        SozoRock Health trabaja para cumplir las Pautas de Accesibilidad para el
        Contenido Web (WCAG) 2.2, nivel AA, en sus servicios digitales públicos.
        La accesibilidad forma parte del diseño, la redacción, el desarrollo,
        las pruebas y el mantenimiento continuo.
      </p>
      <h2>Cómo usar este sitio web</h2>
      <p>
        El sitio web público está diseñado para usarse con el teclado, con un
        indicador de foco visible, encabezados y etiquetas claros, texto que se
        puede ampliar, contenido que se adapta a la pantalla y respeto por la
        preferencia de reducir el movimiento. Los formularios señalan los
        errores y ofrecen otra forma de contacto.
      </p>
      <h2>La voz es una opción</h2>
      <p>
        Cuando haya funciones de voz, usar el micrófono requiere su elección y
        el aviso correspondiente. No necesita usar la voz para leer la
        información principal, comunicarse con la organización ni pedir una
        adaptación.
      </p>
      <h2>Límites conocidos y mejora continua</h2>
      <p>
        Algunos servicios de terceros, documentos enlazados, mapas o archivos de
        publicaciones anteriores tal vez aún no ofrezcan el mismo nivel de
        accesibilidad que el sitio web principal. Usamos revisiones automáticas
        y revisiones manuales con teclado y en distintos tamaños de pantalla.
        Estas revisiones no garantizan la compatibilidad total con todos los
        navegadores o tecnologías de apoyo. Damos prioridad a las barreras que
        impiden entender la información o completar una tarea.
      </p>
      <h2>Pida un formato accesible o informe de una barrera</h2>
      <p>
        Escriba a{" "}
        <a href="mailto:contact@sozorockfoundation.org">contact@sozorockfoundation.org</a>
        . Indique la página o el documento, la tarea que intentaba completar, la
        barrera que encontró y el formato accesible o la adaptación que le
        ayudaría. Los datos sobre su dispositivo y su tecnología de apoyo son
        útiles, pero opcionales. Confirmaremos que recibimos la solicitud y
        trabajaremos para dar una respuesta razonable.
      </p>
      <h2>Inquietudes formales</h2>
      <p>
        Si una inquietud sobre accesibilidad no se resuelve por el medio de
        contacto indicado arriba, responda en el mismo hilo de correo y pida que
        la revise The SozoRock Foundation, Inc. Las solicitudes de accesibilidad
        no requieren revelar un diagnóstico ni información médica.
      </p>
    </LegalPage>
  );
}
