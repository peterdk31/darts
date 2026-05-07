import styles from "./IntentChooser.module.css";

interface Props {
  candidates: ReadonlyArray<{ intent: string; label: string }>;
  onChoose: (intent: string) => void;
}

export function IntentChooser({ candidates, onChoose }: Props) {
  return (
    <div className={styles.chooser}>
      <p className={styles.prompt}>Where to apply?</p>
      <div className={styles.buttons}>
        {candidates.map((c) => (
          <button
            key={c.intent}
            type="button"
            className={styles.choiceBtn}
            onClick={() => onChoose(c.intent)}
          >
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );
}
