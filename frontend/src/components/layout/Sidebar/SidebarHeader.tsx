import { Calendar as CalendarIcon } from 'lucide-react'

export function SidebarHeader() {
  return (
    <>
      {/* Desktop Header */}
      <div className="hidden px-2 pb-2 pt-3 sm:px-3 sm:pb-3 sm:pt-4 md:block md:px-5 md:pb-5 md:pt-7">
        <div className="rounded-lg border border-primary-500/20 bg-primary-500/10 p-2 text-center text-[9px] text-primary-100 sm:rounded-xl sm:p-2.5 sm:text-[10px] md:rounded-2xl md:p-3.5 md:text-xs">
          <img
            src="/brightworkslogo.png"
            alt="Bright Works"
            className="mx-auto h-12 w-12 rounded-full border border-primary-500/40 object-cover sm:h-14 sm:w-14 md:h-16 md:w-16 lg:h-20 lg:w-20"
            loading="eager"
            decoding="async"
          />
          <div className="mt-1.5 flex items-center justify-center gap-1.5 text-primary-200 sm:mt-2 sm:gap-2">
            <CalendarIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4" />
            <div>
              <p className="text-xs font-semibold tracking-tight text-white sm:text-sm md:text-base">
                Bright Works
              </p>
              <p className="text-[8px] uppercase tracking-wide text-primary-200 sm:text-[9px] md:text-[10px]">
                Professional Control
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Header */}
      <div className="block px-2 pb-2 pt-3 sm:px-2.5 sm:pb-2.5 sm:pt-3.5 md:hidden">
        <div className="flex items-center gap-2 rounded-md border border-primary-500/20 bg-primary-500/10 px-2 py-1.5 sm:gap-2.5 sm:rounded-lg sm:px-2.5 sm:py-2">
          <img
            src="/brightworkslogo.png"
            alt="Bright Works"
            className="h-7 w-7 flex-shrink-0 rounded-full border border-primary-500/40 object-cover sm:h-8 sm:w-8"
            loading="eager"
            decoding="async"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[10px] font-semibold leading-tight text-white sm:text-xs">
              Bright Works
            </p>
            <p className="truncate text-[7px] uppercase tracking-[0.28em] text-primary-200/80 sm:text-[8px]">
              Professional Control
            </p>
          </div>
        </div>
      </div>
    </>
  )
}

