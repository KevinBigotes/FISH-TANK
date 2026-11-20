import { ProfileCard } from '../components/ProfileCard.jsx';
import { useAuth } from '../auth/AuthProvider.jsx';

const content = {
  aquarium: { phase: 3, title: 'Pecera comunitaria', lead: 'Un océano que imaginaremos juntos.', description: 'Aquí cobrarán vida las creaciones de nuestra comunidad. La experiencia en tiempo real llegará en la siguiente etapa de la exposición.' },
  drawing: { phase: 2, title: 'Dibujar', lead: 'Tu próxima idea empieza contigo.', description: 'Aquí podrás dibujar y preparar una creación para compartirla. El espacio de dibujo estará disponible en la próxima etapa.' },
  collection: { phase: 4, title: 'Mi pecera', lead: 'Un lugar para tus descubrimientos.', description: 'Aquí podrás reunir tus peces favoritos, incluidos los de otros creadores. Tu colección personal estará disponible más adelante.' },
};

export function PhasePage({ type }) {
  const page = content[type];
  const { profile } = useAuth();
  return <>
    <p className="eyebrow text-teal">{profile ? `BIENVENIDO, ${profile.username}` : 'BIENVENIDO A LA COMUNIDAD'}</p>
    <h1 className="mt-3 text-4xl font-semibold tracking-tight text-ocean md:text-5xl">{page.title}</h1>
    <div className="mt-9 grid items-start gap-6 lg:grid-cols-[1.25fr_1fr]">
      <section className="phase-panel" aria-labelledby="phase-title">
        <span className="phase-badge">Próximamente · Fase {page.phase}</span>
        <div className="my-10 h-px w-16 bg-seafoam/60" aria-hidden="true" />
        <h2 id="phase-title" className="max-w-md text-3xl font-medium leading-tight">{page.lead}</h2>
        <p className="mt-5 max-w-md leading-relaxed text-white/80">{page.description}</p>
        <p className="mt-10 border-t border-white/20 pt-5 text-sm text-white/75">Tu cuenta ya tiene un lugar en esta historia.</p>
      </section>
      <ProfileCard />
    </div>
  </>;
}
