import { Button } from "@/shared/components/Button";
import { Modal } from "@/shared/components/Modal";

interface Props {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function AbandonConfirmModal({ open, onConfirm, onCancel }: Props) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title="Abandon current game?"
      labelledBy="abandon-modal-title"
    >
      <p>
        A game is in progress. Starting a new game will discard the current
        match without saving it to history. This cannot be undone.
      </p>
      <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
        <Button variant="danger" onClick={onConfirm}>
          Abandon &amp; start new
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </Modal>
  );
}
