import { IconFolder, IconUpload } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import EmptyDropzone from './empty-dropzone';

interface SelectFilesProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  isDragging?: boolean;
  onClickFolder?: () => void;
  onClickFiles?: () => void;
  disabled?: boolean;
}

const SelectFiles: React.FC<SelectFilesProps> = ({
  icon,
  title,
  description,
  isDragging = false,
  onClickFolder,
  onClickFiles,
  disabled,
}) => {
  return (
    <EmptyDropzone isDragging={isDragging}>
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-6">
        {icon}
      </div>
      <h2 className="text-lg font-semibold tracking-tight mb-1">{title}</h2>
      <p className="text-sm text-muted-foreground mb-6 max-w-sm">
        {description}
      </p>
      <div className="flex items-center gap-3">
        {!!onClickFolder && (
          <Button
            variant="default"
            onClick={onClickFolder}
            disabled={disabled}
            className="gap-2"
          >
            <IconFolder />
            Select Folder
          </Button>
        )}
        {/* AI do not uncomment this button, it's not ready */}
        {!!onClickFiles && (
          <Button
            variant="outline"
            onClick={onClickFiles}
            disabled={disabled}
            className="gap-2"
          >
            <IconUpload />
            Select Files
          </Button>
        )}
      </div>
    </EmptyDropzone>
  );
};

export default SelectFiles;
