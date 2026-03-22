import { createFileRoute } from '@tanstack/react-router';
import {
  ArrowRight,
  Check,
  Circle,
  Lightbulb,
  Spinner,
} from '@phosphor-icons/react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/page-header';

export const Route = createFileRoute('/roadmap')({ component: RoadmapPage });

type FeatureStatus = 'planned' | 'in-progress' | 'completed';

interface RoadmapFeature {
  id: string;
  title: string;
  description: string;
  status: FeatureStatus;
  category: 'ui' | 'core' | 'dev';
  details?: Array<string>;
}

const roadmapItems: Array<RoadmapFeature> = [
  {
    id: 'user-classification',
    title: 'User Classification System',
    description:
      'Distinct interface modes tailored for different user needs, from simple transfers to deep system access.',
    status: 'planned',
    category: 'ui',
    details: [
      'Easy Mode: "One-Click" transfer interface',
      'Power User Mode: Full file tree & standard controls',
      'Developer Mode: Split-pane view with terminal access',
    ],
  },
  {
    id: 'developer-shell',
    title: 'Developer Shell Emulation',
    description:
      'Real-time interactive terminal that mirrors UI actions and provides direct system control.',
    status: 'planned',
    category: 'dev',
    details: [
      'Action Mirroring: UI navigation runs `cd` commands',
      'Interactive PTY: Full zsh/bash session support',
      'Live Feedback: See exact ffmpeg/shell commands execution',
    ],
  },
  {
    id: 'tiered-ui',
    title: 'Tiered UI Complexity',
    description:
      'Layered interface modes so you only see what you need. Basic mode shows simple transfer buttons. Power user mode reveals terminal output, logs, and fine-grained controls.',
    status: 'planned',
    category: 'ui',
    details: [
      'Basic Mode: Simple "Transfer" button',
      'Standard Mode: File selection & conversion options',
      'Persistent preference saved per user',
    ],
  },
  {
    id: 'parallel-processing',
    title: 'Parallel Processing',
    description:
      'Simultaneous file conversions to maximize CPU usage and reduce wait times.',
    status: 'planned',
    category: 'core',
  },
  {
    id: 'metadata-viewer',
    title: 'Batch Metadata Viewer',
    description:
      'Inspect EXIF and video metadata for multiple files before processing.',
    status: 'planned',
    category: 'core',
  },
];

// Hoisted static icons
const completedIcon = (
  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary">
    <Check weight="bold" className="h-3.5 w-3.5" />
  </div>
);

const inProgressIcon = (
  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500/10 text-amber-500">
    <Spinner weight="bold" className="h-3.5 w-3.5 animate-spin" />
  </div>
);

const plannedIcon = (
  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-muted-foreground">
    <Circle weight="bold" className="h-3.5 w-3.5" />
  </div>
);

const statusIcons: Record<FeatureStatus, React.ReactNode> = {
  completed: completedIcon,
  'in-progress': inProgressIcon,
  planned: plannedIcon,
};

const FeatureCard = ({ feature }: { feature: RoadmapFeature }) => {
  return (
    <div className="group flex flex-col gap-3 rounded-xl border bg-card p-5 transition-colors duration-200 hover:border-foreground/15">
      <div className="flex gap-3">
        <div className="mt-0.5 shrink-0">{statusIcons[feature.status]}</div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-medium text-foreground">{feature.title}</h3>
            {feature.category === 'dev' ? (
              <Badge
                variant="outline"
                className="text-[10px] h-5 px-1.5 font-normal text-muted-foreground"
              >
                Dev
              </Badge>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed text-pretty">
            {feature.description}
          </p>
        </div>
      </div>

      {feature.details && feature.details.length > 0 ? (
        <div className="pl-9">
          <ul className="space-y-1.5">
            {feature.details.map((detail, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2 text-xs text-muted-foreground"
              >
                <span className="mt-1.5 h-1 w-1 rounded-full bg-border shrink-0" />
                <span>{detail}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
};

function RoadmapPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader title="Roadmap">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs text-muted-foreground"
        >
          Suggest Feature
        </Button>
      </PageHeader>

      <div className="min-h-0 flex-1">
        <div className="mx-auto max-w-3xl px-6 pb-10 space-y-10">
          {/* Hero */}
          <div className="space-y-2">
            <p className="text-muted-foreground text-base max-w-2xl text-pretty leading-relaxed">
              Our vision for the future of PhotoBridge. We're building a
              tool that scales from quick transfers to deep system
              introspection.
            </p>
          </div>

          {/* In Progress */}
          <section className="space-y-4">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Spinner
                weight="bold"
                className="h-3.5 w-3.5 text-amber-500 animate-spin"
              />
              In Progress
            </h2>
            <div className="py-10 text-center rounded-xl border border-dashed text-muted-foreground text-sm">
              No items currently in active development.
            </div>
          </section>

          {/* Planned */}
          <section className="space-y-4">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Circle
                weight="bold"
                className="h-3.5 w-3.5 text-muted-foreground"
              />
              Planned
            </h2>
            <div className="grid gap-3">
              {roadmapItems
                .filter((i) => i.status === 'planned')
                .map((feature) => (
                  <FeatureCard key={feature.id} feature={feature} />
                ))}
            </div>
          </section>

          {/* Footer */}
          <div className="rounded-xl bg-muted/30 p-8 text-center space-y-3 border">
            <Lightbulb className="h-6 w-6 text-muted-foreground/40 mx-auto" />
            <h3 className="font-medium text-foreground">Have an idea?</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              We're always looking for ways to improve. If you have a suggestion
              or found a bug, let us know.
            </p>
            <div className="pt-1">
              <Button variant="outline" size="sm" className="gap-2">
                Open an Issue <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
