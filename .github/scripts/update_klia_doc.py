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


def read_claude_md_section(section_title):
    try:
        with open('CLAUDE.md', 'r', encoding='utf-8') as f:
            text = f.read()
        pattern = rf'## {re.escape(section_title)}\n(.*?)(?=\n## |\Z)'
        match = re.search(pattern, text, re.DOTALL)
        return match.group(1).strip() if match else ''
    except Exception:
        return ''


def generate_content():
    tz_arg = datetime.timezone(datetime.timedelta(hours=-3))
    fecha = datetime.datetime.now(tz_arg).strftime('%d/%m/%Y %H:%M')

    planes_access = read_claude_md_section('Plans and access control')
    key_files = read_claude_md_section('Key files')
    key_components = read_claude_md_section('Key components')

    return f"""KLIA — Plataforma de Gestión para Profesionales de la Salud
Documento actualizado automáticamente: {fecha} (hora Argentina)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


RESUMEN EJECUTIVO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

KLIA es un SaaS para profesionales de la salud en Argentina que digitaliza la gestión del consultorio: agenda, historia clínica, cobros, facturación a obras sociales e inteligencia artificial.

Producción: https://app.klia.com.ar
Landing: https://www.klia.com.ar
Período de prueba: 21 días gratuitos, sin tarjeta de crédito
Pago: Mercado Pago (suscripción mensual o anual)
Cumplimiento: Ley 26.529 de derechos del paciente


PLANES Y PRECIOS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Todos los precios en pesos argentinos (ARS), incluyen IVA.

ESENCIAL — $15.000/mes  |  $13.750/mes si paga anual (ahorra 2 meses)
  · Hasta 30 pacientes activos
  · Agenda y turnos con recordatorios por email
  · Historia clínica básica
  · Facturación manual
  · Ideal para: profesional que empieza a digitalizar

PROFESIONAL — $28.000/mes  |  $25.667/mes si paga anual  ★ MÁS POPULAR
  · Pacientes ilimitados
  · Todo lo del plan Esencial
  · Módulo de cobros y deuda
  · Aviso automático de deuda a pacientes
  · IA para resúmenes de sesión (Gemini)
  · Transcripción de voz a texto
  · Facturación a obras sociales (IOMA, Hospital Italiano, genérico)
  · Ideal para: consultorio en crecimiento que quiere automatizar cobros e IA

PREMIUM — $42.000/mes  |  $38.500/mes si paga anual
  · Todo lo del plan Profesional
  · Archivos de pacientes integrados con Google Drive
  · Link público de reserva de turnos online
  · Informes clínicos con IA
  · Soporte prioritario
  · Ideal para: centros con varios profesionales, máxima automatización

BONIFICADO (interno — no público)
  · Acceso a todos los módulos
  · Para uso interno y cuentas especiales


MÓDULOS IMPLEMENTADOS — DETALLE COMPLETO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

AGENDA  |  Todos los planes
Gestión completa de turnos con vista semanal. Soporte para múltiples franjas horarias por día. Turnos recurrentes (series). Recordatorios automáticos por email al paciente. Integración con Google Calendar (sincronización bidireccional). Gestión de inasistencias con opción de cobro. Bonificación automática por feriados nacionales y provinciales configurables.

PACIENTES  |  Todos los planes
Ficha completa de cada paciente: datos personales, obra social asignada, honorarios por sesión, moneda de cobro (ARS / USD / EUR). Historia clínica con notas de sesión en texto enriquecido. Firma digital del paciente. Vista con tabs: Resumen, Atenciones, Historial, Facturación, Archivos.

HISTORIAL CLÍNICO  |  Todos los planes
Notas de sesión con editor de texto completo. Organizado cronológicamente. Acceso rápido desde la ficha del paciente. Base para los resúmenes de IA.

COBROS  |  Profesional, Premium, Bonificado
Módulo completo de gestión de deuda agrupado por paciente. Muestra sesiones impagas por mes. Pago global que distribuye el monto desde la sesión más antigua. Pago parcial por mes. Registro de medio de pago (efectivo, transferencia, MercadoPago, etc.). Eliminación de cobros individuales.

AVISO DE DEUDA  |  Profesional, Premium, Bonificado
Envío automático diario por email al paciente listando todas sus sesiones impagas con montos. Se activa/desactiva por profesional desde Ajustes. Elimina la incomodidad de reclamar pagos manualmente. Se verifica que no se envíe más de un aviso por día por paciente.

FACTURACIÓN / OBRAS SOCIALES  |  Profesional, Premium, Bonificado
Generación de planillas para obras sociales en PDF. Soporta: Hospital Italiano, IOMA, y un motor genérico configurable. El profesional declara las sesiones por mes y genera el PDF con su firma y sello escaneados. Configuración de múltiples obras sociales por paciente.

IA ATENCIONES  |  Profesional, Premium, Bonificado
Resumen automático de sesión generado por Gemini AI a partir de las notas del profesional. Ahorra tiempo de documentación. El resumen queda guardado en la historia clínica.

NOTA VOZ  |  Profesional, Premium, Bonificado
Grabación de audio directamente desde la historia clínica. Transcripción automática a texto via Orchard AI (Whisper large-v3-turbo). Duración máxima configurable globalmente por el Super Admin.

ARCHIVOS PACIENTE  |  Premium, Bonificado
Upload y organización de archivos por paciente integrado con Google Drive del profesional. Categorías: Laboratorio, Imágenes, Documentos, Otros. Acceso directo desde la ficha del paciente. Los archivos se almacenan en la carpeta del profesional en Drive.

INFORMES IA  |  Premium, Bonificado
Generación de informes clínicos con inteligencia artificial a partir del historial del paciente. Exportables.

BOOKING PÚBLICO  |  Premium, Bonificado
Link público personalizado para que los pacientes reserven turnos online sin intermediarios. El profesional configura disponibilidad, duración de sesión y anticipación mínima.

GOOGLE CALENDAR  |  Todos los planes
Conexión OAuth por profesional. Los turnos creados en KLIA se sincronizan a Google Calendar y viceversa.


ACCESO POR MÓDULO Y PLAN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{planes_access if planes_access else '''
Esencial: agenda, pacientes, historial, calendar sync
Profesional: + cobros, facturación, IA atenciones, nota_voz, aviso_deuda
Premium: + archivos_paciente, link público reservas, informes IA
Bonificado: todos los módulos
'''.strip()}


DIFERENCIADORES VS COMPETENCIA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ IA nativa para resúmenes de sesión (no requiere copy-paste a ChatGPT)
✓ Aviso automático de deuda — único en el mercado local
✓ Terminología adaptable: "sesión" (terapeutas) o "consulta" (médicos)
✓ Multi-moneda por paciente (ARS / USD / EUR)
✓ Integración real con AFIP vía obras sociales (IOMA, Hospital Italiano)
✓ Sincronización Google Calendar bidireccional
✓ 21 días de prueba gratuita, sin tarjeta
✓ Datos en Argentina — cumple Ley 26.529
✓ Soporte en español por email desde el día 1
✓ Sin contratos, cancelación en cualquier momento


PÚBLICO OBJETIVO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Profesionales de la salud independientes en Argentina:

• Psicólogos y psiquiatras (mayor volumen de usuarios actuales)
• Médicos clínicos y especialistas
• Kinesiólogos y fisioterapeutas
• Nutricionistas y dietistas
• Odontólogos
• Fonoaudiólogos
• Terapistas ocupacionales
• Centros de salud con múltiples profesionales (plan Premium)

Perfil típico del cliente Esencial/Profesional:
Profesional independiente, 10-80 pacientes, consulta en su propio consultorio o alquilado, factura a obras sociales manualmente, usa WhatsApp para turnos y quiere ordenarse.

Perfil típico del cliente Premium:
Centro o clínica con 2-5 profesionales, quiere gestión centralizada, ya factura a obras sociales y necesita archivos y reportes.


OBJECIONES FRECUENTES Y RESPUESTAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

"Ya uso Google Calendar / agenda de papel"
→ KLIA agrega historia clínica, cobros y recordatorios automáticos al paciente. El calendario solo gestiona turnos, no la relación clínica completa.

"Es muy caro"
→ El plan Esencial cuesta menos que 1 hora de consulta. El tiempo ahorrado en gestión de cobros y notas se paga solo en el primer mes.

"No soy de tecnología"
→ 21 días de prueba para aprender sin presión. Soporte por email incluido. Diseñado para ser intuitivo desde el primer día.

"¿Y mis datos?"
→ Servidores en Argentina, cumple Ley 26.529. No compartimos datos con terceros.

"¿Qué pasa si me voy?"
→ Cancelás cuando querés. Podés exportar toda tu información.


STACK TECNOLÓGICO (para contexto técnico)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Frontend: Next.js 14 + TypeScript + Tailwind CSS
Base de datos: Supabase (PostgreSQL + Auth + RLS)
IA: Google Gemini (resúmenes clínicos) + Orchard AI / Whisper (voz)
Email: Brevo (transaccional)
Pagos: Mercado Pago (suscripciones OAuth por profesional)
Infraestructura: Vercel (CI/CD automático)
Archivos: Google Drive API por profesional
Calendario: Google Calendar API por profesional


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Este documento se actualiza automáticamente cada noche a las 21hs Argentina.
Fuente: repositorio dibrand-dev/klia (rama main)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
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

        print("Escribiendo en Google Doc…")
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
