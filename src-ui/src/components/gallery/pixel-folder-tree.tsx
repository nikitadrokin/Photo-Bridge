import { useMemo, useState } from 'react';
import type { PixelFilePayload } from '@cli-protocol';
import {
  IconChevronRight,
  IconFolderFilled,
  IconMovie,
  IconPhoto,
} from '@tabler/icons-react';
import { VIDEO_EXTENSIONS } from '@/lib/constants';
import { cn } from '@/lib/utils';

interface PixelFolderTreeProps {
  readonly files: readonly PixelFilePayload[];
  readonly selectedPath: string | null;
  readonly onSelectFile: (file: PixelFilePayload) => void;
  readonly className?: string;
}

interface FolderNode {
  readonly type: 'folder';
  readonly name: string;
  readonly path: string;
  readonly children: TreeNode[];
}

interface FileNode {
  readonly type: 'file';
  readonly file: PixelFilePayload;
}

type TreeNode = FolderNode | FileNode;

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

function countFiles(node: FolderNode): number {
  return node.children.reduce(
    (sum, child) =>
      sum + (child.type === 'file' ? 1 : countFiles(child)),
    0,
  );
}

/** Builds a nested folder tree from each file's `relativePath`. */
function buildTree(files: readonly PixelFilePayload[]): TreeNode[] {
  const root: FolderNode = {
    type: 'folder',
    name: '',
    path: '',
    children: [],
  };

  for (const file of files) {
    // Fall back to the basename for payloads from an older CLI without
    // `relativePath`, so a stale sidecar can't crash the tree.
    const relativePath =
      file.relativePath ?? file.path.split('/').pop() ?? file.name;
    const parts = relativePath.split('/');
    const dirs = parts.slice(0, -1);
    let cursor = root;
    for (const dir of dirs) {
      const childPath = cursor.path ? `${cursor.path}/${dir}` : dir;
      let next = cursor.children.find(
        (c): c is FolderNode => c.type === 'folder' && c.name === dir,
      );
      if (!next) {
        next = { type: 'folder', name: dir, path: childPath, children: [] };
        cursor.children.push(next);
      }
      cursor = next;
    }
    cursor.children.push({ type: 'file', file });
  }

  // Folders first (alphabetical); files keep the incoming mtime-desc order.
  const sortNodes = (nodes: TreeNode[]): void => {
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
      if (a.type === 'folder' && b.type === 'folder') {
        return a.name.localeCompare(b.name);
      }
      return 0;
    });
    for (const node of nodes) {
      if (node.type === 'folder') sortNodes(node.children);
    }
  };
  sortNodes(root.children);

  return root.children;
}

function FileIcon({ file }: { readonly file: PixelFilePayload }) {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (VIDEO_EXTENSIONS.includes(ext))
    return <IconMovie size={16} className="text-muted-foreground" />;
  return <IconPhoto size={16} className="text-muted-foreground" />;
}

interface NodeRowsProps {
  readonly nodes: readonly TreeNode[];
  readonly depth: number;
  readonly collapsed: ReadonlySet<string>;
  readonly toggle: (path: string) => void;
  readonly selectedPath: string | null;
  readonly onSelectFile: (file: PixelFilePayload) => void;
}

function NodeRows({
  nodes,
  depth,
  collapsed,
  toggle,
  selectedPath,
  onSelectFile,
}: NodeRowsProps) {
  return (
    <>
      {nodes.map((node) => {
        const indent = { paddingLeft: `${depth * 16 + 8}px` };
        if (node.type === 'folder') {
          const isExpanded = !collapsed.has(node.path);
          return (
            <div key={`dir:${node.path}`}>
              <button
                type="button"
                aria-expanded={isExpanded}
                className="flex w-full items-center gap-2 py-2 pr-3 text-left hover:bg-accent"
                style={indent}
                onClick={() => {
                  toggle(node.path);
                }}
              >
                <IconChevronRight
                  size={16}
                  className={cn(
                    'shrink-0 text-muted-foreground transition-transform',
                    isExpanded && 'rotate-90',
                  )}
                />
                <IconFolderFilled size={16} className="shrink-0 text-primary/70" />
                <span className="truncate font-medium">{node.name}</span>
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                  {countFiles(node)}
                </span>
              </button>
              {isExpanded ? (
                <NodeRows
                  nodes={node.children}
                  depth={depth + 1}
                  collapsed={collapsed}
                  toggle={toggle}
                  selectedPath={selectedPath}
                  onSelectFile={onSelectFile}
                />
              ) : null}
            </div>
          );
        }

        const isSelected = node.file.path === selectedPath;
        return (
          <button
            key={`file:${node.file.path}`}
            type="button"
            className={cn(
              'flex w-full items-center gap-2 py-2 pr-3 text-left hover:bg-accent',
              isSelected && 'bg-accent',
            )}
            style={indent}
            onClick={() => {
              onSelectFile(node.file);
            }}
          >
            <span className="w-4 shrink-0" />
            <FileIcon file={node.file} />
            <span className="truncate font-medium">{node.file.name}</span>
            <span className="ml-auto shrink-0 text-xs tabular-nums text-muted-foreground">
              {formatBytes(node.file.sizeBytes)}
            </span>
          </button>
        );
      })}
    </>
  );
}

const PixelFolderTree: React.FC<PixelFolderTreeProps> = ({
  files,
  selectedPath,
  onSelectFile,
  className,
}) => {
  const nodes = useMemo(() => buildTree(files), [files]);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());

  const toggle = (path: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  return (
    <div
      className={cn(
        'overflow-y-auto overflow-x-hidden overscroll-y-contain rounded-lg border text-sm',
        className,
      )}
    >
      <NodeRows
        nodes={nodes}
        depth={0}
        collapsed={collapsed}
        toggle={toggle}
        selectedPath={selectedPath}
        onSelectFile={onSelectFile}
      />
    </div>
  );
};

export default PixelFolderTree;
