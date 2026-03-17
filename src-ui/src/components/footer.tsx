import { useEffect, useState } from 'react';
import { getVersion } from '@tauri-apps/api/app';
import { GithubLogo } from '@phosphor-icons/react';

const Footer: React.FC = () => {
  const [version, setVersion] = useState<string>('');

  useEffect(() => {
    getVersion()
      .then(setVersion)
      .catch(() => setVersion('dev'));
  }, []);

  return (
    <footer className="w-full max-w-2xl mt-auto pt-8 pb-4 text-center text-sm text-muted-foreground">
      <div className="flex items-center justify-center gap-4 flex-wrap">
        <span>
          Made with 🫶🏻 by{' '}
          <a
            href="https://github.com/nikitadrokin"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Nikita
          </a>
        </span>
        <span className="text-muted-foreground">•</span>
        <a
          href="https://github.com/nikitadrokin/iphone-to-pixel"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-primary hover:underline"
        >
          <GithubLogo size={16} />
          Repository
        </a>
        {version && (
          <>
            <span className="text-muted-foreground">•</span>
            <span className="text-muted-foreground">v{version}</span>
          </>
        )}
      </div>
    </footer>
  );
};

export default Footer;
