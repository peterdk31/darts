import { useState, type FormEvent } from "react";
import { Button } from "@/shared/components/Button";
import { useSessionContext } from "@/shell/session/SessionContext";
import { useNavigate } from "@/shared/routing/router";
import styles from "./SessionListPage.module.css";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SessionListPage() {
  const { sessions, openSession, createSession, deleteSession } = useSessionContext();
  const navigate = useNavigate();
  const [name, setName] = useState("");

  function handleCreate(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    createSession(trimmed);
    setName("");
    navigate("/games");
  }

  function handleOpen(id: string) {
    openSession(id);
    navigate("/games");
  }

  function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    deleteSession(id);
  }

  return (
    <div className={styles.page}>
      <header className={styles.headerRow}>
        <h1>Sessions</h1>
        <Button variant="ghost" size="sm" onClick={() => navigate("/players")}>
          Players
        </Button>
      </header>

      <form className={styles.newForm} onSubmit={handleCreate}>
        <input
          className={styles.nameInput}
          type="text"
          placeholder="New session name..."
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        <Button variant="primary" type="submit" disabled={!name.trim()}>
          Create
        </Button>
      </form>

      {sessions.length === 0 ? (
        <p className={styles.empty}>No sessions yet. Create one to get started.</p>
      ) : (
        <ul className={styles.list}>
          {sessions.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className={styles.tile}
                onClick={() => handleOpen(s.id)}
              >
                <div className={styles.tileInfo}>
                  <span className={styles.tileName}>{s.name}</span>
                  <span className={styles.tileDate}>{formatDate(s.createdAt)}</span>
                </div>
                <span
                  className={styles.deleteBtn}
                  role="button"
                  tabIndex={0}
                  onClick={(e) => handleDelete(e, s.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.stopPropagation();
                      deleteSession(s.id);
                    }
                  }}
                >
                  Delete
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
