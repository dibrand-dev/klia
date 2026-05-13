type Props = {
  initials: string
  name: string
  subtitle: string
  avatarUrl?: string | null
}

export default function SidebarUserCard({ initials, name, subtitle, avatarUrl }: Props) {
  return (
    <div className="bg-surface-container-low mb-6 p-4 rounded-xl flex items-center gap-3">
      <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm shrink-0 select-none overflow-hidden">
        {avatarUrl
          /* eslint-disable-next-line @next/next/no-img-element */
          ? <img src={avatarUrl} alt={name} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
          : initials.toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm text-primary truncate">{name}</p>
        <p className="text-xs text-on-surface-variant truncate">{subtitle}</p>
      </div>
    </div>
  )
}
