export const dynamic = "force-static";
export const revalidate = 3600;

import { LegalPage } from "../../components/LegalPage";
import { healthMetadata } from "../../lib/health-metadata";

export const metadata = healthMetadata(
  "Aviso de privacidad",
  "Cómo SozoRock Health maneja la información en su sitio web público y en sus servicios no clínicos de preparación.",
  "/es/privacy",
  { spanish: true },
);

export default function SpanishPrivacyPage() {
  return (
    <LegalPage spanish path="/es/privacy" title="Aviso de privacidad" updated="20 de octubre de 2026">
      <h2>Información y opciones</h2>
      <p>
        SozoRock Health es una iniciativa de The SozoRock Foundation, Inc.
        Recopilamos información para responder solicitudes, ofrecer las
        funciones que usted elige, proteger nuestros servicios y entender cómo se
        usa la información pública. Este sitio web no es un lugar para enviar
        expedientes médicos, diagnósticos, números de seguro ni información de
        salud urgente.
      </p>
      <h2>Información que usted decide compartir</h2>
      <p>
        Una solicitud de contacto, colaboración, voluntariado o acceso a una
        publicación puede incluir su nombre, correo electrónico, organización,
        función o sector, ubicación, motivo de interés, mensaje y las opciones de
        consentimiento que aparecen en el formulario. Usamos esta información
        para atender la solicitud, comunicarnos con usted, prevenir el mal uso,
        evaluar la calidad y el alcance del acceso a las publicaciones y
        conservar un registro adecuado de la interacción. Para acceder a una
        publicación, primero debe confirmar el correo electrónico usado en la
        solicitud; después se crea una sesión segura de descarga. Recibir
        novedades sobre futuras publicaciones es opcional y no es una condición
        para acceder a la publicación solicitada.
      </p>
      <h2 id="program-interest">Lista de interés del Programa de Acceso a la Atención Primaria</h2>
      <p>
        Recopilamos nombre y apellido, correo electrónico o número de teléfono
        (o ambos), método de contacto preferido, condado de Nueva York,
        confirmación de que reside en Nueva York y tiene 64 años o menos,
        consentimiento para ser contactado y una respuesta breve y opcional
        sobre cómo supo de nosotros. El personal autorizado de SozoRock usa esta
        información para comunicarse con usted sobre los requisitos y los
        próximos pasos. No incluya datos médicos, de seguro, de ingresos ni
        otros datos personales de salud.
      </p>
      <p>
        La información de la lista de interés se elimina 12 meses después de que
        comience el primer grupo, a menos que usted se inscriba o pida
        permanecer en la lista. Para solicitar la eliminación, use el medio de
        contacto indicado en «Sus opciones», más abajo. La revisión de requisitos
        y la inscripción tendrán su propio aviso y consentimiento.
      </p>
      <h2>Acceso a publicaciones y origen de las visitas</h2>
      <p>
        Para el acceso a publicaciones, también podemos registrar información
        propia y limitada sobre el origen de la visita y su contexto técnico,
        como la página donde comenzó la visita, el sitio web de referencia, los
        parámetros de campaña incluidos en un enlace de SozoRock, el tipo de
        navegador y de sistema operativo, la clase de dispositivo, el idioma de
        la interfaz, la zona horaria y el país o la región aproximados que
        proporciona nuestra red de alojamiento. Su navegador puede guardar un
        identificador aleatorio propio de visitante para medir los intentos de
        acceso repetidos y aplicar controles contra el abuso sin guardar una
        dirección de red sin procesar junto con la solicitud. Podemos asignar
        indicadores de calidad a los registros de acceso según señales como si
        se verificó el correo electrónico, si el texto enviado parece incompleto
        o automatizado, si los campos de ubicación son coherentes entre sí y si
        las solicitudes ocurren con una rapidez o frecuencia inusuales. Estos
        indicadores sirven para revisar la calidad de los datos y proteger el
        servicio; no prueban la identidad de nadie y no se usan para decisiones
        clínicas, de seguro, de empleo, de crédito ni de elegibilidad.
      </p>
      <h2>Resident Access Layer y aplicación móvil</h2>
      <p>
        En un proceso compatible de preparación en un teléfono o una tableta
        compartida, recibimos solo la opción de acceso que usted eligió, un
        código postal o una referencia a un Health Equity Hub, la opción de
        apoyo no clínico que eligió, el idioma de la interfaz, si la solicitud
        vino de la aplicación móvil o del quiosco y el registro de
        consentimiento que se mostró antes del envío. En este proceso no le
        pedimos su nombre, correo electrónico, historial médico, síntomas,
        diagnóstico, información de tratamiento, datos de seguro ni otra
        información de salud protegida. Enviar una solicitud no crea una
        relación con un proveedor, no confirma su elegibilidad y no lo conecta
        con un proveedor con licencia.
      </p>
      <h2>Información del sitio web y de seguridad</h2>
      <p>
        Nuestros servicios de alojamiento y seguridad pueden procesar
        información técnica limitada, como la fecha y la hora de una solicitud,
        el tipo de navegador o dispositivo, la página solicitada, la página de
        referencia, el origen de la campaña y la dirección de red. Usamos esta
        información para operar el sitio web, diagnosticar errores, medir el uso
        general y protegerlo contra el abuso automatizado. Los registros de
        límite de solicitudes y de acceso a publicaciones usan una
        representación irreversible de la dirección de red (un hash con sal)
        cuando se necesita un identificador duradero contra el abuso; la aplicación no guarda la dirección de red
        sin procesar junto con la solicitud de la publicación.
      </p>
      <h2>Voice Access</h2>
      <p>
        El acceso al micrófono comienza solo después de que usted lea el aviso
        de voz y acepte. En el sitio web, OpenAI procesa el audio del micrófono
        durante la sesión en vivo y no clínica de Voice Access. OpenAI indica
        que, de forma predeterminada, los datos de su API no se usan para
        entrenar sus modelos. Según los controles de datos estándar de la API,
        el contenido puede conservarse en registros de supervisión de abusos
        hasta 30 días, de acuerdo con la{" "}
        <a href="https://platform.openai.com/docs/guides/your-data" rel="noreferrer" hrefLang="en">
          política de control de datos de la API de OpenAI
        </a>{" "}
        (en inglés). En la aplicación móvil, el reconocimiento de voz puede usar
        el servicio de voz del dispositivo Apple o Android y puede procesarse
        según los términos de Apple, de Google o del proveedor del dispositivo.
        SozoRock Health no envía a su API de solicitudes de acceso la
        transcripción de voz del dispositivo ni la guarda con una solicitud. No
        comparta expedientes médicos ni información de salud protegida. Puede
        detener una sesión en cualquier momento, y las opciones de texto o de
        toque siguen disponibles. SozoRock Health no graba ni conserva de manera
        intencional el audio sin procesar del micrófono.
      </p>
      <h2>Cómo se comparte la información</h2>
      <p>
        Podemos compartir información con proveedores de servicios que operan o
        protegen el sitio web, envían los correos electrónicos solicitados o
        apoyan una función que usted elige. Solo pueden usar la información para
        prestar esos servicios. También podemos divulgar información cuando la
        ley lo exija, para proteger a las personas o nuestros servicios, o como
        parte de una transacción organizacional permitida por la ley. No
        vendemos información personal ni la usamos para publicidad basada en el
        comportamiento.
      </p>
      <h2>Conservación y seguridad</h2>
      <p>
        Las consultas de contacto se programan para eliminarse después de un
        año, salvo que formen parte de una relación activa o que la ley exija un
        plazo mayor. Las solicitudes de Resident Access Layer y sus registros de
        consentimiento se programan para eliminarse después de 30 días. Sus
        registros temporales para prevenir el abuso usan una representación
        irreversible de la dirección de red (un hash con sal) y vencen por
        separado; la
        dirección de red no se guarda con la solicitud. Las solicitudes de
        acceso a publicaciones, los registros de consentimiento, el contexto de
        origen, los indicadores de calidad y los registros de actividad
        relacionados se programan para eliminarse después de 180 días. Los
        enlaces de verificación vencen a los 30 minutos y las sesiones seguras
        verificadas, a las 12 horas. Usamos medidas administrativas, técnicas y
        organizativas adecuadas para la información, pero ningún servicio de
        internet puede garantizar una seguridad absoluta.
      </p>
      <h2>County-Based Community Access Platform</h2>
      <p>
        CB-CAP es un producto independiente de la Fundación para el análisis de
        sistemas a nivel de condado. Revise su información de privacidad cuando
        use ese producto. No envíe expedientes médicos individuales por un
        formulario de contacto o de publicaciones de Health.
      </p>
      <h2>Menores y servicios externos</h2>
      <p>
        Este sitio web público está dirigido al público general y no está
        diseñado para recopilar información personal directamente de menores de
        13 años. Los enlaces a proveedores, organismos públicos, redes sociales
        y otros servicios externos llevan a sitios con sus propias prácticas de
        privacidad.
      </p>
      <h2>Sus opciones</h2>
      <p>
        Puede pedir acceder, corregir o eliminar la información que envió, o
        retirar una opción de comunicación opcional, sujeto a la verificación de
        su identidad y a obligaciones legales, de seguridad y operativas.
        Escriba a{" "}
        <a href="mailto:contact@sozorockfoundation.org">contact@sozorockfoundation.org</a>{" "}
        y describa su solicitud. Podemos actualizar este aviso a medida que
        cambie el servicio y publicaremos la fecha de la revisión en esta
        página.
      </p>
    </LegalPage>
  );
}
