
import { LegalPage } from "../../components/LegalPage";
import { healthMetadata } from "../../lib/health-metadata";

export const metadata = healthMetadata(
  "Condiciones de uso",
  "Condiciones que se aplican al sitio web público de SozoRock Health y a sus servicios digitales públicos.",
  "/es/terms",
  { spanish: true },
);

export default function SpanishTermsPage() {
  return (
    <LegalPage spanish path="/es/terms" eyebrow="Política pública" title="Condiciones de uso" updated="7 de septiembre de 2026">
      <h2>Acerca de estas condiciones</h2>
      <p>
        Estas condiciones se aplican al sitio web público de SozoRock Health y a
        los servicios digitales públicos relacionados que opera The SozoRock
        Foundation, Inc. Al usarlos, usted acepta hacerlo de manera legal y de
        acuerdo con estas condiciones. Si no está de acuerdo, no use el
        servicio.
      </p>
      <h2>Propósito no clínico</h2>
      <p>
        SozoRock Health desarrolla modelos de acceso comunitario, análisis
        basados en el lugar, preparación digital y capacidad de la fuerza
        laboral. No es una clínica, un proveedor de atención médica ni una
        plataforma de telesalud. No diagnostica, no evalúa síntomas, no
        recomienda tratamientos, no receta medicamentos y no crea una relación
        entre proveedor y paciente.
      </p>
      <h2>Emergencias</h2>
      <p>
        No use este sitio web ni Voice Access en una emergencia ni para decidir
        si una situación es urgente. Llame al 911 o al servicio de emergencias
        local que corresponda cuando necesite ayuda inmediata.
      </p>
      <h2>Servicios a cargo de proveedores</h2>
      <p>
        Los proveedores con licencia y las organizaciones de atención médica
        conservan la responsabilidad de sus sistemas clínicos, expedientes,
        cumplimiento normativo, criterio profesional, herramientas de telesalud,
        decisiones de elegibilidad y atención al paciente. Un enlace, una
        mención o una vía de acceso no constituye un respaldo, no garantiza la
        disponibilidad ni confirma que un servicio sea adecuado para una persona
        en particular.
      </p>
      <h2>Publicaciones e información para la planificación</h2>
      <p>
        Las publicaciones y los datos geográficos apoyan la educación, la
        investigación y las decisiones institucionales. No constituyen
        asesoramiento médico, legal, financiero ni regulatorio. La cobertura de
        los datos, la disponibilidad de servicios, la preparación local y los
        detalles de los programas pueden cambiar. Confirme las decisiones
        importantes con la institución responsable o con un profesional
        calificado.
      </p>
      <h2>Uso responsable</h2>
      <p>
        No eluda los controles de seguridad; no envíe contenido ilegal, dañino o
        engañoso; no se haga pasar por otra persona; no pruebe el servicio sin
        autorización; no lo sobrecargue; y no use herramientas automatizadas de
        una manera que afecte su disponibilidad o el acceso de otras personas.
        Podemos restringir el acceso cuando sea razonablemente necesario para
        proteger a las personas, la información o el servicio.
      </p>
      <h2>Propiedad intelectual</h2>
      <p>
        El contenido del sitio web, las publicaciones, los gráficos, el software
        y las marcas están protegidos por las leyes de propiedad intelectual
        aplicables, salvo que un elemento específico indique lo contrario.
        Acceder a una publicación no transfiere su propiedad ni da permiso para
        eliminar avisos, volver a publicar la obra o usar una marca. Para usar un
        nombre o una marca se necesita el permiso de su titular.
      </p>
      <h2>Enlaces externos y disponibilidad</h2>
      <p>
        Los enlaces externos se ofrecen por conveniencia y no ponen el servicio
        enlazado bajo nuestro control. Podemos actualizar, suspender o
        discontinuar funciones del sitio web, y no garantizamos que esté
        disponible sin interrupciones ni errores.
      </p>
      <h2>Cambios</h2>
      <p>
        Podemos revisar estas condiciones cuando cambien el sitio web o los
        requisitos aplicables. La fecha indicada arriba identifica la versión
        vigente. Si sigue usando el sitio después de una revisión, las
        condiciones revisadas se aplican a ese uso posterior.
      </p>
    </LegalPage>
  );
}
