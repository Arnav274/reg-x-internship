import { useState } from "react";
import { useAuthContext } from "../hooks/useAuthContext";
import { createTicket, PRODUCT_NAMES, ProductName, TicketCategory } from "../api/ticketsApi";
import { AiModeToggle } from "./AiModeToggle";

type SubmitStatus = "idle" | "submitting" | "success" | "error";

export interface ManualModeFormProps {
  // The page the widget was opened on, or null when it is not a product page.
  detectedProduct: ProductName | null;
  aiModeEnabled: boolean;
  onAiModeChange: (enabled: boolean) => void;
}

export function ManualModeForm({
  detectedProduct,
  aiModeEnabled,
  onAiModeChange,
}: ManualModeFormProps) {
  const { username, email, token } = useAuthContext();

  const [productName, setProductName] = useState<string>(PRODUCT_NAMES[0]);
  const [category, setCategory] = useState<TicketCategory | "">("");
  // What the AI actually proposed, kept separate from `category` so a user
  // override doesn't erase it, since that difference is the override-rate metric.
  const [aiSuggestedCategory, setAiSuggestedCategory] = useState<TicketCategory | null>(null);
  const [issueDescription, setIssueDescription] = useState("");
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const isSubmitDisabled =
    issueDescription.trim().length === 0 || category === "" || status === "submitting";

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (category === "") {
      return; // narrows the type; the submit button is disabled in this state
    }

    setStatus("submitting");
    setErrorMessage("");

    try {
      await createTicket(
        {
          // A detected page always wins over the dropdown's state: product_name
          // records where the user actually was, so it must not be overridable
          // even if the control were somehow rendered alongside a detection.
          product_name: detectedProduct ?? productName,
          category,
          issue_description: issueDescription,
          // AI off means the ticket took the manual path, so no suggestion is
          // claimed even if one was received before the toggle was flipped.
          ai_suggested_category: aiModeEnabled ? aiSuggestedCategory : null,
          ai_mode_enabled: aiModeEnabled,
        },
        token
      );
      setStatus("success");
      setIssueDescription("");
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Failed to submit ticket");
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <p>
        Submitting as: {username} ({email})
      </p>

      {detectedProduct === null ? (
        <>
          <label htmlFor="product-name">Product</label>
          <select
            id="product-name"
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
          >
            {PRODUCT_NAMES.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </>
      ) : (
        <p>Product: {detectedProduct}</p>
      )}

      <AiModeToggle
        aiModeEnabled={aiModeEnabled}
        onAiModeChange={onAiModeChange}
        issueDescription={issueDescription}
        value={category}
        onChange={setCategory}
        onAiSuggestion={setAiSuggestedCategory}
      />

      <label htmlFor="issue-description">Describe the issue</label>
      <textarea
        id="issue-description"
        value={issueDescription}
        onChange={(e) => setIssueDescription(e.target.value)}
      />

      <button type="submit" disabled={isSubmitDisabled}>
        Submit
      </button>

      {status === "success" && <p>Ticket submitted successfully.</p>}
      {status === "error" && <p role="alert">{errorMessage}</p>}
    </form>
  );
}
