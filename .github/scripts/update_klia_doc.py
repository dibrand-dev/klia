"""
Genera y actualiza el documento Google Docs "KLIA — Módulos y Estado"
con información completa de la plataforma para uso de agentes de IA
de ventas y marketing.
"""
import os
import json
import re
import datetime

from google.oauth2 import service_account
from googleapiclient.discovery import build


def get_service():
    creds_json = json.loads(os.environ['GOOGLE_SERVICE_ACCOUNT_JSON'])
    credentials = service_account.Credentials.from_service_account_info(
        creds_json,
        scopes=['https://www.googleapis.com/auth/documents'],
    )
    return build('docs', 'v1', credentials=credentials)


def clear_doc(service, doc_id):
    doc = service.documents().get(documentId=doc_id).execute()
    content = doc.get('body', {}).get('content', [])
    if len(content) <= 1:
        return
    end_index = content[-1].get('endIndex', 1) - 1
    if end_index > 1:
        service.documents().batchUpdate(
            documentId=doc_id,
            body={'requests': [{'deleteContentRange': {'range': {'startIndex': 1, 'endIndex': end_index}}}]},
        ).execute()


def insert_text(service, doc_id, text):
    service.documents().batchUpdate(
        documentId=doc_id,
        body={'requests': [{'insertText': {'location': {'index': 1}, 'text': text}}]},
    ).execute()


