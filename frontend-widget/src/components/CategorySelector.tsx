import { useEffect, useRef, useState } from "react";
import { useAuthContext } from "../hooks/useAuthContext";
import { classifyText } from "../api/classifyApi";
import { CATEGORIES, TicketCategory } from "../api/ticketsApi";

const DEBOUNCE_MS = 500;

export interface CategorySelectorProps {
  issueDescription: string;
  value: TicketCategory | "";
  onChange: (category: TicketCategory) => void;
  // Fires only for AI-originated values, never for manual picks, so callers can
  // record what the AI actually suggested separately from the final choice.
  onAiSuggestion?: (category: TicketCategory) => void;
}

export function CategorySelector({
  issueDescription,
  value,
  onChange,
  onAiSuggestion,
}: CategorySelectorProps) {
  const { token } = useAuthContext();
  const [status, setStatus] = useState<"idle" | "loading">("idle");

  const hasManualOverrideRef = useRef(false);
  const requestIdRef = useRef(0);
  const onChangeRef = useRef(onChange);
  const onAiSuggestionRef = useRef(onAiSuggestion);
  const tokenRef = useRef(token);
  onChangeRef.current = onChange;
  onAiSuggestionRef.current = onAiSuggestion;
  tokenRef.current = token;

  useEffect(() => {
    if (hasManualOverrideRef.current || issueDescription.trim().length === 0) {
      return;
    }

    const timer = setTimeout(() => {
      const requestId = ++requestIdRef.current;
      setStatus("loading");

      classifyText(issueDescription, tokenRef.current)
        .then((category) => {
          if (hasManualOverrideRef.current || requestId !== requestIdRef.current) {
            return;
          }
          onAiSuggestionRef.current?.(category);
          onChangeRef.current(category);
          setStatus("idle");
        })
        .catch(() => {
          if (hasManualOverrideRef.current || requestId !== requestIdRef.current) {
            return;
          }
          setStatus("idle");
        });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [issueDescription]);

  function handleManualChange(event: React.ChangeEvent<HTMLSelectElement>) {
    hasManualOverrideRef.current = true;
    setStatus("idle");
    onChange(event.target.value as TicketCategory);
  }

  return (
    <div>
      <label htmlFor="ai-category">Category</label>
      <select id="ai-category" value={value} onChange={handleManualChange}>
        <option value="" disabled>
          Select a category
        </option>
        {CATEGORIES.map((category) => (
          <option key={category} value={category}>
            {category}
          </option>
        ))}
      </select>
      {status === "loading" && <p>Suggesting category…</p>}
    </div>
  );
}
