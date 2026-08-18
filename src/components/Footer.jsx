function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer id="contacto" className="bg-base-bg border-t border-base-line px-6 lg:px-10 pt-16 pb-8">
      <div className="max-w-7xl mx-auto grid sm:grid-cols-2 lg:grid-cols-4 gap-10">
        <div className="lg:col-span-1">
          <a href="#inicio" className="flex items-center gap-2 font-display text-xl font-bold mb-4">
            <span className="w-8 h-8 flex items-center justify-center bevel-btn bg-gradient-to-br from-cyan-500 to-purple-600 text-base-bg font-extrabold text-sm">
              GS
            </span>
            <span className="text-white">GAMING <span className="text-cyan-400">SOLUTIONS</span></span>
          </a>
          <p className="text-slate-500 text-sm leading-relaxed">
            Consolas next-gen, laptops gamer y retro restauradas, con garantía
            extendida y transparencia técnica en cada venta.
          </p>
        </div>

        <div>
          <h4 className="font-display font-bold uppercase text-sm tracking-wider text-slate-200 mb-4">
            Navegación
          </h4>
          <ul className="space-y-3 text-sm">
            {[
              { label: 'Inicio', href: '#inicio' },
              { label: 'Categorías', href: '#categorias' },
              { label: 'Garantía', href: '#garantia' },
              { label: 'Sobre Nosotros', href: '#sobre-nosotros' },
            ].map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  onClick={(e) => {
                    e.preventDefault()
                    document.querySelector(link.href)?.scrollIntoView({ behavior: 'smooth' })
                  }}
                  className="text-slate-400 hover:text-cyan-400 transition-colors"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="font-display font-bold uppercase text-sm tracking-wider text-slate-200 mb-4">
            Categorías
          </h4>
          <ul className="space-y-3 text-sm text-slate-400">
            <li>Consolas Next-Gen</li>
            <li>Laptops Gamer</li>
            <li>Retro Restoration</li>
          </ul>
        </div>

        <div>
          <h4 className="font-display font-bold uppercase text-sm tracking-wider text-slate-200 mb-4">
            Contacto
          </h4>
          <ul className="space-y-3 text-sm text-slate-400">
            <li className="flex items-center gap-2">
              <span className="text-cyan-400">✉</span> contacto@gamingsolutions.com
            </li>
            <li className="flex items-center gap-2">
              <span className="text-cyan-400">☎</span> +502 0000-0000
            </li>
            <li className="flex items-center gap-2">
              <span className="text-cyan-400">⌂</span> Ciudad de Guatemala, GT
            </li>
          </ul>
        </div>
      </div>

      <div className="max-w-7xl mx-auto mt-14 pt-6 border-t border-base-line flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
        <p>© {year} Gaming Solutions. Todos los derechos reservados.</p>
        <p className="font-display uppercase tracking-widest text-slate-600">
          Hardware verificado · Garantía por escrito
        </p>
      </div>
    </footer>
  )
}

export default Footer
