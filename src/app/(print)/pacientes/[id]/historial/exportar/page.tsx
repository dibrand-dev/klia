import { redirect, notFound } from 'next/navigation'
import { format, parseISO, differenceInYears } from 'date-fns'
import { es } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/server'
import { getEffectiveTerapeutaIdServer } from '@/lib/auth/getEffectiveTerapeutaId'
import { zonedDateArgentina } from '@/lib/timezone'
import { armarHistorialParaImprimir, fmt, fmtDioptria, TITULO_MODULO, type BloqueModulo } from '@/lib/historial/armarImpresion'
import ImprimirButton from './ImprimirButton'
import './historial-print.css'

export const metadata = { title: 'Historia clínica — KLIA', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

function fmtFechaCorta(fechaISO: string): string {
  return format(parseISO(fechaISO), 'dd/MM/yyyy')
}

function escaparCss(texto: string): string {
  return texto.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

export default async function ExportarHistorialPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const efectivo = await getEffectiveTerapeutaIdServer(supabase)
  if (!efectivo) redirect('/login')
  if (efectivo.esColaborador) redirect(`/pacientes/${params.id}`)

  const { data: paciente } = await supabase
    .from('pacientes')
    .select('*')
    .eq('id', params.id)
    .eq('terapeuta_id', efectivo.terapeutaId)
    .single()

  if (!paciente) notFound()

  const [{ data: profile }, { data: notasData }, { data: turnosData }, { data: antroData }, { data: pioData }, { data: refraccionData }, { data: especialidadData }] = await Promise.all([
    supabase
      .from('profiles')
      .select('nombre, apellido, especialidad, matricula, matricula_tipo, matricula_provincia, domicilio_consultorio, localidad_consultorio, provincia_consultorio')
      .eq('id', efectivo.terapeutaId)
      .single(),
    supabase
      .from('notas_clinicas')
      .select('*')
      .eq('paciente_id', params.id)
      .eq('terapeuta_id', efectivo.terapeutaId)
      .not('borrador', 'is', true),
    supabase
      .from('turnos')
      .select('*')
      .eq('paciente_id', params.id)
      .eq('terapeuta_id', efectivo.terapeutaId),
    supabase
      .from('registros_antropometricos')
      .select('*')
      .eq('paciente_id', params.id)
      .eq('terapeuta_id', efectivo.terapeutaId),
    supabase
      .from('registros_pio')
      .select('*')
      .eq('paciente_id', params.id)
      .eq('terapeuta_id', efectivo.terapeutaId),
    supabase
      .from('registros_refraccion')
      .select('*')
      .eq('paciente_id', params.id)
      .eq('terapeuta_id', efectivo.terapeutaId),
    supabase
      .from('registros_especialidad')
      .select('*')
      .eq('paciente_id', params.id)
      .eq('terapeuta_id', efectivo.terapeutaId),
  ])

  const historial = armarHistorialParaImprimir({
    especialidadProfesional: profile?.especialidad ?? null,
    paciente,
    notas: notasData ?? [],
    turnos: turnosData ?? [],
    registrosAntropometricos: antroData ?? [],
    registrosPio: pioData ?? [],
    registrosRefraccion: refraccionData ?? [],
    registrosEspecialidad: especialidadData ?? [],
  })

  const ahoraAR = zonedDateArgentina(new Date().toISOString())
  const matriculaFormateada = profile?.matricula
    ? `${profile.matricula_tipo === 'nacional' ? 'MN' : 'MP'} ${profile.matricula}${profile.matricula_provincia ? ` (${profile.matricula_provincia})` : ''}`
    : null
  const direccionConsultorio = [profile?.domicilio_consultorio, profile?.localidad_consultorio, profile?.provincia_consultorio]
    .filter((v): v is string => !!v && v.trim() !== '')
    .join(', ')

  const edadPaciente = paciente.fecha_nacimiento ? differenceInYears(new Date(), parseISO(paciente.fecha_nacimiento)) : null
  const obraSocialLabel = paciente.obra_social
    ? `${paciente.obra_social}${paciente.plan_obra_social ? ` ${paciente.plan_obra_social}` : ''}${paciente.numero_afiliado ? ` · ${paciente.numero_afiliado}` : ''}`
    : 'Particular'

  const nombrePacienteCompleto = `${paciente.nombre} ${paciente.apellido}`
  const piePaginaTexto = escaparCss(`${nombrePacienteCompleto} · DNI ${paciente.dni ?? '—'} · Historia clínica`)

  return (
    <div className="hc-root">
      {/* eslint-disable-next-line react/no-danger */}
      <style dangerouslySetInnerHTML={{ __html: `
        @page {
          size: A4;
          margin: 14mm 14mm 16mm;
          @bottom-left { content: "${piePaginaTexto}"; font: 8.5pt 'Inter', sans-serif; color: #5B6472; }
          @bottom-right { content: "Página " counter(page) " de " counter(pages); font: 8.5pt 'Inter', sans-serif; color: #5B6472; }
        }
      ` }} />
      <div className="hc-toolbar">
        <ImprimirButton />
        <span>A4 · incluye pie con número de página</span>
      </div>
      <main className="hc-sheet">
        <header className="hc-mb">
          <div>
            <h1>Historia clínica</h1>
            <div className="hc-pro">
              <b>{profile ? `${profile.nombre} ${profile.apellido}` : ''}</b>
              {profile?.especialidad ? ` · ${profile.especialidad}` : ''}
              {matriculaFormateada ? ` · ${matriculaFormateada}` : ''}
            </div>
            {direccionConsultorio && <div className="hc-pro">{direccionConsultorio}</div>}
          </div>
          <div className="hc-em">
            <b>Emitida el {format(ahoraAR, 'dd/MM/yyyy')}</b>
            {format(ahoraAR, 'HH:mm')} h
            {historial.rangoFechas && (
              <><br />Registros: {fmtFechaCorta(historial.rangoFechas.desde)} al {fmtFechaCorta(historial.rangoFechas.hasta)}</>
            )}
          </div>
        </header>

        <section className="hc-pac">
          <div><span className="hc-lb">Paciente</span><b>{nombrePacienteCompleto}</b></div>
          <div><span className="hc-lb">DNI</span><b>{paciente.dni ?? '—'}</b></div>
          <div>
            <span className="hc-lb">Nacimiento</span>
            <b>{paciente.fecha_nacimiento ? `${fmtFechaCorta(paciente.fecha_nacimiento)}${edadPaciente != null ? ` · ${edadPaciente} años` : ''}` : '—'}</b>
          </div>
          <div><span className="hc-lb">Obra social</span><b>{obraSocialLabel}</b></div>
        </section>

        <h2 className="hc-sec">Evolución</h2>
        {historial.notas.map((nota) => (
          <article key={nota.id} className="hc-nota">
            <div className="hc-nh">
              <span className="hc-fe">{fmtFechaCorta(nota.fecha)}</span>
              <span className="hc-meta">
                {nota.horaLabel} h
                {nota.tipoTurnoLabel ? ` · ${nota.tipoTurnoLabel}` : ''}
                {nota.modalidadLabel ? ` · ${nota.modalidadLabel}` : ''}
              </span>
            </div>
            {/* eslint-disable-next-line react/no-danger */}
            <div className="hc-tx" dangerouslySetInnerHTML={{ __html: nota.contenidoHtml }} />
            {nota.modulo && <BloqueModuloRender modulo={nota.modulo} />}
          </article>
        ))}

        {historial.registrosSueltos.length > 0 && (
          <>
            <h2 className="hc-sec">Registros sin nota asociada</h2>
            {historial.registrosSueltos.map((r) => (
              <article key={r.id} className="hc-nota">
                <div className="hc-nh">
                  <span className="hc-fe">{fmtFechaCorta(r.fecha)}</span>
                  {r.horaLabel && <span className="hc-meta">{r.horaLabel} h</span>}
                </div>
                <BloqueModuloRender modulo={r.modulo} />
              </article>
            ))}
          </>
        )}

        <footer className="hc-cierre">
          <p>Documento confidencial. Contiene datos de salud protegidos por la Ley 25.326 de Protección de Datos Personales y la Ley 26.529 de Derechos del Paciente. Emitido desde KLIA · app.klia.com.ar</p>
          <div className="hc-firma">
            <b>{profile ? `${profile.nombre} ${profile.apellido}` : ''}</b>
            {matriculaFormateada ? `${matriculaFormateada} · ` : ''}{profile?.especialidad ?? ''}
          </div>
        </footer>
      </main>
    </div>
  )
}

function BloqueModuloRender({ modulo }: { modulo: BloqueModulo }) {
  return (
    <div className="hc-mod">
      <div className="hc-mt">{TITULO_MODULO[modulo.tipo]}<span>{modulo.tipo}</span></div>
      <div className="hc-mb2">
        {modulo.tipo === 'Nutrición' && <BloqueNutricionRender b={modulo.antro} />}
        {modulo.tipo === 'Oftalmología' && <BloqueOftalmologiaRender b={modulo.oftalmologia} />}
        {modulo.tipo === 'Kinesiología' && <BloqueKinesiologiaRender b={modulo.kinesiologia} />}
        {modulo.tipo === 'Odontología' && <BloqueOdontologiaRender b={modulo.odontologia} />}
        {modulo.tipo === 'Psicología' && <BloquePsicologiaRender b={modulo.psicologia} />}
        {modulo.tipo === 'Clínica Médica' && <BloqueClinicaMedicaRender b={modulo.clinicaMedica} />}
      </div>
    </div>
  )
}

function Celda({ label, valor, unidad }: { label: string; valor: string | null; unidad?: string }) {
  return (
    <div>
      <span className="hc-lb">{label}</span>
      <b>{valor ?? '—'} {valor != null && unidad && <small>{unidad}</small>}</b>
    </div>
  )
}

function Cie10Chips({ chips }: { chips: { codigo: string; descripcion: string }[] }) {
  if (chips.length === 0) return null
  return (
    <div>
      <div className="hc-st">Diagnóstico CIE-10</div>
      <div className="hc-cie">
        {chips.map((c) => <span key={c.codigo}><b>{c.codigo}</b>{c.descripcion}</span>)}
      </div>
    </div>
  )
}

function BloqueNutricionRender({ b }: { b: import('@/lib/historial/armarImpresion').BloqueNutricion }) {
  return (
    <>
      <div className="hc-kv">
        <Celda label="Peso" valor={b.peso != null ? fmt(b.peso, 1) : null} unidad="kg" />
        <Celda label="Altura" valor={b.altura != null ? fmt(b.altura, 0) : null} unidad="cm" />
        <Celda label="Cintura" valor={b.cintura != null ? fmt(b.cintura, 0) : null} unidad="cm" />
        <Celda label="Cadera" valor={b.cadera != null ? fmt(b.cadera, 0) : null} unidad="cm" />
        <Celda label="% Grasa" valor={b.porcentajeGrasa != null ? fmt(b.porcentajeGrasa, 1) : null} unidad="%" />
        <Celda label="% Músculo" valor={b.porcentajeMusculo != null ? fmt(b.porcentajeMusculo, 1) : null} unidad="%" />
      </div>
      {(b.pliegueTricipital != null || b.pliegueSubescapular != null || b.pliegueSuprailiaco != null || b.pliegueAbdominal != null || b.perimetroBrazo != null || b.perimetroPierna != null) && (
        <table>
          <thead><tr><th>Pliegue tricipital</th><th>Subescapular</th><th>Suprailíaco</th><th>Abdominal</th><th>Perím. brazo</th><th>Perím. pierna</th></tr></thead>
          <tbody>
            <tr>
              <td className="n">{b.pliegueTricipital != null ? `${fmt(b.pliegueTricipital, 0)} mm` : '—'}</td>
              <td className="n">{b.pliegueSubescapular != null ? `${fmt(b.pliegueSubescapular, 0)} mm` : '—'}</td>
              <td className="n">{b.pliegueSuprailiaco != null ? `${fmt(b.pliegueSuprailiaco, 0)} mm` : '—'}</td>
              <td className="n">{b.pliegueAbdominal != null ? `${fmt(b.pliegueAbdominal, 0)} mm` : '—'}</td>
              <td className="n">{b.perimetroBrazo != null ? `${fmt(b.perimetroBrazo, 0)} cm` : '—'}</td>
              <td className="n">{b.perimetroPierna != null ? `${fmt(b.perimetroPierna, 0)} cm` : '—'}</td>
            </tr>
          </tbody>
        </table>
      )}
      {(b.imc || b.geb != null || b.indiceCinturaCadera != null) && (
        <div className="hc-kv c3">
          <Celda label="IMC" valor={b.imc ? `${fmt(b.imc.valor, 1)} ` : null} unidad={b.imc?.label} />
          <Celda label="GEB (Mifflin-St Jeor)" valor={b.geb != null ? fmt(b.geb, 0) : null} unidad="kcal" />
          <Celda label="Índice cintura/cadera" valor={b.indiceCinturaCadera != null ? fmt(b.indiceCinturaCadera, 2) : null} />
        </div>
      )}
    </>
  )
}

function BloqueOftalmologiaRender({ b }: { b: import('@/lib/historial/armarImpresion').BloqueOftalmologia }) {
  return (
    <>
      {(b.pio || b.refraccion) && (
        <>
          {b.pio && (
            <table>
              <thead><tr><th></th><th>AV sc</th><th>AV cc</th><th>PIO medida</th><th>Paquimetría</th><th>PIO corregida</th></tr></thead>
              <tbody>
                <tr>
                  <th>OD</th><td>{b.pio.od.avSc ?? '—'}</td><td>{b.pio.od.avCc ?? '—'}</td>
                  <td className="n">{b.pio.od.pioMedida != null ? `${fmt(b.pio.od.pioMedida, 0)} mmHg` : '—'}</td>
                  <td className="n">{b.pio.od.paquimetria != null ? `${fmt(b.pio.od.paquimetria, 0)} µm` : '—'}</td>
                  <td className="n">{b.pio.od.pioCorregida != null ? `${fmt(b.pio.od.pioCorregida, 1)} mmHg` : '—'}</td>
                </tr>
                <tr>
                  <th>OI</th><td>{b.pio.oi.avSc ?? '—'}</td><td>{b.pio.oi.avCc ?? '—'}</td>
                  <td className="n">{b.pio.oi.pioMedida != null ? `${fmt(b.pio.oi.pioMedida, 0)} mmHg` : '—'}</td>
                  <td className="n">{b.pio.oi.paquimetria != null ? `${fmt(b.pio.oi.paquimetria, 0)} µm` : '—'}</td>
                  <td className="n">{b.pio.oi.pioCorregida != null ? `${fmt(b.pio.oi.pioCorregida, 1)} mmHg` : '—'}</td>
                </tr>
              </tbody>
            </table>
          )}
          {b.refraccion && (
            <table>
              <thead><tr><th>Refracción</th><th>Esfera</th><th>Cilindro</th><th>Eje</th><th>Adición</th><th>Equiv. esférico</th></tr></thead>
              <tbody>
                <tr>
                  <th>OD</th>
                  <td className="n">{b.refraccion.od.sph != null ? fmtDioptria(b.refraccion.od.sph) : '—'}</td>
                  <td className="n">{b.refraccion.od.cyl != null ? fmtDioptria(b.refraccion.od.cyl) : '—'}</td>
                  <td className="n">{b.refraccion.od.axis != null ? `${fmt(b.refraccion.od.axis, 0)}°` : '—'}</td>
                  <td className="n">{b.refraccion.od.add != null ? fmtDioptria(b.refraccion.od.add) : '—'}</td>
                  <td className="n">{b.refraccion.od.equivEsferico != null ? `${fmtDioptria(b.refraccion.od.equivEsferico)} D` : '—'}</td>
                </tr>
                <tr>
                  <th>OI</th>
                  <td className="n">{b.refraccion.oi.sph != null ? fmtDioptria(b.refraccion.oi.sph) : '—'}</td>
                  <td className="n">{b.refraccion.oi.cyl != null ? fmtDioptria(b.refraccion.oi.cyl) : '—'}</td>
                  <td className="n">{b.refraccion.oi.axis != null ? `${fmt(b.refraccion.oi.axis, 0)}°` : '—'}</td>
                  <td className="n">{b.refraccion.oi.add != null ? fmtDioptria(b.refraccion.oi.add) : '—'}</td>
                  <td className="n">{b.refraccion.oi.equivEsferico != null ? `${fmtDioptria(b.refraccion.oi.equivEsferico)} D` : '—'}</td>
                </tr>
              </tbody>
            </table>
          )}
        </>
      )}
      {(b.biomicroscopia || b.fondoDeOjo) && (
        <dl className="hc-ln">
          {b.biomicroscopia && <><dt>Biomicroscopía</dt><dd>{b.biomicroscopia}</dd></>}
          {b.fondoDeOjo && <><dt>Fondo de ojo</dt><dd>{b.fondoDeOjo}</dd></>}
        </dl>
      )}
      <Cie10Chips chips={b.cie10} />
      {b.pio && <div className="hc-cap">PIO corregida por paquimetría (Ehlers). Rango de referencia ≤ 21 mmHg.</div>}
    </>
  )
}

function BloqueKinesiologiaRender({ b }: { b: import('@/lib/historial/armarImpresion').BloqueKinesiologia }) {
  const hayPlan = b.sesionActual != null && b.sesionesTotal != null
  return (
    <>
      <div className="hc-kv">
        <Celda label="Dolor (EVA)" valor={b.eva != null ? `${b.eva}` : null} unidad="/ 10" />
        <Celda label="Zona" valor={b.zona} />
        <Celda label="Lado" valor={b.lado} />
        <Celda label="Movimiento" valor={b.movimiento} />
        <Celda label="ROM" valor={b.rom != null ? `${fmt(b.rom, 0)}°` : null} />
        <Celda label="Fuerza (Daniels)" valor={b.daniels != null ? `${b.daniels} / 5` : null} />
      </div>
      {hayPlan && (
        <div className="hc-kv c1">
          <Celda label="Sesión" valor={`${b.sesionActual} de ${b.sesionesTotal}`} />
        </div>
      )}
    </>
  )
}

function BloqueOdontologiaRender({ b }: { b: import('@/lib/historial/armarImpresion').BloqueOdontologia }) {
  return (
    <>
      {b.filas.length > 0 && (
        <table>
          <thead><tr><th style={{ width: 70 }}>Pieza (FDI)</th><th style={{ width: 90 }}>Caras</th><th>Prestación</th></tr></thead>
          <tbody>
            {b.filas.map((f, i) => (
              <tr key={i}><td>{f.pieza}</td><td>{f.caras}</td><td>{f.prestacion}</td></tr>
            ))}
          </tbody>
        </table>
      )}
      <Cie10Chips chips={b.cie10} />
    </>
  )
}

function BloquePsicologiaRender({ b }: { b: import('@/lib/historial/armarImpresion').BloquePsicologia }) {
  return (
    <div className="hc-kv c4">
      <Celda label="PHQ-9" valor={b.phq != null ? `${b.phq}` : null} unidad={b.phqSeveridad ? `/ 27 · ${b.phqSeveridad}` : '/ 27'} />
      <Celda label="GAD-7" valor={b.gad != null ? `${b.gad}` : null} unidad={b.gadSeveridad ? `/ 21 · ${b.gadSeveridad}` : '/ 21'} />
      <Celda label="Riesgo" valor={b.riesgo} />
    </div>
  )
}

function BloqueClinicaMedicaRender({ b }: { b: import('@/lib/historial/armarImpresion').BloqueClinicaMedica }) {
  return (
    <>
      <div className="hc-kv">
        <div>
          <span className="hc-lb">TA</span>
          <b className={b.taAlerta ? 'hc-al' : ''}>{b.tas != null && b.tad != null ? `${fmt(b.tas, 0)}/${fmt(b.tad, 0)}` : '—'} <small>mmHg</small></b>
        </div>
        <Celda label="FC" valor={b.fc != null ? fmt(b.fc, 0) : null} unidad="lpm" />
        <Celda label="FR" valor={b.fr != null ? fmt(b.fr, 0) : null} unidad="rpm" />
        <Celda label="Temp." valor={b.temp != null ? fmt(b.temp, 1) : null} unidad="°C" />
        <Celda label="SatO₂" valor={b.sat != null ? fmt(b.sat, 0) : null} unidad="%" />
        <Celda label="IMC" valor={b.imc ? fmt(b.imc.valor, 1) : null} />
      </div>
      {b.taClasificacion && (
        <div className="hc-kv c3">
          <Celda label="Clasificación TA" valor={b.taClasificacion} />
        </div>
      )}
      <Cie10Chips chips={b.cie10} />
    </>
  )
}