def generate_content():
    tz_arg = datetime.timezone(datetime.timedelta(hours=-3))
    fecha = datetime.datetime.now(tz_arg).strftime('%d/%m/%Y %H:%M')

    return f"""KLIA — Base de conocimiento completa para agentes de IA
Documento actualizado automáticamente: {fecha} (hora Argentina)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

INSTRUCCIONES PARA EL AGENTE DE IA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Este documento es tu fuente de verdad sobre KLIA. Úsalo para:
  → Responder preguntas de prospectos sobre funcionalidades y precios
  → Identificar qué plan le conviene a cada profesional según su perfil
  → Resolver objeciones con argumentos concretos y personalizados
  → Generar contenido de marketing (posts, emails, mensajes de WhatsApp)
  → Redactar propuestas y comparativas con la competencia

Tono recomendado: cercano, profesional, en español rioplatense (vos/ustedes).
Nunca inventes funcionalidades que no estén en este documento.
Siempre invitá a la prueba gratuita de 21 días como primer paso.
Cuando el prospecto tenga muchos pacientes o cobre a obras sociales, empujá el plan Profesional.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. RESUMEN EJECUTIVO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

KLIA es un software de gestión de consultorio diseñado exclusivamente para profesionales de la salud en Argentina. Digitaliza y automatiza todo el ciclo administrativo del consultorio: desde agendar turnos hasta cobrar, facturar a obras sociales y generar notas clínicas con inteligencia artificial.

DATOS CLAVE
  · Web app, corre en cualquier dispositivo con navegador (no requiere instalación)
  · Producción: https://app.klia.com.ar
  · Landing: https://www.klia.com.ar
  · Período de prueba: 21 días completos, sin tarjeta de crédito, acceso total
  · Pago: Mercado Pago (suscripción mensual o anual con débito automático)
  · Cumplimiento legal: Ley 26.529 de derechos del paciente
  · Soporte: hola@klia.com.ar, respuesta en español
  · Usuarios principales: psicólogos, psiquiatras, médicos, kinesiólogos, nutricionistas

PROPUESTA DE VALOR EN UNA LÍNEA
"KLIA te libera de la administración del consultorio para que te concentres en tus pacientes."


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2. PLANES Y PRECIOS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Todos los precios en pesos argentinos (ARS), incluyen IVA.
Modalidad anual: se pagan 10 meses, se usan 12 (ahorro de 2 meses).

┌─────────────────────────────────────────────────────────────────┐
│ ESENCIAL — $15.000/mes  |  $13.750/mes anual                    │
│ Para: el profesional que recién empieza a digitalizar           │
│                                                                 │
│ Incluye:                                                        │
│   · Hasta 30 pacientes activos                                  │
│   · Agenda y turnos con recordatorios automáticos por email     │
│   · Historia clínica con editor de texto enriquecido            │
│   · Sincronización con Google Calendar                          │
│   · Facturación manual básica                                   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ PROFESIONAL — $28.000/mes  |  $25.667/mes anual  ★ MÁS POPULAR │
│ Para: el consultorio en crecimiento que quiere automatizar      │
│                                                                 │
│ Todo lo de Esencial, más:                                       │
│   · Pacientes ilimitados                                        │
│   · Módulo completo de cobros y deuda                           │
│   · Aviso automático de deuda a pacientes por email             │
│   · IA para resúmenes automáticos de sesión (Gemini)            │
│   · Grabación y transcripción de voz a texto                    │
│   · Facturación a obras sociales (IOMA, Hospital Italiano)      │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ PREMIUM — $42.000/mes  |  $38.500/mes anual                     │
│ Para: centros de salud y profesionales con altas exigencias     │
│                                                                 │
│ Todo lo de Profesional, más:                                    │
│   · Archivos de pacientes en Google Drive integrado             │
│   · Link público para que los pacientes reserven turnos online  │
│   · Informes clínicos con IA exportables                        │
│   · Soporte prioritario                                         │
└─────────────────────────────────────────────────────────────────┘

CÓMO ELEGIR EL PLAN (guía para el agente)
  · El prospecto tiene menos de 30 pacientes y nunca usó software → Esencial
  · Cobra a obras sociales O tiene más de 30 pacientes → Profesional (mínimo)
  · Centro con varios profesionales O necesita archivos/reportes → Premium
  · En duda entre Esencial y Profesional → recomendar Profesional, el salto de precio
    equivale a menos de 1 hora de consulta y tiene funciones que se pagan solas


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3. MÓDULOS — DETALLE COMPLETO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MÓDULO: AGENDA Y TURNOS
Disponible en: todos los planes
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

QUÉ HACE
Vista semanal del consultorio con arrastre y redimensionado de turnos. Soporte para múltiples franjas horarias por día (por ejemplo mañana y tarde con corte al mediodía). Turnos únicos y recurrentes (series automáticas semanales, quincenales, mensuales). Recordatorio automático por email al paciente 24 hs antes. Registro de inasistencias con opción de cobrar la sesión igual. Bonificación automática de feriados nacionales y provinciales configurables.

PROBLEMA QUE RESUELVE
El profesional pierde tiempo coordinando turnos por WhatsApp, se olvida de recordar a pacientes y no tiene registro claro de quién faltó.

ANTES (sin KLIA)
Anotador de papel, agenda de papel o Google Calendar básico. Manda mensajes por WhatsApp manualmente a cada paciente para confirmar. Se olvida de anotar inasistencias. No sabe quién debe la sesión porque faltó.

DESPUÉS (con KLIA)
Todos los turnos en un solo lugar. El sistema manda el recordatorio solo. El profesional solo registra si el paciente asistió o no. Las inasistencias quedan registradas y pueden cobrarse.

PREGUNTAS QUE HACE EL AGENTE AL PROSPECTO
  · "¿Hoy cómo manejás tu agenda? ¿Papel, Google Calendar, WhatsApp?"
  · "¿Te pasa que los pacientes olvidan los turnos y no avisan?"
  · "¿Tenés pacientes que faltan seguido y no sabés cómo manejarlo?"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MÓDULO: PACIENTES E HISTORIA CLÍNICA
Disponible en: todos los planes
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

QUÉ HACE
Ficha completa de cada paciente: nombre, datos personales, obra social asignada, honorarios por sesión, moneda de cobro (ARS / USD / EUR). Historia clínica con notas de sesión en editor de texto enriquecido (negrita, listas, párrafos). Firma digital del paciente capturada directamente en la app. Vista organizada en pestañas: Resumen, Atenciones, Historial, Facturación, Archivos. Búsqueda rápida de pacientes.

PROBLEMA QUE RESUELVE
Las notas clínicas están en libretas físicas, archivos de Word desorganizados o la memoria del profesional. No hay registro ordenado, es difícil revisar el historial en la sesión siguiente.

ANTES (sin KLIA)
Libreta de notas o Word. Para revisar la sesión anterior hay que buscar entre papeles o archivos. No hay firma digital del consentimiento del paciente.

DESPUÉS (con KLIA)
Toda la información del paciente en un click. Antes de cada sesión se puede leer el resumen de la última atención. Las notas quedan guardadas automáticamente. La firma digital queda registrada con fecha.

MULTIMONEDA
Muchos profesionales, especialmente psicólogos, cobran en dólares a ciertos pacientes. KLIA permite configurar la moneda por paciente (ARS, USD, EUR) y lleva el registro correctamente.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MÓDULO: COBROS Y GESTIÓN DE DEUDA
Disponible en: Profesional, Premium, Bonificado
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

QUÉ HACE
Panel centralizado de deuda por paciente. Muestra sesiones impagas organizadas por mes, con montos. Registro de pagos por sesión individual, por mes completo o como "pago a cuenta" que el sistema distribuye automáticamente desde la sesión más antigua. Registro del medio de pago (efectivo, transferencia, Mercado Pago, etc.). Historial completo de cobros.

PROBLEMA QUE RESUELVE
El profesional no sabe exactamente cuánto le deben, qué sesiones están pagas y cuáles no. Llevar ese registro en planillas de Excel es tedioso y propenso a errores.

ANTES (sin KLIA)
Planilla de Excel manual, o simplemente "de memoria". El profesional no siempre sabe si un pago fue por el mes de marzo o abril. Perder rastro de deuda es perder dinero.

DESPUÉS (con KLIA)
Un click para ver el estado de deuda de cada paciente. Cuando el paciente paga un monto redondo, KLIA distribuye el dinero automáticamente desde la sesión más antigua. No hay confusión sobre qué está pago y qué no.

DATO IMPORTANTE PARA VENTAS
Este módulo solo (cobros + aviso de deuda) suele pagar el upgrade de Esencial a Profesional en el primer mes. Un profesional con 20 pacientes que recupera 2 sesiones impagas que se le pasaron ya recuperó el costo del plan.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MÓDULO: AVISO AUTOMÁTICO DE DEUDA
Disponible en: Profesional, Premium, Bonificado
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

QUÉ HACE
KLIA envía un email automático diario a cada paciente que tiene sesiones impagas, listando detalladamente qué debe y por qué monto. El profesional activa o desactiva esta función desde Ajustes. El sistema garantiza que no se envíe más de un aviso por día por paciente.

PROBLEMA QUE RESUELVE
Cobrar es incómodo. Muchos profesionales de la salud sienten que reclamar pagos interfiere con el vínculo terapéutico o simplemente les da vergüenza. Resultado: deuda acumulada que nunca se cobra.

ANTES (sin KLIA)
El profesional tiene que recordar manualmente quién debe y animarse a decírselo en la sesión. Muchos simplemente no lo hacen.

DESPUÉS (con KLIA)
El sistema manda el aviso solo, de forma natural y profesional. El profesional no tiene que hacer nada. El paciente recibe un email claro con el detalle. La deuda se reduce sin conversaciones incómodas.

DIFERENCIADOR CLAVE
Este módulo NO existe en los competidores locales. Es una funcionalidad única de KLIA en el mercado argentino.

PREGUNTA DISPARADORA PARA EL AGENTE
"¿Te pasa que tenés pacientes que adeudan sesiones y te cuesta pedirles que paguen?"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MÓDULO: FACTURACIÓN A OBRAS SOCIALES
Disponible en: Profesional, Premium, Bonificado
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

QUÉ HACE
Generación de planillas para obras sociales en PDF listas para presentar. Soporta: Hospital Italiano (planilla oficial), IOMA (planilla oficial), y un motor genérico configurable para cualquier otra OS. El profesional selecciona los pacientes y sesiones del mes, declara los datos requeridos por la obra social, y genera el PDF con su firma y sello escaneados integrados. El historial de planillas generadas queda guardado.

PROBLEMA QUE RESUELVE
Completar las planillas de obras sociales es un proceso tedioso, repetitivo y propenso a errores. Los profesionales pierden horas cada mes haciéndolo a mano en Word o Excel.

ANTES (sin KLIA)
El profesional completa la planilla en Word o Excel mes a mes, buscando sus datos, los de cada paciente y las sesiones realizadas. Errores frecuentes. Muchas veces delega a un administrativo o contador.

DESPUÉS (con KLIA)
KLIA ya tiene todos los datos del paciente y sus sesiones del mes. El profesional solo revisa, ajusta si hace falta y genera el PDF. El proceso que llevaba 2-3 horas se reduce a 15-20 minutos.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MÓDULO: IA PARA RESÚMENES DE SESIÓN
Disponible en: Profesional, Premium, Bonificado
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

QUÉ HACE
El profesional escribe sus notas de sesión (o las dicta por voz). KLIA usa Google Gemini AI para generar automáticamente un resumen estructurado de la sesión, que queda guardado en la historia clínica junto a las notas originales.

PROBLEMA QUE RESUELVE
Documentar cada sesión clínica lleva tiempo. El profesional tiene que redactar un resumen coherente después de atender varios pacientes, muchas veces con cansancio acumulado. La documentación queda incompleta o se deja para después y nunca se hace.

ANTES (sin KLIA)
Notas sueltas, abreviaciones que solo entiende el propio profesional. O directamente no hay registro escrito.

DESPUÉS (con KLIA)
El profesional anota lo que quiere durante la sesión, sin preocuparse por la forma. La IA genera el resumen ordenado. La historia clínica queda completa y legible.

DIFERENCIADOR
No es necesario copiar y pegar nada en ChatGPT ni en otra herramienta. La IA está integrada directamente en el flujo de trabajo, dentro de la ficha del paciente.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MÓDULO: NOTA DE VOZ (TRANSCRIPCIÓN)
Disponible en: Profesional, Premium, Bonificado
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

QUÉ HACE
El profesional puede grabar audio directamente desde la historia clínica del paciente. KLIA transcribe automáticamente el audio a texto usando Orchard AI (tecnología Whisper large-v3-turbo, el estado del arte en transcripción). El texto transcripto queda disponible como nota de sesión para editar y complementar.

PROBLEMA QUE RESUELVE
Algunos profesionales prefieren hablar que escribir. Dictar es más rápido y natural, pero después hay que transcribir manualmente.

CASO DE USO TÍPICO
El psicólogo o médico, durante o después de la sesión, graba un audio de 2-3 minutos describiendo lo que pasó. KLIA lo convierte en texto en segundos. El profesional lo revisa y guarda.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MÓDULO: ARCHIVOS DEL PACIENTE (GOOGLE DRIVE)
Disponible en: Premium, Bonificado
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

QUÉ HACE
El profesional puede subir y organizar archivos de cada paciente directamente desde KLIA. Los archivos se almacenan en la carpeta de Google Drive del propio profesional (no en servidores de KLIA), organizados automáticamente por categoría: Laboratorio, Imágenes, Documentos, Otros. Acceso directo desde la ficha del paciente.

PROBLEMA QUE RESUELVE
Los estudios, resultados de laboratorio y documentos de los pacientes están dispersos: algunos en email, otros en carpetas del escritorio, otros en WhatsApp. Encontrar el resultado de laboratorio de un paciente antes de la consulta lleva minutos.

DESPUÉS (con KLIA)
Todo en un lugar. El profesional sube el PDF del estudio, y la próxima vez que abre la ficha del paciente lo encuentra en segundos, organizado por categoría.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MÓDULO: BOOKING PÚBLICO (RESERVAS ONLINE)
Disponible en: Premium, Bonificado
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

QUÉ HACE
KLIA genera un link público personalizado (por ejemplo: klia.com.ar/turno/dr-garcia) que el profesional puede compartir. Los pacientes ingresan, ven la disponibilidad del profesional y reservan el turno sin intermediarios, sin WhatsApp y sin llamadas. El profesional configura la disponibilidad horaria, duración de sesión y anticipación mínima para reservar.

PROBLEMA QUE RESUELVE
Coordinar turnos por WhatsApp consume tiempo de ambas partes. "¿Tenés el martes a las 10?" "No, pero tengo el miércoles a las 11." "Ese no me viene."

DESPUÉS (con KLIA)
El profesional comparte el link. El paciente ve la disponibilidad real y elige solo. El turno aparece en la agenda de KLIA automáticamente.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MÓDULO: SINCRONIZACIÓN GOOGLE CALENDAR
Disponible en: todos los planes
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

QUÉ HACE
Conexión OAuth con la cuenta personal de Google Calendar del profesional. Los turnos creados en KLIA aparecen en Google Calendar automáticamente y viceversa. Sincronización bidireccional en tiempo real.

CASO DE USO
El profesional ya usa Google Calendar para su vida personal y no quiere abandonarlo. Con KLIA, los turnos del consultorio aparecen en su calendario junto con sus compromisos personales, sin doble carga de datos.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4. TABLA RESUMEN: MÓDULOS POR PLAN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

MÓDULO                        ESENCIAL   PROFESIONAL   PREMIUM
─────────────────────────────────────────────────────────────────
Agenda y turnos                  ✓            ✓            ✓
Recordatorios por email          ✓            ✓            ✓
Pacientes e historia clínica     ✓            ✓            ✓
Google Calendar sync             ✓            ✓            ✓
Cobros y gestión de deuda        ✗            ✓            ✓
Aviso automático de deuda        ✗            ✓            ✓
Facturación a obras sociales     ✗            ✓            ✓
IA resúmenes de sesión           ✗            ✓            ✓
Nota de voz / transcripción      ✗            ✓            ✓
Archivos paciente (Drive)        ✗            ✗            ✓
Booking público online           ✗            ✗            ✓
Informes IA exportables          ✗            ✗            ✓
Soporte prioritario              ✗            ✗            ✓
Pacientes activos            hasta 30     ilimitados   ilimitados


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
5. PÚBLICO OBJETIVO — PERFILES DETALLADOS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PERFIL A — El terapeuta en crecimiento (mayor volumen)
  Especialidades: psicólogos, psiquiatras, terapistas, fonoaudiólogos
  Situación: 20-60 pacientes, consulta propia o alquilada, cobra mayormente en ARS y/o USD
  Dolores principales: gestión de deuda incómoda, notas clínicas desorganizadas, coordinación de turnos por WhatsApp
  Plan recomendado: Profesional
  Argumento clave: "El aviso automático de deuda solo ya vale el plan. Y la IA te ahorra 10-15 minutos de notas por sesión."

PERFIL B — El médico/especialista con obras sociales
  Especialidades: médicos clínicos, kinesiólogos, nutricionistas, odontólogos
  Situación: 15-50 pacientes, factura a IOMA u Hospital Italiano, usa el término "consulta" no "sesión"
  Dolores principales: planillas de obras sociales manuales, tiempo perdido en administración
  Plan recomendado: Profesional
  Argumento clave: "La planilla de IOMA que te lleva 3 horas hacerla en Word, en KLIA la generás en 20 minutos. Tus datos y los de los pacientes ya están cargados."

PERFIL C — El profesional que recién empieza
  Situación: menos de 20 pacientes, primera herramienta digital, presupuesto ajustado
  Dolores principales: no sabe por dónde empezar, le da miedo la tecnología
  Plan recomendado: Esencial, con vista a crecer a Profesional
  Argumento clave: "21 días gratis sin poner tarjeta. Si no te convence, no perdiste nada. Y si te convencés, el plan Esencial cuesta menos que una hora de tu consulta."

PERFIL D — El centro de salud o clínica
  Situación: 2-5 profesionales, gestión centralizada, necesitan reportes y archivos
  Dolores principales: falta de visibilidad sobre el trabajo de cada profesional, archivos dispersos
  Plan recomendado: Premium
  Argumento clave: "Un plan Premium por profesional. Cada uno ve solo sus pacientes, pero la administración tiene visibilidad centralizada."

ESPECIALIDADES QUE USA KLIA
  · Psicólogos y psiquiatras ← mayor base de usuarios actual
  · Médicos clínicos y especialistas
  · Kinesiólogos y fisioterapeutas
  · Nutricionistas y dietistas
  · Odontólogos
  · Fonoaudiólogos
  · Terapistas ocupacionales
  · Trabajadores sociales


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
6. DIFERENCIADORES VS COMPETENCIA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

KLIA vs otras soluciones del mercado:

✓ AVISO AUTOMÁTICO DE DEUDA — único en el mercado local
  Ningún competidor argentino tiene esta función. Los otros software te muestran quién debe, pero no hacen nada al respecto.

✓ IA NATIVA INTEGRADA — sin fricciones
  No necesitás abrir ChatGPT y copiar texto. La IA está dentro del flujo de trabajo.

✓ TERMINOLOGÍA ADAPTABLE
  KLIA detecta si sos terapeuta o médico y adapta el lenguaje: "sesión" para terapeutas, "consulta" para médicos. Los competidores usan un solo término para todos.

✓ MULTI-MONEDA POR PACIENTE
  Podés tener un paciente en ARS y otro en USD en la misma agenda. Ideal para profesionales que cobran en dólares.

✓ GOOGLE CALENDAR BIDIRECCIONAL
  La sincronización funciona en los dos sentidos. Si agendás algo en Google Calendar, aparece en KLIA.

✓ DATOS EN ARGENTINA
  Todos los datos se alojan en Argentina, cumpliendo la Ley 26.529. Algunos competidores usan servidores en el exterior.

✓ 21 DÍAS SIN TARJETA
  La mayoría de los competidores piden tarjeta para la prueba gratuita o solo dan 7-14 días.

✓ SIN CONTRATOS
  Cancelación en cualquier momento, sin permanencia mínima.

COMPETIDORES PRINCIPALES (cómo posicionarse)
  · Agenda Pro / sistemas heredados: más complejos, más caros, no tienen IA ni aviso de deuda
  · Google Calendar solo: no tiene historia clínica, cobros, ni facturación a OS
  · Excel/papel: sin automatización, propenso a errores, no escala
  · WhatsApp + Word: lo más común, el mayor dolor sin resolver → ahí entra KLIA


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
7. OBJECIONES Y RESPUESTAS COMPLETAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

OBJECIÓN: "Ya uso Google Calendar"
RESPUESTA: Google Calendar solo maneja turnos. KLIA agrega todo lo demás: historia clínica, cobros, facturación a obras sociales y recordatorios automáticos al paciente. Y además KLIA se sincroniza con tu Google Calendar, así que no perdés esa herramienta que ya usás.

OBJECIÓN: "Es muy caro"
RESPUESTA: El plan Esencial cuesta menos que una hora de consulta. El Profesional, menos que dos. El tiempo que ahorrás en administración, notas y cobros se recupera en el primer mes. Un solo paciente que pagó una sesión atrasada gracias al aviso de deuda ya cubrió el costo del plan.

OBJECIÓN: "No soy de tecnología / me da miedo"
RESPUESTA: Tenés 21 días gratis para probarlo sin presión, sin poner tarjeta. Soporte por email desde el día 1. Está diseñado para que cualquier profesional lo pueda usar sin capacitación previa. Si en 21 días no te convencés, simplemente no lo contratás.

OBJECIÓN: "¿Y si mis datos quedan expuestos?"
RESPUESTA: Todos los datos están alojados en servidores en Argentina, cumplimos la Ley 26.529 de derechos del paciente. No compartimos datos con terceros. El acceso está protegido con autenticación segura.

OBJECIÓN: "¿Qué pasa si quiero irme?"
RESPUESTA: Cancelás cuando querés, sin trámites. Podés exportar toda tu información antes de salir.

OBJECIÓN: "Quiero pensarlo / no es el momento"
RESPUESTA: Entiendo. ¿Querés que te mande el link para probarlo gratis los 21 días? No te compromete a nada y lo podés empezar cuando tengas un rato. Así ya lo tenés disponible cuando estés lista/o.

OBJECIÓN: "Ya uso otro software"
RESPUESTA: ¿Cuál usás? [Escuchá la respuesta.] ¿Tiene aviso automático de deuda? ¿Tiene IA para notas de sesión? Muchos profesionales migran a KLIA justamente por esas dos funciones. La prueba gratuita no tiene costo, podés comparar directamente.

OBJECIÓN: "No tengo tiempo para aprenderlo"
RESPUESTA: La mayoría de los usuarios están funcionando en menos de una hora. La agenda y la carga de pacientes son intuitivas. Y si tenés una duda puntual, estamos por email.

OBJECIÓN: "¿Lo usan muchos profesionales?" (prueba social)
RESPUESTA: Tenemos usuarios en todo el país, principalmente psicólogos, psiquiatras y médicos. Es el software de gestión de consultorio con más funciones de IA del mercado argentino.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
8. PROCESO DE ONBOARDING Y PRIMEROS PASOS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CÓMO EMPIEZA UN NUEVO USUARIO
1. Registro en https://www.klia.com.ar → email + contraseña
2. Confirmación por email (link en el mail)
3. Acceso inmediato a la plataforma completa por 21 días
4. Primer paso sugerido: cargar la disponibilidad horaria y el primer paciente
5. El sistema guía con un flujo de bienvenida paso a paso

QUÉ PUEDE HACER EN LOS 21 DÍAS DE PRUEBA
  · Todo. No hay funcionalidades bloqueadas durante la prueba.
  · Cargar todos sus pacientes
  · Crear turnos y ver la agenda
  · Probar el aviso de deuda
  · Generar una planilla de obra social
  · Usar la IA para notas de sesión

AL TERMINAR LA PRUEBA
  · El sistema avisa con anticipación que el período de prueba termina
  · Si el usuario elige un plan, paga vía Mercado Pago y sigue sin interrupciones
  · Si no elige plan, la cuenta queda bloqueada pero los datos se conservan

PAGO
  · Solo Mercado Pago (débito automático mensual o anual)
  · No requiere tarjeta de crédito para la prueba
  · Suscripción: se puede cancelar en cualquier momento desde la configuración


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
9. SCRIPTS DE CONVERSACIÓN PARA EL AGENTE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

APERTURA (primer contacto)
"Hola [nombre], te escribo de KLIA, un software para gestionar tu consultorio. ¿Hoy cómo manejás tu agenda y la historia clínica de tus pacientes?"

PREGUNTAS DE DIAGNÓSTICO (para identificar el plan)
  1. "¿Cuántos pacientes atenés por semana aproximadamente?"
  2. "¿Facturás a alguna obra social (IOMA, Hospital Italiano, u otra)?"
  3. "¿Tenés alguna dificultad para cobrar a tiempo o recordar qué debe cada paciente?"
  4. "¿Usás algún software hoy o todo es manual / WhatsApp / Excel?"
  5. "¿Necesitás guardar estudios, imágenes u otros archivos de tus pacientes?"

SEGÚN LAS RESPUESTAS, RECOMENDÁ ASÍ:
  · Pocas OS + pocos pacientes → Esencial con vista a Profesional
  · Factura a OS o +30 pacientes → Profesional directamente
  · Varios profesionales o necesita archivos → Premium

PROPUESTA (cierre hacia la prueba)
"Te propongo que lo pruebes gratis durante 21 días, sin poner tarjeta. En ese tiempo podés cargarlo con tus pacientes reales y ver si te sirve. ¿Te mando el link para registrarte?"

SEGUIMIENTO (si no respondió)
"Hola [nombre], ¿pudiste entrar a KLIA? Cualquier consulta que tengas te respondo por acá."

RECUPERO (si empezó la prueba pero no convirtió)
"Hola [nombre], vi que probaste KLIA. ¿Hubo alguna función que no encontraste o algo que no funcionó como esperabas? Me interesa mucho tu feedback."


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
10. INFORMACIÓN DE CONTACTO Y RECURSOS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  App: https://app.klia.com.ar
  Landing: https://www.klia.com.ar
  Soporte: hola@klia.com.ar
  Registro prueba gratuita: https://www.klia.com.ar (botón "Empezar gratis")


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Este documento se actualiza automáticamente cada noche a las 21hs Argentina.
Fuente: repositorio dibrand-dev/klia (rama main)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""


def get_sa_email():
    try:
        return json.loads(os.environ['GOOGLE_SERVICE_ACCOUNT_JSON']).get('client_email', '(desconocido)')
    except Exception:
        return '(no se pudo leer)'


def main():
    doc_id = os.environ.get('GOOGLE_DOC_ID', '(no definido)')
    sa_email = get_sa_email()
    print(f"Service Account: {sa_email}")
    print(f"Documento destino (GOOGLE_DOC_ID): {doc_id}")

    try:
        service = get_service()

        print("Limpiando documento…")
        clear_doc(service, doc_id)

        print("Generando contenido…")
        content = generate_content()

        print(f"Escribiendo {len(content)} caracteres en Google Doc…")
        insert_text(service, doc_id, content)

        print("✓ Google Doc actualizado correctamente")
    except Exception as e:
        msg = str(e)
        print("✗ ERROR al actualizar el Google Doc:")
        print(msg)
        if '403' in msg or 'permission' in msg.lower() or 'PERMISSION_DENIED' in msg:
            print("")
            print("CAUSA PROBABLE: el documento no esta compartido con el Service Account.")
            print(f"SOLUCION: abri el Doc -> Compartir -> agrega como Editor el email:")
            print(f"   {sa_email}")
            print("Ademas verifica que la 'Google Docs API' este habilitada en el proyecto de Cloud Console.")
        elif '404' in msg or 'not found' in msg.lower():
            print("")
            print("CAUSA PROBABLE: el GOOGLE_DOC_ID es incorrecto o el Doc no existe / no es accesible.")
        raise


if __name__ == '__main__':
    main()
