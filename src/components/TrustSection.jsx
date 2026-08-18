const trustItems = [
  {
    id: 'garantia',
    title: 'Garantía Extendida',
    description:
      'Cobertura por escrito de 6 a 18 meses según categoría, con reparación o reemplazo sin costos ocultos.',
    icon: (
      <path
        d="M12 3l7 3v6c0 4.5-3 8.2-7 9-4-0.8-7-4.5-7-9V6l7-3z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    id: 'envios',
    title: 'Envíos Seguros',
    description:
      'Empaque anti-golpes diseñado para hardware, con rastreo en tiempo real y seguro incluido en cada envío.',
    icon: (
      <>
        <path d="M3 7h11v9H3z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M14 10h4l3 3v3h-7z" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="7" cy="18" r="1.6" />
        <circle cx="17" cy="18" r="1.6" />
      </>
    ),
  },
  {
    id: 'inspeccion',
    title: 'Inspección Certificada',
    description:
      'Cada unidad pasa por un checklist técnico de más de 30 puntos antes de recibir el sello Gaming Solutions.',
    icon: (
      <>
        <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="12" cy="12" r="9" />
      </>
    ),
  },
]

function TrustSection() {
  return (
    <section id="garantia" className="relative py-24 px-6 lg:px-10 bg-base-panel border-y border-base-line">
      <div className="max-w-7xl mx-auto">
        <div className="max-w-2xl mb-16">
          <span className="font-display text-xs sm:text-sm font-bold uppercase tracking-[0.2em] text-purple-400">
            Por qué confiar en nosotros
          </span>
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-white mt-3">
            Transparencia de principio a fin
          </h2>
          <p className="text-slate-400 mt-4 leading-relaxed">
            No vendemos equipos "como se ven". Cada compra viene respaldada por
            documentación técnica real.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {trustItems.map((item) => (
            <div key={item.id} className="flex gap-5">
              <div className="shrink-0 w-14 h-14 bevel-btn bg-base-bg border border-base-line flex items-center justify-center">
                <svg
                  width="26"
                  height="26"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  className="text-cyan-400"
                >
                  {item.icon}
                </svg>
              </div>
              <div>
                <h3 className="font-display text-lg font-bold text-white mb-2">
                  {item.title}
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div id="sobre-nosotros" className="mt-20 grid lg:grid-cols-2 gap-12 items-center pt-4">
          <div>
            <span className="font-display text-xs sm:text-sm font-bold uppercase tracking-[0.2em] text-amber-400">
              Sobre nosotros
            </span>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-white mt-3 mb-5">
              Gamers vendiéndole a gamers
            </h2>
            <p className="text-slate-400 leading-relaxed mb-4">
              Gaming Solutions nació de la frustración de comprar hardware usado
              sin garantías reales. Hoy inspeccionamos, documentamos y respaldamos
              cada consola, laptop y clásico retro que vendemos, con un equipo
              técnico especializado en cada categoría.
            </p>
            <p className="text-slate-400 leading-relaxed">
              Nuestro objetivo no es vender rápido, es vender bien: que cada
              cliente sepa exactamente qué está comprando y cuenta con soporte
              real si algo falla.
            </p>
          </div>
          <div className="bevel-card bg-base-bg border border-base-line p-8">
            <ul className="space-y-5">
              {[
                'Técnicos certificados en reparación de hardware gamer',
                'Historial de servicio disponible para cada unidad vendida',
                'Política de devolución clara dentro de los primeros 7 días',
              ].map((point) => (
                <li key={point} className="flex items-start gap-3">
                  <span className="mt-1 w-2 h-2 shrink-0 bg-cyan-400" />
                  <span className="text-slate-300 text-sm leading-relaxed">{point}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}

export default TrustSection
