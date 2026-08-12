"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

function slugify(title) {
  return (
    title
      .trim()
      .toLowerCase()
      .replace(/[^\u0590-\u05FFa-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") +
    "-" +
    Math.random().toString(36).slice(2, 7)
  );
}

export default function HomePage() {
  const router = useRouter();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [creating, setCreating] = useState(false);

  const [editingEvent, setEditingEvent] = useState(null); // event object being renamed
  const [editTitle, setEditTitle] = useState("");
  const [editDate, setEditDate] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const [deletingEvent, setDeletingEvent] = useState(null); // event object pending delete
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadEvents();
  }, []);

  async function loadEvents() {
    setLoading(true);
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error) setEvents(data || []);
    setLoading(false);
  }

  async function createEvent() {
    if (!title || !date) return;
    setCreating(true);
    const slug = slugify(title);
    const { data, error } = await supabase
      .from("events")
      .insert({ title, event_date: date, slug })
      .select()
      .single();
    setCreating(false);
    if (error) {
      alert("שגיאה ביצירת האירוע: " + error.message);
      return;
    }
    setShowCreate(false);
    setTitle("");
    setDate("");
    router.push(`/event/${data.id}`);
  }

  function openEdit(ev, e) {
    e.stopPropagation();
    setEditingEvent(ev);
    setEditTitle(ev.title);
    setEditDate(ev.event_date);
  }

  async function saveEdit() {
    if (!editTitle || !editDate || !editingEvent) return;
    setSavingEdit(true);
    const { error } = await supabase
      .from("events")
      .update({ title: editTitle, event_date: editDate })
      .eq("id", editingEvent.id);
    setSavingEdit(false);
    if (error) {
      alert("שגיאה בעדכון האירוע: " + error.message);
      return;
    }
    setEvents((prev) =>
      prev.map((ev) => (ev.id === editingEvent.id ? { ...ev, title: editTitle, event_date: editDate } : ev))
    );
    setEditingEvent(null);
  }

  function openDelete(ev, e) {
    e.stopPropagation();
    setDeletingEvent(ev);
    setDeleteConfirmText("");
  }

  async function confirmDelete() {
    if (deleteConfirmText !== "DELETE" || !deletingEvent) return;
    setDeleting(true);

    // 1. שולפים את כל נתיבי התמונות של האירוע כדי למחוק אותן בפועל מה-Storage
    const { data: eventPhotos, error: fetchError } = await supabase
      .from("photos")
      .select("storage_path")
      .eq("event_id", deletingEvent.id);

    if (fetchError) {
      setDeleting(false);
      alert("שגיאה באיתור תמונות האירוע: " + fetchError.message);
      return;
    }

    // 2. מוחקים את קבצי התמונות עצמם מה-Storage (אם יש)
    if (eventPhotos && eventPhotos.length > 0) {
      const paths = eventPhotos.map((p) => p.storage_path);
      const { error: storageError } = await supabase.storage.from("photos").remove(paths);
      if (storageError) {
        // לא עוצרים את התהליך בגלל זה - ממשיכים למחוק את הרשומות במסד הנתונים
        console.error("שגיאה במחיקת קבצים מה-Storage:", storageError.message);
      }
    }

    // 3. מוחקים את רשומת האירוע (מוחק אוטומטית גם סצנות ותמונות ב-DB, בזכות ON DELETE CASCADE)
    const { error } = await supabase.from("events").delete().eq("id", deletingEvent.id);
    setDeleting(false);
    if (error) {
      alert("שגיאה במחיקת האירוע: " + error.message);
      return;
    }
    setEvents((prev) => prev.filter((ev) => ev.id !== deletingEvent.id));
    setDeletingEvent(null);
  }

  return (
    <div style={{ minHeight: "100vh" }}>
      <header style={{ padding: "48px 32px 64px 32px", textAlign: "center" }}>
        <div
          className="mono"
          style={{
            fontSize: 11,
            letterSpacing: "0.2em",
            color: "var(--accent)",
            textTransform: "uppercase",
            marginBottom: 16,
          }}
        >
          סטודיו — הדפסת מגנטים
        </div>
        <h1
          className="serif"
          style={{
            color: "var(--paper)",
            fontWeight: 700,
            fontSize: "clamp(2.5rem, 6vw, 5rem)",
            margin: "0 0 16px 0",
          }}
        >
          <span
            style={{
              color: "var(--accent-bright)",
              fontFamily: "'Playfair Display', serif",
              fontStyle: "italic",
              fontWeight: 600,
            }}
          >
            TREND54
          </span>
        </h1>
        <p style={{ color: "var(--muted-light)", maxWidth: 420, fontSize: 18, margin: "0 auto" }}>
          נהל את האירועים שלך, העלה תמונות, ותן לאורחים לבחור ולהדפיס בעצמם.
        </p>

        <button
          onClick={() => setShowCreate(true)}
          className="mono"
          style={{
            marginTop: 40,
            backgroundColor: "var(--paper)",
            color: "var(--ink)",
            padding: "14px 24px",
            borderRadius: 2,
            fontSize: 12,
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            border: "none",
            cursor: "pointer",
          }}
        >
          + צור אירוע חדש
        </button>
      </header>

      <section style={{ padding: "0 32px 96px 32px" }}>
        {loading ? (
          <p className="mono" style={{ color: "var(--muted)" }}>
            טוען אירועים...
          </p>
        ) : events.length === 0 ? (
          <p className="mono" style={{ color: "var(--muted)" }}>
            עדיין אין אירועים. צרו את הראשון!
          </p>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: 32,
            }}
          >
            {events.map((ev) => (
              <div
                key={ev.id}
                onClick={() => router.push(`/event/${ev.id}`)}
                style={{
                  position: "relative",
                  textAlign: "right",
                  background: "var(--paper)",
                  border: "none",
                  borderRadius: 2,
                  padding: "20px",
                  cursor: "pointer",
                  color: "var(--ink)",
                }}
              >
                <div style={{ position: "absolute", top: 10, left: 10, display: "flex", gap: 4 }}>
                  <button
                    onClick={(e) => openEdit(ev, e)}
                    title="שינוי שם / תאריך"
                    style={{ background: "rgba(28,27,26,0.08)", border: "none", borderRadius: 2, width: 26, height: 26, cursor: "pointer", fontSize: 12 }}
                  >
                    ✎
                  </button>
                  <button
                    onClick={(e) => openDelete(ev, e)}
                    title="מחיקת אירוע"
                    style={{ background: "rgba(28,27,26,0.08)", border: "none", borderRadius: 2, width: 26, height: 26, cursor: "pointer", fontSize: 12 }}
                  >
                    🗑
                  </button>
                </div>

                <div className="serif" style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>
                  {ev.title}
                </div>
                <div className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>
                  {ev.event_date}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* יצירת אירוע */}
      {showCreate && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "rgba(0,0,0,0.7)" }}>
          <div style={{ width: "100%", maxWidth: 420, backgroundColor: "var(--paper)", color: "var(--ink)", borderRadius: 2, padding: 32 }}>
            <h2 className="serif" style={{ fontSize: 28, marginTop: 0 }}>
              אירוע חדש
            </h2>
            <label className="mono" style={{ fontSize: 10, display: "block", marginBottom: 6 }}>
              שמות הזוג
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="לדוגמה: מיכל & אורי"
              style={{ width: "100%", padding: "8px 0", fontSize: 18, marginBottom: 16, border: "none", borderBottom: "2px solid rgba(0,0,0,0.2)", background: "transparent", outline: "none" }}
            />
            <label className="mono" style={{ fontSize: 10, display: "block", marginBottom: 6 }}>
              תאריך
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={{ width: "100%", padding: "8px 0", fontSize: 18, marginBottom: 24, border: "none", borderBottom: "2px solid rgba(0,0,0,0.2)", background: "transparent", outline: "none" }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setShowCreate(false)} className="mono" style={{ flex: 1, padding: 12, border: "1px solid rgba(0,0,0,0.2)", background: "transparent", cursor: "pointer", borderRadius: 2 }}>
                ביטול
              </button>
              <button
                onClick={createEvent}
                disabled={!title || !date || creating}
                className="mono"
                style={{ flex: 2, padding: 12, border: "none", background: "var(--ink)", color: "var(--paper)", cursor: "pointer", borderRadius: 2, opacity: !title || !date ? 0.4 : 1 }}
              >
                {creating ? "יוצר..." : "יצירת האירוע"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* עריכת אירוע */}
      {editingEvent && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "rgba(0,0,0,0.7)" }}>
          <div style={{ width: "100%", maxWidth: 420, backgroundColor: "var(--paper)", color: "var(--ink)", borderRadius: 2, padding: 32 }}>
            <h2 className="serif" style={{ fontSize: 28, marginTop: 0 }}>
              עריכת אירוע
            </h2>
            <label className="mono" style={{ fontSize: 10, display: "block", marginBottom: 6 }}>
              שמות הזוג
            </label>
            <input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              style={{ width: "100%", padding: "8px 0", fontSize: 18, marginBottom: 16, border: "none", borderBottom: "2px solid rgba(0,0,0,0.2)", background: "transparent", outline: "none" }}
            />
            <label className="mono" style={{ fontSize: 10, display: "block", marginBottom: 6 }}>
              תאריך
            </label>
            <input
              type="date"
              value={editDate}
              onChange={(e) => setEditDate(e.target.value)}
              style={{ width: "100%", padding: "8px 0", fontSize: 18, marginBottom: 24, border: "none", borderBottom: "2px solid rgba(0,0,0,0.2)", background: "transparent", outline: "none" }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setEditingEvent(null)} className="mono" style={{ flex: 1, padding: 12, border: "1px solid rgba(0,0,0,0.2)", background: "transparent", cursor: "pointer", borderRadius: 2 }}>
                ביטול
              </button>
              <button
                onClick={saveEdit}
                disabled={!editTitle || !editDate || savingEdit}
                className="mono"
                style={{ flex: 2, padding: 12, border: "none", background: "var(--ink)", color: "var(--paper)", cursor: "pointer", borderRadius: 2, opacity: !editTitle || !editDate ? 0.4 : 1 }}
              >
                {savingEdit ? "שומר..." : "שמירת שינויים"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* מחיקת אירוע - דורש הקלדת DELETE */}
      {deletingEvent && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "rgba(0,0,0,0.7)" }}>
          <div style={{ width: "100%", maxWidth: 420, backgroundColor: "var(--paper)", color: "var(--ink)", borderRadius: 2, padding: 32 }}>
            <h2 className="serif" style={{ fontSize: 26, marginTop: 0, color: "var(--accent)" }}>
              מחיקת אירוע
            </h2>
            <p style={{ fontSize: 15, marginBottom: 4 }}>
              אתם עומדים למחוק את האירוע <strong>{deletingEvent.title}</strong> וכל התמונות שבו. פעולה זו אינה הפיכה.
            </p>
            <p className="mono" style={{ fontSize: 11, color: "var(--muted)", marginBottom: 16 }}>
              כדי לאשר, הקלידו למטה את המילה DELETE (באותיות גדולות)
            </p>
            <input
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="DELETE"
              className="mono"
              style={{ width: "100%", padding: "8px 0", fontSize: 18, marginBottom: 24, border: "none", borderBottom: "2px solid rgba(0,0,0,0.2)", background: "transparent", outline: "none", textAlign: "center", letterSpacing: "0.2em" }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setDeletingEvent(null)} className="mono" style={{ flex: 1, padding: 12, border: "1px solid rgba(0,0,0,0.2)", background: "transparent", cursor: "pointer", borderRadius: 2 }}>
                ביטול
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleteConfirmText !== "DELETE" || deleting}
                className="mono"
                style={{
                  flex: 2,
                  padding: 12,
                  border: "none",
                  background: deleteConfirmText === "DELETE" ? "var(--accent)" : "rgba(0,0,0,0.2)",
                  color: "var(--paper)",
                  cursor: deleteConfirmText === "DELETE" ? "pointer" : "not-allowed",
                  borderRadius: 2,
                }}
              >
                {deleting ? "מוחק..." : "מחיקה סופית"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
