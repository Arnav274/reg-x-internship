import { useCallback, useEffect, useRef, useState } from "react";
import "./admin.css";
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

// One date convention for the whole console. toLocaleString() picked a format
// per machine and rendered M/D/YYYY here, which disagreed with the date inputs
// below on the same screen. Those inputs cannot be told what to display, since
// that format is browser chrome driven by the OS locale, but their underlying
// value is always YYYY-MM-DD, so the table follows the convention the controls
// actually use. Still built from local-time parts, exactly what toLocaleString
// was showing, so this changes the formatting and not the instant.
function formatTimestamp(iso: string): string {
  const at = new Date(iso);
  const pad = (part: number) => String(part).padStart(2, "0");
  const date = `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
  return `${date} ${pad(at.getHours())}:${pad(at.getMinutes())}`;
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

  // Changing a filter starts a new request without waiting for the previous one,
  // so two can be in flight at once and they are not guaranteed to come back in
  // the order they were sent. Without this the last response to *resolve* would
  // win instead of the last one *requested*, and the table would show rows that
  // do not match the controls on screen.
  //
  // Same guard CategorySelector uses for the same reason (M3-8): take a ticket
  // number before the call, and on settle only apply the result if no newer call
  // has started since. An AbortController would also work, but it would then
  // have to tell a deliberate abort apart from a real network failure to keep
  // the error banner from firing on every superseded request, which is more
  // moving parts for the same outcome.
  const requestIdRef = useRef(0);

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

    const requestId = ++requestIdRef.current;
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
      if (requestId !== requestIdRef.current) {
        return;
      }
      setTickets(rows);
      setStatus("ready");
    } catch (err) {
      // Guarded too, not just the success path above: a superseded request that
      // fails must not paint the error banner over a newer load that succeeded.
      if (requestId !== requestIdRef.current) {
        return;
      }
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
    <main className="ad">
      <header className="ad-head">
        <h1 className="ad-title">Tickets</h1>

        {auth === null ? (
          // Dropped once the request has failed, so the page is not claiming to
          // be waiting for something that is not coming while the banner below
          // says it already gave up.
          !authFailed && <p className="ad-identity">Waiting for authentication...</p>
        ) : (
          <p className="ad-identity">
            Signed in as {auth.username} ({auth.email})
          </p>
        )}
      </header>

      <section className="ad-filters">
        <div className="ad-filter">
          <label className="ad-label" htmlFor="filter-product">
            Product
          </label>
          <select
            className="ad-input"
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
        </div>

        <div className="ad-filter">
          <label className="ad-label" htmlFor="filter-category">
            Category
          </label>
          <select
            className="ad-input"
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
        </div>

        <div className="ad-filter">
          <label className="ad-label" htmlFor="filter-from">
            From
          </label>
          <input
            className="ad-input"
            id="filter-from"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>

        <div className="ad-filter">
          <label className="ad-label" htmlFor="filter-to">
            To
          </label>
          <input
            className="ad-input"
            id="filter-to"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
      </section>

      {status === "loading" && <p className="ad-notice">Loading tickets...</p>}
      {status === "error" && (
        <p className="ad-notice ad-notice--error" role="alert">
          Could not load tickets: {errorMessage}
        </p>
      )}

      {status === "ready" && (
        <>
          <p className="ad-count">
            {tickets.length} ticket{tickets.length === 1 ? "" : "s"}
          </p>

          {tickets.length === 0 ? (
            <p className="ad-notice">No tickets match these filters.</p>
          ) : (
            <div className="ad-tablewrap">
            <table className="ad-table">
              <thead>
                <tr>
                  <th className="ad-col-date">Date</th>
                  <th className="ad-col-product">Product</th>
                  <th className="ad-col-category">Category</th>
                  <th className="ad-col-user">User</th>
                  <th className="ad-col-ai">AI suggestion</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((ticket) => (
                  <tr key={ticket.ticket_id}>
                    <td className="ad-date">{formatTimestamp(ticket.datetime)}</td>
                    <td>{ticket.product_name}</td>
                    <td>
                      {/* Severity carried by the chip's colour as well as its
                          text, so the urgent rows separate from the rest
                          without having to be read one by one. */}
                      <span className={`ad-chip ad-chip--${ticket.category.toLowerCase()}`}>
                        {ticket.category}
                      </span>
                    </td>
                    <td className="ad-user">{ticket.username}</td>
                    <td className="ad-ai">{ticket.ai_mode_enabled ? (ticket.ai_suggested_category ?? "none") : "AI off"}</td>
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
                    <td className="ad-desc">{ticket.issue_description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </>
      )}
    </main>
  );
}
