"""
Script de seed de documentos cívicos canónicos de Cartagena de Indias.

Indexa los documentos fundacionales del proyecto VÉRTICE OS en Pinecone
usando el pipeline RAG con embeddings Voyage AI.

Uso:
    python scripts/seed_cartagena.py
    python scripts/seed_cartagena.py --dry-run
    python scripts/seed_cartagena.py --doc "POT Cartagena 2001-2011"

Variables de entorno requeridas:
    PINECONE_API_KEY
    PINECONE_INDEX
    VOYAGE_API_KEY  (opcional — usa hash fallback si no está)
"""
from __future__ import annotations

import argparse
import asyncio
import hashlib
import logging
import re
import sys
from pathlib import Path
from typing import Any

# Añadir el directorio padre al path para importar módulos del servicio
sys.path.insert(0, str(Path(__file__).parent.parent))

from rag import rag_pipeline

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger(__name__)

CHUNK_SIZE = 800
CHUNK_OVERLAP = 100


# ──────────────────────────────────────────────────────────────────────────────
# Documentos canónicos de Cartagena
# ──────────────────────────────────────────────────────────────────────────────

SEED_DOCUMENTS: list[dict[str, Any]] = [
    {
        "name": "POT Cartagena 2001-2011",
        "doc_type": "pot",
        "locality": None,  # ciudad entera
        "url": None,
        "summary_text": """Plan de Ordenamiento Territorial de Cartagena de Indias — Decreto 0977 de 2001.

El POT de Cartagena de Indias fue adoptado mediante Decreto 0977 de 2001, con vigencia inicial 2001-2011,
y ha sido objeto de revisiones parciales posteriores. Es el instrumento rector del ordenamiento físico del territorio distrital.

Estructura territorial: El Distrito de Cartagena de Indias se organiza en cuatro localidades:
Localidad 1 Histórica y del Caribe Norte (CTG-01), Localidad 2 de la Virgen y Turística (CTG-02),
Localidad 3 Industrial y de la Bahía (CTG-03), y Localidad 4 de la Virgen y Turística Rural — Bayunca (CTG-04).

Áreas protegidas y zonas de riesgo: El POT identifica zonas de protección ambiental incluyendo
el sistema de ciénagas (Ciénaga de la Virgen, Ciénaga de Juan Polo, Ciénaga del Totumo),
los manglares del Canal del Dique y bahía de Cartagena, y las islas del Rosario y San Bernardo.
Establece restricciones a la construcción en zonas de riesgo por inundación, especialmente en
barrios como La Esperanza, Boston, y sectores de la Localidad 2 cercanos a la Ciénaga de la Virgen.

Usos del suelo: Define suelo urbano, de expansión urbana, rural y suburbano. Las zonas históricas
(Centro Histórico, Getsemaní) tienen régimen especial de protección patrimonial bajo supervisión del
Ministerio de Cultura y el PEMP (Plan Especial de Manejo y Protección). Las zonas industriales se
concentran en Mamonal, Pasacaballos y la refinería.

Equipamientos y espacio público: Establece estándares mínimos de espacio público por habitante
(15 m² verde/habitante), ubicación de equipamientos de salud, educación y recreación por comunas.
Define la obligatoriedad de cesiones urbanísticas en nuevos desarrollos.

Movilidad: El plan vial estructura vías arterias, colectoras y locales. Identifica el corredor
de Transcaribe (Avenida Pedro de Heredia, Troncal del Caribe) como eje estructurante del sistema
de transporte masivo. Establece el anillo vial como perímetro de contención del crecimiento urbano.

Patrimonio cultural: El Centro Histórico de Cartagena, declarado Patrimonio de la Humanidad por
UNESCO en 1984, tiene régimen especial. Las intervenciones en inmuebles del Centro Histórico,
Getsemaní y zonas de influencia requieren concepto previo del Consejo Distrital de Patrimonio.

Normas urbanísticas: Alturas máximas por zona, aislamientos, índices de ocupación y construcción,
obligatoriedad de estudios de suelo en zonas de riesgo, y tratamientos urbanísticos
(conservación, renovación, consolidación, desarrollo) por sector.""",
    },
    {
        "name": "Plan de Desarrollo Cartagena 2024-2027 Cartagena Cambia",
        "doc_type": "plan",
        "locality": None,
        "url": None,
        "summary_text": """Plan de Desarrollo Distrital de Cartagena de Indias 2024-2027 "Cartagena Cambia".

Adoptado mediante Acuerdo del Concejo Distrital de Cartagena en 2024, bajo la administración del
alcalde Dumek Turbay Paz (período 2024-2027). Es el instrumento de planeación que orienta las
políticas, estrategias, programas y proyectos de la Administración Distrital para el cuatrienio.

Ejes estratégicos:
1. Cartagena Social y con Equidad: educación de calidad, salud accesible, superación de la pobreza,
   atención a poblaciones vulnerables (víctimas del conflicto, comunidades afrocolombianas,
   comunidades insulares, mujeres, personas con discapacidad). Meta: reducir el índice de pobreza
   multidimensional del 28% al 22%.

2. Cartagena Segura: seguridad ciudadana, convivencia, atención a violencia de género,
   fortalecimiento de la Policía Metropolitana, cámaras de seguridad, alumbrado público en zonas
   críticas, prevención del reclutamiento de menores.

3. Cartagena Productiva y Competitiva: turismo sostenible, economía naranja, emprendimiento,
   formalización laboral, apoyo a MIPYMES, desarrollo portuario sostenible, zona franca.
   Meta: creación de 15.000 empleos formales en el cuatrienio.

4. Cartagena Ambiental y Resiliente: adaptación al cambio climático, gestión del riesgo de
   inundaciones (especialmente en la Localidad 2 — barrios Nelson Mandela, Ciudadela 2000,
   La Esperanza), recuperación de ciénagas y manglares, manejo integral de residuos sólidos,
   acueducto y alcantarillado en zonas periféricas.

5. Cartagena con Buen Gobierno: transparencia, lucha contra la corrupción, participación ciudadana,
   gobierno digital, modernización de la Alcaldía, fortalecimiento de las JACs y JALs.

Inversión total programada: aproximadamente 3.2 billones de pesos colombianos para el cuatrienio,
financiados con recursos propios del Distrito, transferencias nacionales (SGP), regalías (SGR),
crédito público y cooperación internacional.

Metas sectoriales clave:
- Educación: 5 nuevas sedes educativas, 95% cobertura en educación básica, ampliación de jornada
  única en colegios oficiales.
- Salud: reducción de mortalidad materna a menos de 30 por 100.000 NV, ampliación de ESE Caminos
  de Salud y Hospital Universitario del Caribe.
- Agua potable: cobertura del 95% en zona urbana y 60% en zona rural para 2027.
- Vivienda: construcción o mejoramiento de 10.000 viviendas para hogares vulnerables.
- Movilidad: 20 km nuevos de ciclovías, renovación del 30% de la flota de Transcaribe.

Mecanismos de participación: rendición de cuentas semestral obligatoria, presupuesto participativo
por localidades (mínimo 5% del presupuesto de inversión), audiencias públicas de control social.""",
    },
    {
        "name": "Estatuto Tributario Distrital de Cartagena",
        "doc_type": "estatuto",
        "locality": None,
        "url": None,
        "summary_text": """Estatuto Tributario del Distrito de Cartagena de Indias — Decreto 0558 de 2012 y modificaciones.

El Estatuto Tributario Distrital compila y actualiza la normativa tributaria local de Cartagena,
codificando los impuestos, tasas y contribuciones de competencia distrital conforme al marco
constitucional (Art. 287, 317, 338 CP) y la Ley 14/1983, Ley 44/1990, Ley 1430/2010,
Ley 1607/2012 y demás normas concordantes.

Impuesto Predial Unificado (IPU):
Principal impuesto distrital. Base gravable: valor catastral del inmueble determinado por el
IGAC (Instituto Geográfico Agustín Codazzi) o la autoridad catastral delegada. Tarifas diferenciales
por uso (residencial estrato 1-6, comercial, industrial, lote urbanizable no urbanizado, rural).
Tarifa mínima: 1‰ (predios rurales y estratos 1-2). Tarifa máxima: 33‰ (lotes urbanizables
no urbanizados). Descuentos por pago anticipado (hasta 10% si se paga antes de marzo 31).
Exenciones: predios de entidades del Estado, iglesias, predios de propiedad colectiva de
comunidades afrocolombianas, bienes de interés cultural con declaratoria vigente.

Impuesto de Industria y Comercio (ICA):
Grava las actividades industriales, comerciales y de servicios ejercidas en jurisdicción de Cartagena.
Tarifa promedio: 5‰ a 10‰ según actividad (industria: 5‰, comercio minorista: 4‰, servicios
financieros: 10‰, servicios profesionales: 8‰). Base: ingresos netos del período gravable.
Obligados: toda persona natural o jurídica que realice actividades económicas en Cartagena,
incluyendo las desarrolladas en el Canal del Dique y zona marina.

Impuesto de Avisos y Tableros: complementario del ICA, 15% del ICA liquidado.

Contribución de Valorización: financiamiento de obras públicas de interés local mediante
distribución del beneficio entre propietarios de inmuebles en el área de influencia.
Importante para obras en el Centro Histórico, Bocagrande y corredores viales principales.

Sobretasa a la Gasolina: 18.5% sobre el precio al consumidor de la gasolina motor corriente.

Impuesto Unificado de Vehículos: anual sobre vehículos matriculados en Cartagena.
Base: valor comercial del vehículo fijado por el Ministerio de Transporte. Tarifa: 1.5% a 3.5%.

Contribución por Licencias de Construcción: porcentaje sobre el valor de la obra.
Administrada por la Secretaría de Planeación Distrital (Curaduría Urbana).

Procedimiento tributario: Declaración y pago en la Secretaría de Hacienda Distrital o medios
electrónicos habilitados. Prescripción de la acción de cobro: 5 años. Sanciones por no declarar,
extemporaneidad e inexactitud. Recursos: reconsideración (15 días) y apelación ante el Tribunal
Administrativo de Bolívar. El Acuerdo Distrital No. 073/2021 actualizó las tarifas del predial.""",
    },
    {
        "name": "Ley 472 de 1998 — Acciones Populares y de Grupo",
        "doc_type": "normativa",
        "locality": None,
        "url": None,
        "summary_text": """Ley 472 de 1998 — Acciones Populares y de Grupo (Colombia).

Reglamenta el artículo 88 de la Constitución Política de Colombia. Desarrolla el mecanismo de
protección de los derechos e intereses colectivos y define las acciones de grupo.

Derechos colectivos protegidos (artículo 4):
- El goce de un ambiente sano (Art. 79 CP)
- La moralidad administrativa
- La existencia del equilibrio ecológico y el manejo y aprovechamiento racional de los recursos naturales
- El goce del espacio público y la utilización y defensa de los bienes de uso público
- La defensa del patrimonio público
- La defensa del patrimonio cultural de la Nación
- La seguridad y salubridad públicas
- El acceso a una infraestructura de servicios que garantice la salubridad pública
- La libre competencia económica
- El acceso a los servicios públicos y que su prestación sea eficiente y oportuna
- La prohibición de la fabricación, importación, posesión, uso de armas químicas
- El derecho a la seguridad y prevención de desastres previsibles técnicamente
- La realización de las construcciones, edificaciones y desarrollos urbanos respetando disposiciones
- Los derechos de los consumidores y usuarios

Legitimación activa (artículo 12): Toda persona natural o jurídica puede interponer acciones
populares. También el Defensor del Pueblo, el Personero Municipal, el Alcalde y demás servidores
públicos que por razón de sus funciones deban promover la protección y defensa de estos derechos.

Competencia: Los jueces administrativos y los tribunales administrativos conocen las acciones
populares cuando el demandado sea una entidad pública o un particular que desempeñe funciones
administrativas. Los jueces civiles del circuito cuando el demandado sea un particular.

Procedimiento: Demanda → admisión (3 días) → traslado al demandado (10 días) → audiencia de
pacto de cumplimiento → etapa probatoria → sentencia. El proceso es preferente y expedito.

Medidas cautelares: El juez puede decretar medidas cautelares antes de la sentencia para impedir
que se continúe la amenaza o vulneración del derecho colectivo.

Incentivo económico: La ley original contemplaba un incentivo económico para el demandante.
La Ley 1425/2010 eliminó los incentivos económicos en acciones populares.

Para Cartagena, las acciones populares más frecuentes involucran:
- Contaminación de la bahía de Cartagena y ciénagas adyacentes
- Invasión del espacio público en el Centro Histórico y Bocagrande
- Deficiencias en la prestación del servicio de agua potable (Aguas de Cartagena)
- Construcciones ilegales en zonas de protección ambiental y manglar
- Deterioro del patrimonio histórico y arquitectónico de la ciudad amurallada""",
    },
    {
        "name": "Ley 1755 de 2015 — Derecho de Petición",
        "doc_type": "normativa",
        "locality": None,
        "url": None,
        "summary_text": """Ley 1755 de 2015 — Derecho Fundamental de Petición (Colombia).

Reglamenta el artículo 23 de la Constitución Política. Reemplazó el Código Contencioso
Administrativo (Decreto 01/1984) en materia de peticiones. Fue precedida por la Sentencia
C-818/2011 de la Corte Constitucional que declaró inexequible la regulación anterior.

Ámbito de aplicación (artículo 1): Entidades públicas, organismos de control, entidades privadas
que presten servicios públicos o ejerzan funciones públicas respecto a dichas funciones.
También aplica a organizaciones privadas con fines de interés público y a particulares frente
a quienes el peticionario tenga una relación legal o reglamentaria.

Modalidades del derecho de petición (artículo 16):
- Peticiones de información: solicitar información sobre datos o documentos en poder de la entidad
- Peticiones de interés particular: solicitar un reconocimiento de un derecho o beneficio
- Peticiones de interés general: fines de bien común
- Consultas: presentar conceptos sobre materias a cargo de la entidad
- Quejas: poner en conocimiento conductas irregulares de servidores públicos
- Reclamos: manifestar la inconformidad con la prestación de un servicio

Términos de respuesta (artículo 14):
- Término general: 15 días hábiles
- Documentos y espacios: 10 días hábiles
- Consultas escritas: 30 días hábiles
- Quejas, reclamos, manifestaciones o reconocimientos: 15 días hábiles
- Derecho de petición en interés humanitario: 10 días hábiles

Petición incompleta (artículo 17): Si la petición está incompleta, la entidad tiene 10 días
hábiles para solicitar al peticionario los requisitos faltantes. El término de respuesta se
suspende durante este período.

Silencio administrativo negativo (artículo 83 CPACA): Si la entidad no responde en el término
legal, se entiende que la decisión es negativa, salvo disposición legal especial.

Tutela por violación del derecho de petición: Si la entidad no responde en el término legal,
el ciudadano puede interponer una acción de tutela (Art. 86 CP) ante cualquier juez del circuito,
sin costo y sin necesidad de abogado. El juez tiene 10 días para decidir.

Correo electrónico y medios electrónicos: Las peticiones pueden presentarse por cualquier medio,
incluyendo correo electrónico. La entidad tiene la obligación de acusar recibo.

Entidades clave en Cartagena:
- Alcaldía Distrital: alcaldia@cartagena.gov.co
- Secretaría de Infraestructura: para vías, alumbrado, obras públicas
- Aguas de Cartagena: acueducto@aguasdecartagena.com (PQRS de servicios públicos)
- Personería Distrital: personeria@personeriadecartagena.gov.co (quejas contra funcionarios)""",
    },
    {
        "name": "Ley 134 de 1994 — Mecanismos de Participación Ciudadana",
        "doc_type": "normativa",
        "locality": None,
        "url": None,
        "summary_text": """Ley 134 de 1994 — Mecanismos de Participación Ciudadana (Colombia).

Reglamenta el Título IV de la Constitución Política sobre participación democrática, desarrollando
los mecanismos de participación ciudadana consagrados en los artículos 40, 103 y 106 de la CP.
Complementada por la Ley 1757 de 2015 (Estatuto de la Participación Democrática).

Mecanismos de participación regulados:

1. Iniciativa popular legislativa y normativa (artículo 2):
Derecho de los ciudadanos de presentar proyectos de acto legislativo, de ley, de ordenanza,
de acuerdo o de resolución local ante las corporaciones públicas correspondientes.
Requisito: respaldo del 5% del censo electoral inscrito para el mecanismo específico.
Para acuerdos del Concejo de Cartagena, se requiere apoyo del 5% del censo electoral distrital.

2. Referendo (artículo 3):
Convocatoria que se hace al pueblo para que apruebe o rechace un proyecto de norma jurídica,
o derogue o no una norma ya vigente. Puede ser constitucional (para reformar la CP) o legal.
Los referendos municipales requieren respaldo del 10% del censo electoral y decisión favorable
de la mayoría de los votantes, siempre que vote al menos la cuarta parte del censo electoral.

3. Consulta popular (artículo 8):
La institución mediante la cual, una pregunta de carácter general sobre un asunto de trascendencia
nacional, departamental, municipal, distrital o local, es sometida por el Presidente de la República,
el gobernador o el alcalde, según el caso, a consideración del pueblo para que éste se pronuncie.
Para consultas distritales en Cartagena, el alcalde requiere previo concepto favorable del Concejo.

4. Cabildo abierto (artículo 9):
Reunión pública del Concejo Distrital, Asamblea o Junta Administradora Local, convocada por
iniciativa popular para discutir asuntos de interés comunitario. Cualquier ciudadano puede
solicitar al Concejo de Cartagena la convocatoria, con firma de por lo menos el 5‰ del censo
electoral del respectivo municipio. El Concejo tiene la obligación de realizarlo en los 30 días
siguientes a la solicitud.

5. Iniciativa popular (artículo 2): Ver punto 1.

6. Revocatoria del mandato (artículo 6):
Derecho político de los ciudadanos de dar por terminado el mandato que le han conferido a un
gobernador o a un alcalde. Para el alcalde de Cartagena, puede solicitarse cuando hayan
transcurrido mínimo 12 meses de gestión. Requisito: solicitud del 40% de los votos que obtuvo
el mandatario en la elección. Aprobación: mayoría de los sufragantes, siempre que vote al menos
el 55% de la votación registrada en la jornada electoral en que se eligió al mandatario.

Juntas de Acción Comunal (JAC):
Las JAC son corporaciones cívicas sin ánimo de lucro conformadas por los vecinos de un barrio
o vereda. Son el mecanismo más directo de participación comunitaria en Colombia. En Cartagena
existen más de 300 JACs. Las JACs tienen personería jurídica reconocida por el Ministerio del
Interior y pueden celebrar contratos con entidades públicas.

Juntas Administradoras Locales (JAL):
Corporación administrativa local elegida por voto popular por períodos de 4 años. En Cartagena
existen 4 JALs (una por localidad), con entre 5 y 11 miembros según la población de la localidad.
Las JALs participan en la distribución y apropiación de las partidas que el presupuesto municipal
destina al respectivo barrio o corregimiento. También fiscalizan la prestación de servicios públicos.""",
    },
    {
        "name": "Acuerdo 006 de 2003 CARDIQUE — Áreas Protegidas Bolívar",
        "doc_type": "normativa",
        "locality": None,
        "url": None,
        "summary_text": """Acuerdo No. 006 de 2003 — CARDIQUE (Corporación Autónoma Regional del Canal del Dique).

Mediante este Acuerdo, el Consejo Directivo de CARDIQUE adoptó el Plan de Gestión Ambiental
Regional (PGAR) y estableció las directrices para la administración y manejo de las áreas
protegidas en la jurisdicción de los departamentos de Bolívar y Sucre, incluyendo el área de
influencia de Cartagena de Indias.

CARDIQUE — Jurisdicción y competencias:
La Corporación Autónoma Regional del Canal del Dique tiene jurisdicción sobre los municipios
del norte de Bolívar y el sur de Sucre, incluyendo Cartagena de Indias, Turbaco, Arjona,
Mahates, Calamar, San Juan Nepomuceno, el Dique (Soplaviento, Calamar, Santa Lucía).

Áreas protegidas identificadas en la jurisdicción de Cartagena:
1. Sistema de Ciénagas de la Bahía de Cartagena: incluye la Ciénaga de la Virgen (7.200 ha),
   Ciénaga Juan Polo, Ciénaga de Tesca. Categoría: Humedal de importancia nacional.
   Amenazas: sedimentación, vertimientos de aguas residuales, invasión de ronda hídrica.

2. Manglares del Canal del Dique y Bahía de Cartagena: Aproximadamente 8.500 ha de manglar
   en la zona de influencia del Canal del Dique. Ecosistema crítico para la pesca artesanal
   de comunidades de Pasacaballos, Bayunca y el Archipiélago de Islas del Rosario.

3. Islas del Rosario y San Bernardo (zona colindante con el Parque Nacional Natural):
   Aunque el PNN Corales del Rosario y San Bernardo es competencia de Parques Nacionales
   (entidad del orden nacional), CARDIQUE tiene injerencia en la zona de amortiguamiento.

4. Serranía de San Jacinto y Sistema Montañoso de los Montes de María: zona de importancia
   hídrica para los municipios del sur de Bolívar.

Prohibiciones aplicables en zonas protegidas bajo jurisdicción CARDIQUE:
- Tala de manglar sin autorización (sanción: multas hasta 5.000 SMLMV + restauración forzada)
- Vertimientos de aguas residuales sin tratamiento en cuerpos hídricos (Art. 42 Ley 99/1993)
- Relleno o desecación de ciénagas y humedales
- Pesca con métodos no autorizados en áreas de veda
- Construcciones en ronda hídrica de los 30 metros (Decreto 2245/2017)

Trámites ante CARDIQUE en Cartagena:
- Permiso de vertimientos: para industrias, urbanizaciones y establecimientos que generen
  aguas residuales con descarga a cuerpos hídricos. Costo: según caudal y carga contaminante.
- Permiso de aprovechamiento forestal: para tala de árboles en predios urbanos o rurales.
  Requisito previo a cualquier construcción que implique remoción de vegetación nativa.
- Concesión de aguas: para uso del recurso hídrico (pozos, derivaciones de ríos, ciénagas).
- Licencia ambiental: para proyectos de mediana o gran escala con impacto ambiental.

Contacto CARDIQUE: Av. Daniel Lemaitre, Manga, Cartagena. cardique@cardique.gov.co
Línea de denuncias ambientales: (605) 660-0900. Las denuncias pueden hacerse de forma anónima.""",
    },
    {
        "name": "Decreto 2591 de 1991 — Acción de Tutela",
        "doc_type": "normativa",
        "locality": None,
        "url": None,
        "summary_text": """Decreto 2591 de 1991 — Reglamentación de la Acción de Tutela (Colombia).

Expedido por el Presidente de la República en ejercicio de las facultades extraordinarias del
artículo transitorio 5° de la Constitución Política. Reglamenta el artículo 86 de la Constitución
que consagra la acción de tutela como mecanismo de protección de derechos fundamentales.

Derechos protegidos por la tutela (artículo 1):
La acción de tutela procede para la protección inmediata de los derechos constitucionales
fundamentales cuando quiera que éstos resulten vulnerados o amenazados por la acción o la
omisión de cualquier autoridad pública. También procede contra particulares encargados de
la prestación de un servicio público, o cuya conducta afecte grave y directamente el interés
colectivo, o cuando el solicitante se halle en estado de subordinación o indefensión.

Derechos fundamentales más comunes en tutelas en Cartagena:
- Salud (Art. 49 CP — fundamental por conexidad): negación de servicios de salud, medicamentos
- Petición (Art. 23 CP): falta de respuesta de entidades públicas en el término legal
- Educación (Art. 67 CP): matrícula de niños en colegios oficiales, acceso a educación
- Vivienda digna (Art. 51 CP — por conexidad): amenaza de desalojo sin reubicación
- Agua potable (por conexidad con salud y vida): corte ilegal de servicio, falta de acceso
- Vida e integridad personal (Art. 11, 12 CP): situaciones de riesgo inminente
- Mínimo vital: cuando se afectan prestaciones o pagos indispensables para la subsistencia

Procedimiento (artículo 10 y siguientes):
- Legitimación: cualquier persona puede interponer tutela, por sí misma o a través de
  apoderado. También el Defensor del Pueblo y los personeros municipales.
- Competencia: cualquier juez o tribunal, sin importar su especialidad. En Cartagena,
  los Juzgados Civiles del Circuito, Juzgados Administrativos y Tribunales.
- Término para decidir: el juez tiene 10 días calendario para fallar (improrrogable).
- Presentación: puede hacerse de forma verbal, escrita, por correo electrónico o de cualquier
  otra forma ante cualquier juzgado del país, sin costo y sin necesidad de abogado.
- Información requerida: nombre e identificación del accionante, derecho vulnerado, entidad
  o persona demandada, hechos que fundamentan la vulneración, pretensión.

Entidades frecuentemente demandadas en tutela en Cartagena:
- Aguas de Cartagena (ACUACAR): por interrupción del servicio de agua potable
- ESE Cartagena de Indias / Hospital Universitario del Caribe: por negación de servicios de salud
- Secretaría de Educación Distrital: por negación de cupo en colegio oficial
- EMDISALUD / Suras / Nueva EPS y demás EPS: por negación de medicamentos, cirugías, exámenes
- Alcaldía Distrital: por falta de respuesta a derechos de petición, por amenaza de desalojo
- Empresas privadas de servicios públicos: cuando cortan servicios ilegalmente

Impugnación y revisión (artículo 31):
El fallo de tutela puede impugnarse dentro de los 3 días siguientes a su notificación.
Todos los fallos de tutela son enviados a la Corte Constitucional para eventual revisión.

Desacato (artículo 52):
Si la entidad no cumple el fallo, el juez puede imponer sanciones de desacato: multa de hasta
20 salarios mínimos y arresto hasta de 6 meses al responsable de la entidad incumplidora.""",
    },
]


