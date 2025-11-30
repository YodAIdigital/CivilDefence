import { cn } from '@/lib/utils'

interface HomeLogoProps {
  className?: string
}

export function HomeLogo({ className }: HomeLogoProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="relative flex items-center justify-center" style={{ width: '90px', height: '90px' }}>
        {/* Dark blue outline shield */}
        <span
          className="material-icons absolute text-[#000542]"
          style={{
            fontSize: '90px',
            WebkitTextStroke: '1.5px #000542'
          }}
        >
          shield
        </span>
        {/* Yellow filled shield */}
        <span
          className="material-icons absolute text-[#FEB100]"
          style={{ fontSize: '65px' }}
        >
          shield
        </span>
      </div>
      <span className="font-bold tracking-tight text-4xl sm:text-5xl md:text-6xl">
        <span className="text-[#000542] font-normal">Civil</span>
        <span className="text-[#FEB100] font-bold">Defence</span>
      </span>
    </div>
  )
}
