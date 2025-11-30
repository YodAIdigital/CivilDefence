import { cn } from '@/lib/utils'

interface LogoProps {
  className?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showText?: boolean
}

export function Logo({ className, size = 'md', showText = true }: LogoProps) {
  const sizeConfig = {
    sm: {
      container: 'h-7 w-7',
      outerIcon: 'text-[28px]',
      innerIcon: 'text-[20px]',
      textSize: 'text-lg',
      gap: 'gap-1.5'
    },
    md: {
      container: 'h-10 w-10',
      outerIcon: 'text-[40px]',
      innerIcon: 'text-[28px]',
      textSize: 'text-2xl',
      gap: 'gap-2'
    },
    lg: {
      container: 'h-16 w-16',
      outerIcon: 'text-[64px]',
      innerIcon: 'text-[44px]',
      textSize: 'text-4xl',
      gap: 'gap-3'
    },
    xl: {
      container: 'h-24 w-24',
      outerIcon: 'text-[96px]',
      innerIcon: 'text-[68px]',
      textSize: 'text-4xl sm:text-5xl md:text-6xl',
      gap: 'gap-4'
    }
  }

  const config = sizeConfig[size]

  return (
    <div className={cn('flex items-center', config.gap, className)}>
      <div className={cn('relative flex items-center justify-center', config.container)}>
        {/* Dark blue outline shield */}
        <span
          className={cn('material-icons absolute text-[#000542]', config.outerIcon)}
          style={{ WebkitTextStroke: '4px #000542' }}
        >
          shield
        </span>
        {/* Yellow filled shield */}
        <span className={cn('material-icons absolute text-[#FEB100]', config.innerIcon)}>
          shield
        </span>
      </div>
      {showText && (
        <span className={cn('font-bold tracking-tight', config.textSize)}>
          <span className="text-foreground font-normal">Civil</span>
          <span className="text-[#FEB100] font-bold">Defence</span>
        </span>
      )}
    </div>
  )
}