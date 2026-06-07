import Link from 'next/link'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost'
  href?: string
  children: React.ReactNode
}

export default function Button({ variant = 'primary', href, children, className, ...props }: ButtonProps) {
  const cls = `btn-${variant}${className ? ` ${className}` : ''}`
  if (href) return <Link href={href} className={cls}>{children}</Link>
  return <button className={cls} {...props}>{children}</button>
}
