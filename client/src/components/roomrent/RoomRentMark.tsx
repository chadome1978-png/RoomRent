type Props = { compact?: boolean };

export function RoomRentMark({ compact = false }: Props) {
  return (
    <div className={`brand-lockup${compact ? " brand-compact" : ""}`} aria-label="RoomRent">
      <svg className="brand-mark" viewBox="0 0 40 40" fill="none" aria-hidden="true">
        <rect x="1" y="1" width="38" height="38" rx="12" fill="currentColor" />
        <path d="M10 18.5 20 10l10 8.5v11H10v-11Z" stroke="#F7F7F4" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M16 29.5v-7h8v7M13.5 20.5h13M14.5 24.5h1" stroke="#F7F7F4" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="14.5" cy="24.5" r="1.2" fill="#C5EDC4" />
      </svg>
      {!compact && <span className="brand-word">Room<span>Rent</span></span>}
    </div>
  );
}
