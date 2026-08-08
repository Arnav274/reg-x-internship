import { useEffect, useRef, useState } from "react";
import { useAuthContext } from "../hooks/useAuthContext";
import { classifyText } from "../api/classifyApi";
import { TicketCategory } from "../api/ticketsApi";

const CATEGORIES: TicketCategory[] = ["High", "Medium", "Low", "Suggestion", "Request"];
const DEBOUNCE_MS = 500;

export interface CategorySelectorProps {
  issueDescription: string;
  value: TicketCategory | "";
  onChange: (category: TicketCategory) => void;
}

export function CategorySelector({ issueDescription, value, onChange }: CategorySelectorProps) {
  const { token } = useAuthContext();
  const [status, setStatus] = useState<"idle" | "loading">("idle");

  const hasManualOverrideRef = useRef(false);
  const requestIdRef = useRef(0);
  const onChangeRef = useRef(onChange);
  const tokenRef = useRef(token);
  onChangeRef.current = onChange;
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
