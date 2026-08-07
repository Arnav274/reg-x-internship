import { useState } from "react";
import { ManualModeForm } from "./ManualModeForm";

export function TicketModal() {
  const [isOpen, setIsOpen] = useState(false);

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
          <ManualModeForm />
        </div>
      )}
    </>
  );
}
