import Image from 'next/image'

export default function Logo({ className = 'h-8 w-auto' }: { className?: string }) {
  return (
    <Image
      src="/logo.svg"
      alt="Klia"
      width={365}
      height={182}
      className={className}
      priority
    />
  )
}
