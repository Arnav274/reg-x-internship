import { useCallback, useEffect, useState } from "react";
import { useAuthContextState } from "../src/hooks/useAuthContext";
import {
  CATEGORIES,
  listTickets,
  PRODUCT_NAMES,
  Ticket,
  TicketCategory,
} from "../src/api/ticketsApi";

type LoadStatus = "loading" | "ready" | "error";

// A date input gives "YYYY-MM-DD". Sent as-is, a `to` of today would mean
// midnight and exclude everything filed during the day it names, so each bound
// is widened to the edge of the day the user picked. Both ends of the range are
// inclusive server-side (M6-1), so this makes one date cover that whole day.
function startOfDay(date: string): string {
  return `${date}T00:00:00.000Z`;
}

function endOfDay(date: string): string {
  return `${date}T23:59:59.999Z`;
}

export function TicketsTable() {
  // Null until the dev token arrives. Every fetch below waits for it rather
  // than sending `Bearer null`, which the backend would answer with a 401.
  // `authFailed` is what separates a null that is still coming from one that
  // never will, so the wait below ends instead of running forever.
  const { auth, failed: authFailed } = useAuthContextState();

  const [productName, setProductName] = useState("");
  const [category, setCategory] = useState<TicketCategory | "">("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [errorMessage, setErrorMessage] = useState("");

  const load = useCallback(async () => {
    if (authFailed) {
      // Reuses the list-failure banner below rather than adding a second
      // failure surface: from this page's side both mean the same thing, that
      // the backend could not be reached and there is nothing to show.
      setErrorMessage("could not authenticate with the backend");
      setStatus("error");
      return;
    }

    if (auth === null) {
      return;
    }

    setStatus("loading");
    try {
      const rows = await listTickets(
        {
          product_name: productName,
          category,
          from: from ? startOfDay(from) : "",
          to: to ? endOfDay(to) : "",
        },
        auth.token
      );
      setTickets(rows);
      setStatus("ready");
    } catch (err) {
      // Unlike CategorySelector, a failure here is shown. That component stays
      // silent because a failed AI suggestion still leaves a usable manual
      // dropdown; this page has no fallback at all, so a silent failure would
      // be indistinguishable from "there are no tickets".
      setErrorMessage(err instanceof Error ? err.message : "Failed to load tickets");
      setStatus("error");
    }
  }, [auth, authFailed, productName, category, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main>
      <h1>Tickets</h1>

      {auth === null ? (
        // Dropped once the request has failed, so the page is not claiming to
        // be waiting for something that is not coming while the banner below
        // says it already gave up.
        !authFailed && <p>Waiting for authentication...</p>
      ) : (
        <p>
          Signed in as {auth.username} ({auth.email})
        </p>
      )}

      <section>
        <label htmlFor="filter-product">Product</label>
        <select
          id="filter-product"
          value={productName}
          onChange={(e) => setProductName(e.target.value)}
        >
          <option value="">All products</option>
          {PRODUCT_NAMES.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>

        <label htmlFor="filter-category">Category</label>
        <select
          id="filter-category"
          value={category}
          onChange={(e) => setCategory(e.target.value as TicketCategory | "")}
        >
          <option value="">All categories</option>
          {CATEGORIES.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>

        <label htmlFor="filter-from">From</label>
        <input
          id="filter-from"
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />

        <label htmlFor="filter-to">To</label>
        <input id="filter-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      </section>

      {status === "loading" && <p>Loading tickets...</p>}
      {status === "error" && <p role="alert">Could not load tickets: {errorMessage}</p>}

      {status === "ready" && (
        <>
          <p>
            {tickets.length} ticket{tickets.length === 1 ? "" : "s"}
          </p>

          {tickets.length === 0 ? (
            <p>No tickets match these filters.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Product</th>
                  <th>Category</th>
                  <th>User</th>
                  <th>AI suggestion</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((ticket) => (
                  <tr key={ticket.ticket_id}>
                    <td>{new Date(ticket.datetime).toLocaleString()}</td>
                    <td>{ticket.product_name}</td>
                    <td>{ticket.category}</td>
                    <td>{ticket.username}</td>
                    <td>{ticket.ai_mode_enabled ? (ticket.ai_suggested_category ?? "none") : "AI off"}</td>
                    {/*
                      issue_description is stored raw and byte-identical (M5-7),
                      so this cell is where the XSS boundary actually is. It is a
                      JSX expression child, which React renders as a text node,
                      so markup in the stored text is displayed rather than
                      parsed. Never render this through dangerouslySetInnerHTML,
                      innerHTML, or any HTML-rendering library: doing so would
                      execute stored user input and would silently undo the
                      decision M5-7 made to keep bug reports intact on the way in.
                    */}
                    <td>{ticket.issue_description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </main>
  );
}
