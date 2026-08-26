import { useState } from 'react';
import { toast } from 'sonner';
import { Trash2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';

const PREFIX = 'testFixProgress';

function ClearLocalStorageButton() {
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleClearLocalStorage = () => {
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith(PREFIX)) {
        localStorage.removeItem(key);
      }
    });
    toast.success('All loaded test data for this application has been cleared from local storage');
    window.location.reload();
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setConfirmOpen(true)}>
        <Trash2Icon className="size-4" />
        Clear Test Data
      </Button>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Clear all local test data?"
        description="This permanently removes the loaded results and every failure-resolution note, assignee, and status stored in this browser. This can't be undone."
        confirmLabel="Clear data"
        variant="destructive"
        onConfirm={handleClearLocalStorage}
      />
    </>
  );
}

export default ClearLocalStorageButton;
