export default function GlobalFooter() {
  return (
    <footer className="w-full pt-10 pb-5 bg-[#f7f9fb] mt-auto">
      <div className="flex flex-row justify-between items-center px-8 max-w-7xl mx-auto w-full font-['Inter'] text-[11px] uppercase tracking-[0.05em] text-slate-400">
        <div className="flex items-center space-x-6">
          <span className="text-primary font-bold">© 2026 KLIA Medical</span>
          <nav className="flex items-center space-x-3">
            <span className="text-slate-300">|</span>
            <a
              href="#"
              className="text-slate-400 hover:text-primary-container transition-colors duration-200 cursor-pointer active:scale-[0.98]"
            >
              Centro de Ayuda
            </a>
            <span className="text-slate-300">|</span>
            <a
              href="#"
              className="text-slate-400 hover:text-primary-container transition-colors duration-200 cursor-pointer active:scale-[0.98]"
            >
              Privacidad y Términos
            </a>
          </nav>
        </div>
        <div className="text-slate-300">v2.1.4</div>
      </div>
    </footer>
  )
}
