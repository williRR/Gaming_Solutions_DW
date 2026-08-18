const categories = [
  {
    id: 'next-gen',
    tag: 'Consolas Next-Gen',
    title: 'Última generación, listas para jugar',
    description:
      'Consolas selladas y de reventa verificada, probadas en laboratorio antes de salir a la venta. Incluyen accesorios originales.',
    accent: 'cyan',
    stats: [
      { label: 'Verificación', value: 'Sello + firmware' },
      { label: 'Garantía', value: '12 meses' },
    ],
  },
  {
    id: 'laptops',
    tag: 'Laptops Gamer',
    title: 'Potencia real para cada frame',
    description:
      'Equipos de alto rendimiento con pruebas de estrés térmico, GPU y batería. Ideales para gaming competitivo y producción creativa.',
    accent: 'purple',
    stats: [
      { label: 'Pruebas', value: 'Stress test GPU/CPU' },
      { label: 'Garantía', value: '18 meses' },
    ],
  },
  {
    id: 'retro',
    tag: 'Retro Restoration',
    title: 'Clásicos restaurados a mano',
    description:
      'Consolas retro recapacitadas, con carcasas restauradas y componentes reemplazados por técnicos especializados en hardware clásico.',
    accent: 'amber',
    stats: [
      { label: 'Restauración', value: 'Recap + limpieza' },
      { label: 'Garantía', value: '6 meses' },
    ],
  },
]

const accentStyles = {
  cyan: {
    text: 'text-cyan-400',
    border: 'border-cyan-500/40',
    bg: 'bg-cyan-500/10',
    button: 'bg-cyan-500 hover:bg-cyan-400 hover:shadow-glow-cyan',
    glow: 'group-hover:shadow-glow-cyan',
  },
  purple: {
    text: 'text-purple-400',
    border: 'border-purple-500/40',
    bg: 'bg-purple-600/10',
    button: 'bg-purple-600 hover:bg-purple-500 hover:shadow-glow-purple',
    glow: 'group-hover:shadow-glow-purple',
  },
  amber: {
    text: 'text-amber-400',
    border: 'border-amber-500/40',
    bg: 'bg-amber-500/10',
    button: 'bg-amber-500 hover:bg-amber-400 hover:shadow-glow-amber',
    glow: 'group-hover:shadow-glow-amber',
  },
}

function CategoriesSection() {
  return (
    <section id="categorias" className="relative py-24 px-6 lg:px-10 bg-base-bg">
      <div className="max-w-7xl mx-auto">
        <div className="max-w-2xl mb-16">
          <span className="font-display text-xs sm:text-sm font-bold uppercase tracking-[0.2em] text-cyan-400">
            Nuestros 3 pilares
          </span>
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-white mt-3">
            Todo el ecosistema gamer, en un solo lugar
          </h2>
          <p className="text-slate-400 mt-4 leading-relaxed">
            Cada categoría tiene su propio proceso de control de calidad, pensado
            para el tipo de hardware que representa.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {categories.map((cat) => {
            const style = accentStyles[cat.accent]
            return (
              <article
                key={cat.id}
                className={`group bevel-card bg-base-panel border ${style.border} p-8 flex flex-col transition-shadow duration-300 ${style.glow}`}
              >
                <span
                  className={`self-start font-display text-xs font-bold uppercase tracking-widest px-3 py-1 mb-6 ${style.bg} ${style.text}`}
                >
                  {cat.tag}
                </span>

                <h3 className="font-display text-xl font-bold text-white mb-3">
                  {cat.title}
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-8 flex-1">
                  {cat.description}
                </p>

                <dl className="grid grid-cols-2 gap-4 mb-8 border-t border-base-line pt-5">
                  {cat.stats.map((stat) => (
                    <div key={stat.label}>
                      <dt className="text-[11px] uppercase tracking-wider text-slate-500">
                        {stat.label}
                      </dt>
                      <dd className={`font-display font-semibold text-sm mt-1 ${style.text}`}>
                        {stat.value}
                      </dd>
                    </div>
                  ))}
                </dl>

                <a
                  href="#sobre-nosotros"
                  onClick={(e) => {
                    e.preventDefault()
                    document.querySelector('#sobre-nosotros')?.scrollIntoView({ behavior: 'smooth' })
                  }}
                  className={`bevel-btn inline-flex justify-center items-center px-5 py-3 font-display font-bold uppercase text-sm tracking-wider text-base-bg transition-all ${style.button}`}
                >
                  Consultar disponibilidad
                </a>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export default CategoriesSection
