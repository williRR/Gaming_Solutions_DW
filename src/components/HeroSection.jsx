function HeroSection() {
  const scrollTo = (e, href) => {
    e.preventDefault()
    document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <section
      id="inicio"
      className="relative flex items-center min-h-screen pt-28 pb-20 px-6 lg:px-10 overflow-hidden"
    >
      {/* Fondo: grid técnico + glows */}
      <div className="absolute inset-0 bg-grid-pattern bg-grid opacity-70 pointer-events-none" />
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 -right-32 w-[28rem] h-[28rem] bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />

      {/* Línea de escaneo sutil, respeta prefers-reduced-motion vía CSS global */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
        <div className="w-full h-24 bg-gradient-to-b from-transparent via-cyan-400/40 to-transparent animate-scan" />
      </div>

      <div className="relative max-w-7xl mx-auto grid lg:grid-cols-2 gap-14 items-center w-full">
        <div>
          <span className="inline-flex items-center gap-2 font-display text-xs sm:text-sm font-bold uppercase tracking-[0.2em] text-amber-400 border border-amber-400/40 px-4 py-1.5 mb-6 bevel-btn">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse-slow" />
            Garantía extendida certificada
          </span>

          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.05] text-white mb-6">
            Equipo gamer real,
            <br />
            <span className="bg-gradient-to-r from-cyan-400 via-cyan-300 to-purple-500 bg-clip-text text-transparent">
              revisado pieza por pieza.
            </span>
          </h1>

          <p className="text-slate-300 text-base sm:text-lg max-w-xl mb-10 leading-relaxed">
            Vendemos consolas de última generación, laptops gamer de alto rendimiento
            y clásicos retro restaurados con transparencia total: cada equipo se
            inspecciona, se documenta y sale con garantía extendida por escrito.
            Sin sorpresas, sin letra pequeña.
          </p>

          <div className="flex flex-col sm:flex-row gap-4">
            <a
              href="#categorias"
              onClick={(e) => scrollTo(e, '#categorias')}
              className="bevel-btn inline-flex justify-center items-center px-7 py-3.5 font-display font-bold uppercase tracking-wider bg-cyan-500 text-base-bg hover:bg-cyan-400 hover:shadow-glow-cyan transition-all"
            >
              Ver catálogo
            </a>
            <a
              href="#garantia"
              onClick={(e) => scrollTo(e, '#garantia')}
              className="bevel-btn inline-flex justify-center items-center px-7 py-3.5 font-display font-bold uppercase tracking-wider border border-purple-500 text-purple-300 hover:bg-purple-600/20 hover:shadow-glow-purple transition-all"
            >
              Cómo funciona la garantía
            </a>
          </div>

          <div className="mt-12 grid grid-cols-3 gap-6 max-w-md">
            <div>
              <p className="font-display text-2xl sm:text-3xl font-bold text-white">12 meses</p>
              <p className="text-xs uppercase tracking-wider text-slate-400 mt-1">Garantía mínima</p>
            </div>
            <div>
              <p className="font-display text-2xl sm:text-3xl font-bold text-white">100%</p>
              <p className="text-xs uppercase tracking-wider text-slate-400 mt-1">Inspección técnica</p>
            </div>
            <div>
              <p className="font-display text-2xl sm:text-3xl font-bold text-white">+30</p>
              <p className="text-xs uppercase tracking-wider text-slate-400 mt-1">Puntos revisados</p>
            </div>
          </div>
        </div>

        {/* Panel visual del hero: silueta de "carcasa" con datos técnicos, sin depender de imágenes externas */}
        <div className="relative mx-auto w-full max-w-md">
          <div className="bevel-card bg-base-panel border border-base-line p-8 shadow-glow-cyan">
            <div className="flex items-center justify-between mb-6 font-display text-xs uppercase tracking-widest text-cyan-400">
              <span>Unidad #GS-2201</span>
              <span className="flex items-center gap-1 text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Aprobado
              </span>
            </div>

            <div className="space-y-4">
              {[
                { label: 'Hardware original', value: 100 },
                { label: 'Estado estético', value: 92 },
                { label: 'Rendimiento térmico', value: 96 },
              ].map((item) => (
                <div key={item.label}>
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>{item.label}</span>
                    <span className="text-cyan-300 font-semibold">{item.value}%</span>
                  </div>
                  <div className="h-1.5 bg-base-bg overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-500 to-purple-500"
                      style={{ width: `${item.value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 pt-6 border-t border-base-line flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400">Cobertura</p>
                <p className="font-display font-bold text-amber-400">Garantía extendida</p>
              </div>
              <span className="bevel-btn px-3 py-1.5 text-xs font-display font-bold bg-purple-600/20 text-purple-300 border border-purple-500/40">
                Certificado #GS
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default HeroSection
