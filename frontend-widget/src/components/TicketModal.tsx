import { useState } from "react";
import { ManualModeForm } from "./ManualModeForm";

export function TicketModal() {
  const [isOpen, setIsOpen] = useState(false);
  // Deliberately outside the isOpen subtree: closing unmounts the form, which
  // is what discards its content (M2-5), but AI mode is a user preference
  // rather than form content, so it survives close/reopen for this session.
  const [aiModeEnabled, setAiModeEnabled] = useState(true);

  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)}>
        Report an Issue
      </button>

      {isOpen && (
        <div role="dialog" aria-modal="true">
          <button type="button" aria-label="Close" onClick={() => setIsOpen(false)}>
            ×
          </button>
          <ManualModeForm
            aiModeEnabled={aiModeEnabled}
            onAiModeChange={setAiModeEnabled}
          />
        </div>
      )}
    </>
  );
}
