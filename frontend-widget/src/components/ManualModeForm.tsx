import { useState } from "react";
import { useAuthContext } from "../hooks/useAuthContext";
import { CATEGORIES, createTicket, TicketCategory } from "../api/ticketsApi";

const PRODUCT_NAMES = ["Analytics Hub", "User Portal", "Billing Engine", "Settings Suite"] as const;

type SubmitStatus = "idle" | "submitting" | "success" | "error";

export function ManualModeForm() {
  const { username, email, token } = useAuthContext();

  const [productName, setProductName] = useState<string>(PRODUCT_NAMES[0]);
  const [category, setCategory] = useState<TicketCategory>(CATEGORIES[0]);
  const [issueDescription, setIssueDescription] = useState("");
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const isSubmitDisabled = issueDescription.trim().length === 0 || status === "submitting";

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setStatus("submitting");
    setErrorMessage("");

    try {
      await createTicket(
        { product_name: productName, category, issue_description: issueDescription },
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

      <label htmlFor="category">Category</label>
      <select
        id="category"
        value={category}
        onChange={(e) => setCategory(e.target.value as TicketCategory)}
      >
        {CATEGORIES.map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </select>

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
