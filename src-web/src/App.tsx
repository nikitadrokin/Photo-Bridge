const BREW_COMMAND = 'brew install nikitadrokin/tap/photo-bridge';

const features = [
  {
    title: 'Photos',
    description:
      'HEIC to JPG with EXIF intact: GPS, timestamps, camera fields.',
  },
  {
    title: 'Videos',
    description:
      'Remux MOV/HEVC to MP4 (no re-encode). HDR and picture quality stay as-is; audio becomes AAC where the container needs it.',
  },
  {
    title: 'Metadata',
    description:
      'Creation dates follow the real capture time so sorting matches when you actually shot things.',
  },
  {
    title: 'Batch',
    description:
      'Point it at a folder. New files go under _Remuxed; nothing overwrites your originals.',
  },
];

function CopyButton({ text }: { text: string }) {
  const handleCopy = () => {
    void navigator.clipboard.writeText(text);
  };

  return (
    <button
      onClick={handleCopy}
      className='group flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-5 py-3.5 text-left font-mono text-sm text-white/80 transition hover:border-white/20 hover:bg-white/10 hover:text-white'
    >
      <span className='flex-1'>{text}</span>
      <svg
        className='size-4 shrink-0 text-white/40 transition group-hover:text-white/70'
        fill='none'
        viewBox='0 0 24 24'
        stroke='currentColor'
        strokeWidth={1.5}
      >
        <path
          strokeLinecap='round'
          strokeLinejoin='round'
          d='M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184'
        />
      </svg>
    </button>
  );
}

export default function App() {
  return (
    <div className='min-h-screen bg-zinc-950 text-white selection:bg-white/20'>
      {/* Nav */}
      <header className='mx-auto flex max-w-5xl items-center justify-between px-6 py-6'>
        <span className='text-sm font-semibold tracking-tight text-white/90'>
          PhotoBridge
        </span>
        <a
          href='https://github.com/nikitadrokin/photo-bridge'
          target='_blank'
          rel='noreferrer'
          className='flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-white/50 transition hover:text-white/90'
        >
          <svg className='size-4' fill='currentColor' viewBox='0 0 24 24'>
            <path d='M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2Z' />
          </svg>
          GitHub
        </a>
      </header>

      {/* Hero */}
      <main className='mx-auto max-w-5xl px-6 pb-32 pt-20 text-center'>
        <div className='mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs text-white/50'>
          macOS · Free · Open Source
        </div>

        <h1 className='mx-auto mb-6 max-w-2xl text-5xl font-semibold tracking-tight text-white sm:text-6xl'>
          Move your iOS photos to Pixel,{' '}
          <span className='text-white/40'>without the mess.</span>
        </h1>

        <p className='mx-auto mb-12 max-w-xl text-lg text-white/50'>
          PhotoBridge turns HEIC stills and MOV clips into formats Pixel will
          import. Video gets remuxed, not re-encoded, and the metadata survives
          the trip.
        </p>

        <div className='mx-auto mb-4 max-w-md'>
          <CopyButton text={BREW_COMMAND} />
        </div>
        <p className='text-xs text-white/30'>
          Requires Homebrew ·{' '}
          <a
            href='https://github.com/nikitadrokin/Photo-Bridge/releases'
            target='_blank'
            rel='noreferrer'
            className='underline underline-offset-2 transition hover:text-white/50'
          >
            or download directly
          </a>
        </p>
      </main>

      {/* Features */}
      <section className='mx-auto max-w-5xl px-6 pb-32'>
        <div className='grid gap-px rounded-2xl border border-white/10 bg-white/10 overflow-hidden sm:grid-cols-2'>
          {features.map((f) => (
            <div key={f.title} className='bg-zinc-950 p-8'>
              <h3 className='mb-2 text-sm font-semibold text-white'>
                {f.title}
              </h3>
              <p className='text-sm leading-relaxed text-white/50'>
                {f.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className='border-t border-white/5 px-6 py-8 text-center text-xs text-white/25'>
        MIT License ·{' '}
        <a
          href='https://github.com/nikitadrokin/photo-bridge'
          target='_blank'
          rel='noreferrer'
          className='transition hover:text-white/50'
        >
          github.com/nikitadrokin/photo-bridge
        </a>
      </footer>
    </div>
  );
}
