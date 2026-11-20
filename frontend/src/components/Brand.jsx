import { Link } from 'react-router-dom';

export function Brand({ light = false }) {
  return <Link to="/pecera" className={`brand ${light ? 'text-white' : 'text-ocean'}`} aria-label="SOAYLEMER, inicio">
    <svg aria-hidden="true" viewBox="0 0 40 40" fill="none" className="h-10 w-10 shrink-0">
      <rect x="1" y="1" width="38" height="38" rx="13" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 16c4-7 12 7 24 0M8 23c4-7 12 7 24 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
    <span>SOAYLEMER<span className="brand-subtitle">UN OCÉANO DE IDEAS</span></span>
  </Link>;
}
