// Definición del formulario. app.js dibuja la pantalla, guarda y genera .docx/.pdf a partir de esto.
// Para un formulario nuevo: agregar otra entrada en FORMS (no hay que tocar app.js ni la base de datos).
// Tipos de campo: text | date | textarea | checks | radios | matrix | tabla | stats
const SN = ['Sí', 'No'];

window.FORMS = {
  informe_docente: {
    tipo: 'informe_docente',
    titulo: 'INFORME DE ACTIVIDADES DOCENTES',
    indexar: ['ciclo', 'departamento', 'asignatura'], // se copian a columnas de la tabla para filtrar/reportar
    pie: 'Importante: resguarde la documentación del desarrollo de la asignatura (planificaciones, grillas, informe y evaluaciones de los estudiantes). Será de utilidad para procesos de acreditación y otras instancias evaluativas.',
    secciones: [
      { titulo: 'Datos generales', campos: [
        { k: 'fecha', type: 'date', label: 'Fecha' },
        { k: 'ciclo', type: 'text', label: 'Ciclo lectivo / cuatrimestre (ej: 2026 - 2º cuatrimestre)' },
        { k: 'departamento', type: 'text', label: 'Departamento / Área' },
        { k: 'asignatura', type: 'text', label: 'Asignatura' },
        { k: 'plan', type: 'text', label: 'Plan de Estudios (especificar año y RM)' },
      ] },
      { titulo: '1) Plantel docente afectado al dictado en el ciclo lectivo informado', campos: [
        { k: 'plantel', type: 'tabla', cols: [
          { k: 'nombre', label: 'Apellido y Nombre' }, { k: 'dni', label: 'DNI' },
          { k: 'categoria', label: 'Categoría (ej: Prof. Titular)' }, { k: 'dedicacion', label: 'Dedicación (ej: Exclusiva)' },
          { k: 'revista', label: 'Situación de revista (ej: Ordinario)' },
        ] },
      ] },
      { titulo: '2) Resultados del cursado', campos: [
        { k: 'res', type: 'stats', filas: [
          ['regu', 'Total de alumnos que regularizaron'],
          ['prom', 'Total de alumnos que promocionaron'],
          ['libr', 'Total de alumnos libres por parciales'],
          ['aban', 'Total de alumnos que abandonaron (habiendo rendido una instancia evaluativa)'],
        ] },
      ] },
      { titulo: '3) Aspectos que afectaron el rendimiento de los estudiantes', campos: [
        { k: 'rendimiento', type: 'checks', opciones: [
          'Articulación teoría y práctica', 'Competencias comunicativas de estudiantes (lectura comprensiva, escritura)',
          'Competencias digitales de estudiantes', 'Bibliografía (nivel de complejidad)', 'Metodología de evaluación',
          'Sistema de tutorías (de la asignatura)', 'Superposición de actividades evaluativas con otras asignaturas',
          'Modalidad de cursado (presencial, mixta)', 'Régimen de promoción',
        ] },
        { k: 'rendimiento_otras', type: 'text', label: 'Otras (especificar)' },
      ] },
      { titulo: '4) Carga horaria', campos: [
        { k: 'carga', type: 'matrix', opciones: [...SN, 'No corresponde'], filas: [
          '¿Se cumplió la carga horaria presencial prevista en la planificación?',
          '¿En la planificación se contempló carga horaria virtual?',
          '¿Se cumplió la carga horaria virtual prevista en la planificación?',
          '¿Se dictaron clases híbridas?',
          '¿Se incorporó carga horaria virtual no prevista en la planificación? (fundamentar en el ítem 8)',
        ] },
      ] },
      { titulo: '5) Dificultades que afectaron el cursado', campos: [
        { k: 'dificultades', type: 'matrix', opciones: ['Ninguno', 'Regular', 'Significativo'], filas: [
          'Asuetos o suspensión de actividades no previstos', 'Disponibilidad de aulas físicas',
          'Disponibilidad de laboratorios (física, química, informática)',
          'Disponibilidad de recursos tecnológicos en aulas físicas (proyector, pantalla, PC, sonido, conectividad, etc.)',
          'Disponibilidad del equipo docente (salud, viajes, licencias, etc.)',
          'Falta de capacitación en el uso de herramientas digitales del equipo docente',
          'Disponibilidad de equipamiento / conectividad de estudiantes', 'Otras',
        ] },
        { k: 'dificultades_otras', type: 'text', label: 'Si marcó "Otras", indique el tipo de dificultad' },
        { k: 'estrategias', type: 'textarea', label: 'Describa si utilizó alguna estrategia para superar las dificultades presentadas' },
      ] },
      { titulo: '6) Fortalezas o aspectos positivos identificados en el desarrollo de la asignatura', campos: [
        { k: 'fortalezas', type: 'checks', opciones: [
          'Innovación pedagógica', 'Incorporación de tecnología (simuladores, aulas híbridas, etc.)',
          'Articulación investigación/asignatura', 'Articulación extensión/asignatura',
          'Invitados (expertos, profesionales, etc.)', 'Articulación Universidad/empresa - Universidad/cuerpos colegiados',
          'Visitas a instituciones o entidades vinculadas al ejercicio profesional',
        ] },
        { k: 'fortalezas_otras', type: 'text', label: 'Otras (especificar)' },
      ] },
      { titulo: '7) Herramientas tecnológicas utilizadas', campos: [
        { k: 'herramientas', type: 'checks', opciones: [
          'Plataforma Moodle', 'Sistema de videoconferencia (Meet - Zoom)', 'Correo electrónico',
          'Sistemas de mensajería (WhatsApp)', 'Simulación',
        ] },
        { k: 'herramientas_otras', type: 'text', label: 'Otras (ej: YouTube, VoiceThread)' },
      ] },
      { titulo: '8) Modificaciones realizadas a la planificación oportunamente presentada', campos: [
        { k: 'hubo_cambios', type: 'radios', opciones: SN, label: '¿Se realizaron cambios en relación a la planificación presentada (temas, metodología, carga horaria, modalidad)?' },
        { k: 'cambios', type: 'textarea', label: 'Si la respuesta es afirmativa, mencione brevemente los cambios realizados y su fundamentación' },
      ] },
      { titulo: '9) Otras actividades realizadas por el Equipo Docente', campos: [
        { k: 'colaboracion', type: 'textarea', label: 'Colaboración con otras asignaturas de carreras de FaCENA (actividad, participantes, fecha, resolución)' },
        { k: 'extension', type: 'textarea', label: 'Participación en Proyectos de Extensión (según lo informado en la planificación precedente)' },
      ] },
      { titulo: '10) Otros aspectos o actividades que considere relevante informar', campos: [
        { k: 'otros', type: 'textarea', label: 'Otros aspectos' },
        { k: 'firma', type: 'text', label: 'Docente responsable (aclaración de firma)' },
      ] },
    ],
  },
};
