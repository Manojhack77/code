import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../api";
import { Alert, Badge, Button, Card, EmptyRow, Field, Modal, Td, Th, inputCls } from "../components/ui";
import { errMsg, monthName } from "../utils";
import LeavesTab from "./staff/LeavesTab";

const TABS = [
  { id: "hours", label: "Hour Booking" },
  { id: "leaves", label: "Leaves" },
];

// The staff page has two tabs: entering the month's hours, and adding / viewing leave.
export default function Staff() {
  const [tab, setTab] = useState("hours");
  return (
    <div className="relative isolate -my-8 min-h-[calc(100vh-4.2rem)] py-8 before:absolute before:inset-y-0 before:left-1/2 before:-z-10 before:w-screen before:-translate-x-1/2 before:bg-gradient-to-b before:from-slate-100 before:to-slate-200/70">
      <div role="tablist" className="mb-5 inline-flex gap-1 rounded-xl border border-slate-300 bg-white p-1 shadow-sm">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-5 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-slate-600 ${
              tab === t.id ? "bg-slate-800 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "hours" ? <HourBooking /> : <LeavesTab />}
    </div>
  );
}

function HourBooking() {
  const { user } = useAuth();
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const [projects, setProjects] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hours, setHours] = useState("");
  const [feedback, setFeedback] = useState(null); // { type, text }
  const [busy, setBusy] = useState(false);
  const [viewing, setViewing] = useState(null); // history row shown in the edit modal

  const load = useCallback(async () => {
    try {
      const [p, h] = await Promise.all([api.staffProjects(user.memberId), api.staffHistory(user.memberId)]);
      setProjects(p);
      setHistory(h);
    } catch (e) {
      setFeedback({ type: "error", text: errMsg(e) });
    } finally {
      setLoading(false);
    }
  }, [user.memberId]);

  useEffect(() => {
    load();
  }, [load]);

  const alreadyBooked = history.some((h) => h.month === month && h.year === year);
  const total = Number(hours);
  const assignedPct = projects.reduce((sum, p) => sum + Number(p.allocationPercentage), 0);
  const unassignedPct = Math.max(0, Math.round((100 - assignedPct) * 100) / 100);

  const submit = async (e) => {
    e.preventDefault();
    if (hours === "") return setFeedback({ type: "error", text: "Enter your working hours." });
    if (!(total > 0)) return setFeedback({ type: "error", text: "Working hours must be greater than zero." });
    setBusy(true);
    setFeedback(null);
    try {
      const res = await api.bookHours({ memberId: user.memberId, month, year, hours: total });
      setFeedback({ type: "success", text: res?.message || "Hours submitted successfully!" });
      setHours("");
      await load();
    } catch (err) {
      setFeedback({ type: "error", text: errMsg(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Step 2: booking interface */}
      <section>
        <div className="mb-4 rounded-xl bg-gradient-to-r from-slate-800 to-slate-600 px-5 py-3 text-white shadow-md shadow-slate-900/15">
          <h2 className="text-lg font-semibold leading-tight">Monthly hours</h2>
          <p className="text-xs text-slate-200">Enter the hours you worked this month. They are split across your projects by allocation.</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-5">
          <Card className="border-t-2 border-t-slate-700 p-6 shadow-md shadow-slate-900/5 lg:col-span-3">
            <form onSubmit={submit} noValidate className="space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Month">
                  <input className={inputCls} value={monthName(month)} readOnly disabled />
                </Field>
                <Field label="Year">
                  <input className={inputCls} value={year} readOnly disabled />
                </Field>
              </div>

              <Field label="Working hours">
                <input
                  type="number" min="0" step="0.5" inputMode="decimal"
                  className={`${inputCls} focus:border-slate-500! focus:ring-slate-200!`} value={hours} placeholder="Enter working hours, e.g. 160"
                  disabled={alreadyBooked}
                  onChange={(e) => {
                    setHours(e.target.value);
                    setFeedback(null);
                  }}
                />
              </Field>

              {alreadyBooked && (
                <Alert type="success">
                  You have already submitted hours for {monthName(month)} {year}. Use View in the history below to change them.
                </Alert>
              )}
              {feedback && <Alert type={feedback.type}>{feedback.text}</Alert>}

              <Button type="submit" className="bg-slate-800! hover:bg-slate-900! focus-visible:outline-slate-800!" disabled={busy || alreadyBooked}>
                {busy ? "Submitting..." : "Submit hours"}
              </Button>
            </form>
          </Card>

          {/* FR-1.1: only projects the staff member is mapped to */}
          <Card className="border-t-2 border-t-slate-700 p-6 shadow-md shadow-slate-900/5 lg:col-span-2">
            <h3 className="font-semibold text-slate-800">Your projects</h3>
            {loading ? (
              <p className="mt-3 text-sm text-slate-500">Loading...</p>
            ) : projects.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">
                You are not assigned to any project yet. You can still submit your hours; they will be counted when your administrator assigns you.
              </p>
            ) : (
              <ul className="mt-3 space-y-3">
                {projects.map((p) => {
                  const share = total > 0 ? (total * p.allocationPercentage) / 100 : null;
                  return (
                    <li key={p.wbsCode} className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-slate-900">{p.projectName}</span>
                        <span className="rounded-full bg-slate-700 px-2.5 py-0.5 text-xs font-semibold text-white">{Number(p.allocationPercentage)}%</span>
                      </div>
                      <p className="text-slate-500">{p.wbsCode}</p>
                      {share !== null && (
                        <p className="mt-1 text-slate-700">
                          {Number(share.toFixed(2))} h of your total
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {projects.length > 0 && unassignedPct > 0 && (
              <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-inset ring-amber-200">
                {unassignedPct}% of your hours are not assigned to a project yet. They are counted when your administrator assigns them.
              </p>
            )}
          </Card>
        </div>
      </section>

      {/* Step 3: booking history */}
      <section>
        <div className="mb-4 rounded-xl bg-gradient-to-r from-slate-800 to-slate-600 px-5 py-3 text-white shadow-md shadow-slate-900/15">
          <h2 className="text-lg font-semibold leading-tight">Booking history</h2>
          <p className="text-xs text-slate-200">Your previously submitted months.</p>
        </div>
        <Card className="overflow-hidden shadow-md shadow-slate-900/5">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-300 bg-slate-200/70">
                <tr>
                  <Th>Sl No</Th>
                  <Th>Month / year</Th>
                  <Th>Hours</Th>
                  <Th right>Action</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {loading ? (
                  <EmptyRow cols={4}>Loading...</EmptyRow>
                ) : history.length === 0 ? (
                  <EmptyRow cols={4}>No hours submitted yet. Your first entry will appear here.</EmptyRow>
                ) : (
                  history.map((h, idx) => (
                    <tr key={h.id} className="hover:bg-slate-50">
                      <Td>{idx + 1}</Td>
                      <Td>{monthName(h.month)} {h.year}</Td>
                      <Td strong>{h.hours}</Td>
                      <Td right>
                        <Button variant="ghost" small className="text-slate-700! hover:bg-slate-100!" onClick={() => setViewing(h)}>View</Button>
                      </Td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      {viewing && (
        <EditModal
          row={viewing}
          onClose={() => setViewing(null)}
          onSaved={async () => {
            setViewing(null);
            setFeedback({ type: "success", text: "Hours updated." });
            await load();
          }}
        />
      )}
    </div>
  );
}

// Step 4: modification. Month and year are read-only, hours are editable.
function EditModal({ row, onClose, onSaved }) {
  const [hours, setHours] = useState(String(row.hours));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const update = async () => {
    const n = Number(hours);
    if (hours === "" || !(n >= 0)) return setError("Enter a valid number of hours.");
    setBusy(true);
    setError("");
    try {
      await api.updateHours({ id: row.id, hours: n });
      await onSaved();
    } catch (e) {
      setError(errMsg(e));
      setBusy(false);
    }
  };

  return (
    <Modal title="Edit hours" onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Month">
            <input className={inputCls} value={monthName(row.month)} disabled readOnly />
          </Field>
          <Field label="Year">
            <input className={inputCls} value={row.year} disabled readOnly />
          </Field>
        </div>
        <Field label="Hours">
          <input type="number" min="0" step="0.5" className={inputCls} value={hours} autoFocus onChange={(e) => setHours(e.target.value)} />
        </Field>
        <Alert>{error}</Alert>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button className="bg-slate-800! hover:bg-slate-900!" onClick={update} disabled={busy}>{busy ? "Updating..." : "Update"}</Button>
        </div>
      </div>
    </Modal>
  );
}
