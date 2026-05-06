import { Button } from "./Button";
import { Modal } from "./Modal";

interface Props {
  open: boolean;
  onAcknowledge: () => void;
  onClearHistory: () => void;
}

export function QuotaExceededModal({ open, onAcknowledge, onClearHistory }: Props) {
  return (
    <Modal
      open={open}
      forceAcknowledge
      title="Browser storage is full"
      labelledBy="quota-modal-title"
    >
      <p>
        This app stores your in-progress game and game history on this device.
        Your browser&rsquo;s storage for this site is full, so the latest write
        could not be saved.
      </p>
      <p>
        Clearing the game history will free space and let the app keep saving
        your current game. This action cannot be undone.
      </p>
      <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
        <Button variant="danger" onClick={onClearHistory}>
          Clear history
        </Button>
        <Button variant="secondary" onClick={onAcknowledge}>
          Acknowledge
        </Button>
      </div>
    </Modal>
  );
}