# ──────────────────────────────────────────────────────────────────────────────
# Utilidades de chunking
# ──────────────────────────────────────────────────────────────────────────────

def chunk_text(text: str, size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    """Divide el texto en chunks con solapamiento para indexación RAG."""
    text = re.sub(r"\n{3,}", "\n\n", text.strip())
    text = re.sub(r" {2,}", " ", text)

    chunks: list[str] = []
    start = 0
    while start < len(text):
        end = min(start + size, len(text))
        if end < len(text):
            last_newline = text.rfind("\n", start, end)
            if last_newline > start + size // 2:
                end = last_newline
        chunks.append(text[start:end].strip())
        start = end - overlap

    return [c for c in chunks if len(c) > 50]


def make_doc_id(doc_name: str, chunk_index: int, chunk_text_prefix: str) -> str:
    """Genera un ID determinístico para un chunk de documento."""
    key = f"{doc_name}:{chunk_index}:{chunk_text_prefix[:80]}"
    return hashlib.sha256(key.encode()).hexdigest()[:32]


# ──────────────────────────────────────────────────────────────────────────────
# Lógica de indexación
# ──────────────────────────────────────────────────────────────────────────────

async def index_document(doc: dict, dry_run: bool = False) -> int:
    """
    Indexa un documento (por summary_text) en Pinecone.
    Retorna el número de chunks indexados.
    """
    name: str = doc["name"]
    doc_type: str = doc["doc_type"]
    locality: str | None = doc.get("locality")
    text: str = doc.get("summary_text", "")

    if not text:
        logger.warning("[seed] '%s' no tiene summary_text — omitido", name)
        return 0

    chunks = chunk_text(text)
    if not chunks:
        logger.warning("[seed] '%s' no produjo chunks — omitido", name)
        return 0

    logger.info("[seed] '%s' → %d chunks (tipo: %s, locality: %s)", name, len(chunks), doc_type, locality or "global")

    if dry_run:
        for i, chunk in enumerate(chunks):
            logger.info("  [dry-run] chunk %d/%d: %.80s…", i + 1, len(chunks), chunk.replace("\n", " "))
        return len(chunks)

    # Preparar el lote para upsert_batch
    items: list[tuple[str, str, dict]] = []
    for i, chunk in enumerate(chunks):
        doc_id = make_doc_id(name, i, chunk)
        metadata: dict = {
            "source": name,
            "doc_type": doc_type,
            "chunk_index": i,
            "total_chunks": len(chunks),
        }
        if locality:
            metadata["locality"] = locality
        items.append((doc_id, chunk, metadata))

    indexed = await rag_pipeline.upsert_batch(items)
    logger.info("[seed] '%s' → %d/%d chunks indexados", name, indexed, len(chunks))
    return indexed


async def seed_all(dry_run: bool = False, doc_name: str | None = None) -> dict[str, int]:
    """
    Indexa todos los documentos canónicos (o solo el especificado por nombre).

    Returns:
        Diccionario con los resultados por documento: {nombre: chunks_indexados}
    """
    results: dict[str, int] = {}

    docs_to_index = SEED_DOCUMENTS
    if doc_name:
        docs_to_index = [d for d in SEED_DOCUMENTS if doc_name.lower() in d["name"].lower()]
        if not docs_to_index:
            logger.error("[seed] No se encontró ningún documento que coincida con: '%s'", doc_name)
            available = [d["name"] for d in SEED_DOCUMENTS]
            logger.info("[seed] Documentos disponibles:\n  - %s", "\n  - ".join(available))
            return {}

    if not dry_run and not rag_pipeline.is_available:
        logger.error(
            "[seed] Pinecone no está disponible. "
            "Verifica las variables de entorno PINECONE_API_KEY y PINECONE_INDEX. "
            "Usa --dry-run para simular sin conectar."
        )
        return {}

    for doc in docs_to_index:
        count = await index_document(doc, dry_run=dry_run)
        results[doc["name"]] = count

    total = sum(results.values())
    indexed_docs = sum(1 for v in results.values() if v > 0)
    action = "simularían" if dry_run else "indexados"
    logger.info(
        "[seed] Completado: %d chunks %s en %d/%d documentos",
        total, action, indexed_docs, len(docs_to_index),
    )
    return results


# ──────────────────────────────────────────────────────────────────────────────
# CLI
# ──────────────────────────────────────────────────────────────────────────────

async def main() -> None:
    parser = argparse.ArgumentParser(
        description="Indexa documentos cívicos canónicos de Cartagena en Pinecone (VÉRTICE OS)"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Muestra qué se indexaría sin ejecutar cambios en Pinecone",
    )
    parser.add_argument(
        "--doc",
        default=None,
        metavar="NOMBRE",
        help="Indexar solo el documento cuyo nombre contenga NOMBRE (parcial, sin distinción de mayúsculas)",
    )
    args = parser.parse_args()

    print(f"\n{'[DRY RUN] ' if args.dry_run else ''}VÉRTICE OS — Seed de documentos cívicos de Cartagena")
    print(f"Documentos disponibles: {len(SEED_DOCUMENTS)}")
    if args.doc:
        print(f"Filtrando por: '{args.doc}'")
    print()

    results = await seed_all(dry_run=args.dry_run, doc_name=args.doc)

    if not results:
        sys.exit(1)

    print("\n─── Resumen ───")
    for name, count in results.items():
        status = f"{count} chunks" if count > 0 else "0 chunks (error)"
        print(f"  {'✓' if count > 0 else '✗'} {name}: {status}")
    print(f"\nTotal: {sum(results.values())} chunks {'simulados' if args.dry_run else 'indexados'}")


if __name__ == "__main__":
    asyncio.run(main())
