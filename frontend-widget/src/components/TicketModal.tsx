import { useState } from "react";
import { ManualModeForm } from "./ManualModeForm";
import { ProductName } from "../api/ticketsApi";
import { detectProductPage } from "../utils/detectProductPage";
import { captureEnvironment } from "../utils/captureEnvironment";

export function TicketModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [detectedProduct, setDetectedProduct] = useState<ProductName | null>(null);
  // Deliberately outside the isOpen subtree: closing unmounts the form, which
  // is what discards its content (M2-5), but AI mode is a user preference
  // rather than form content, so it survives close/reopen for this session.
  const [aiModeEnabled, setAiModeEnabled] = useState(true);

  // Both utils run per open rather than once at mount, because a host SPA can
  // route between product pages without remounting the widget, which would
  // otherwise leave the first page's answer stuck for the whole session. Doing
  // it here rather than in an effect also keeps it to one run per open: an
  // effect keyed on `isOpen` fires twice per open under StrictMode.
  function handleOpen() {
    setDetectedProduct(detectProductPage());

    // The capture itself is unconditional, in every build. FR1.3 requires the
    // widget to query the environment automatically; it says nothing about
    // disclosing it, so gating the call would make the requirement depend on
    // build mode. Only the log is development-only, which is what keeps a real
    // user's browser console from being written to with their user agent.
    //
    // Still diagnostic context only: never rendered to the user, and never added
    // to the request body, which carries exactly the five allowlisted fields.
    const environment = captureEnvironment();
    if (import.meta.env.DEV) {
      console.log("[ticket-widget] environment", environment);
    }

    setIsOpen(true);
  }

  return (
    <>
      <button type="button" onClick={handleOpen}>
        Report an Issue
      </button>

      {isOpen && (
        <div role="dialog" aria-modal="true">
          <button type="button" aria-label="Close" onClick={() => setIsOpen(false)}>
            ×
          </button>
          <ManualModeForm
            detectedProduct={detectedProduct}
            aiModeEnabled={aiModeEnabled}
            onAiModeChange={setAiModeEnabled}
          />
        </div>
      )}
    </>
  );
}
