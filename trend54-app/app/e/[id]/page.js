"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { supabase, publicPhotoUrl } from "../../../lib/supabaseClient";
import { loadModels, getFaceDescriptors, fileToImage, descriptorsMatch } from "../../../lib/faceApi";

export default function GuestPage() {
  const { id } = useParams();
  const [event, setEvent] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [loadingPhotos, setLoadingPhotos] = useState(true);

  const [viewMode, setViewMode] = useState("all"); // 'all' | 'matched'
  const [matches, setMatches] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [noMatchNotice, setNoMatchNotice] = useState(false);

  const [step, setStep] = useState("gallery"); // 'gallery' | 'print'
  const [selectedIds, setSelectedIds] = useState([]);
  const [downloading, setDownloading] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    (async () => {
      const { data: ev } = await supabase.from("events").select("*").eq("id", id).single();
      setEvent(ev);
      const { data: ph } = await supabase.from("photos").select("*").eq("event_id", id).order("created_at");
      setPhotos(ph || []);
      setLoadingPhotos(false);
    })();
  }, [id]);

  async function handleSelfie(file) {
    setScanning(true);
    setNoMatchNotice(false);
    await loadModels();
    try {
      const img = await fileToImage(file);
      const selfieDescriptors = await getFaceDescriptors(img);
      if (selfieDescriptors.length === 0) {
        alert("לא זיהינו פרצוף בתמונה, נסו שוב עם תאורה טובה יותר");
        setScanning(false);
        return;
      }
      const found = photos.filter((p) => descriptorsMatch(selfieDescriptors, p.face_descriptors || []));
      if (found.length === 0) {
        setNoMatchNotice(true);
        setViewMode("all");
      } else {
        setMatches(found);
        setViewMode("matched");
      }
    } catch (err) {
      console.error(err);
      alert("משהו השתבש בזיהוי, נסו שוב");
    } finally {
      setScanning(false);
    }
  }

  function toggleSelect(pid) {
    setSelectedIds((prev) => (prev.includes(pid) ? prev.filter((x) => x !== pid) : [...prev, pid]));
  }

  const displayedPhotos = viewMode === "matched" ? matches : photos;

  async function downloadSelected() {
    setDownloading(true);
    const selected = displayedPhotos.filter((p) => selectedIds.includes(p.id));
    for (const p of selected) {
      const url = publicPhotoUrl(p.storage_path);
      const res = await fetch(url);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = p.storage_path.split("/").pop();
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
      await new Promise((r) => setTimeout(r, 300));
    }
    setDownloading(false);
  }

  if (!event) return <p className="mono" style={{ padding: 32, color: "var(--muted)" }}>טוען...</p>;

  return (
    <div style={{ minHeight: "100vh" }}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="user"
        style={{ display: "none" }}
        onChange={(e) => e.target.files[0] && handleSelfie(e.target.files[0])}
      />

      {step === "gallery" && (
        <>
          <header style={{ position: "relative", textAlign: "center", padding: event.cover_photo_path ? 0 : "40px 24px 24px 24px" }}>
            {event.cover_photo_path ? (
              <div style={{ position: "relative", width: "100%", height: "min(60vh, 480px)", overflow: "hidden" }}>
                <img
                  src={publicPhotoUrl(event.cover_photo_path)}
                  alt=""
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: "linear-gradient(to top, rgba(28,27,26,0.85) 0%, rgba(28,27,26,0.15) 55%, rgba(28,27,26,0.35) 100%)",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "flex-end",
                    padding: "32px 24px",
                  }}
                >
                  <div className="mono" style={{ fontSize: 10, letterSpacing: "0.2em", color: "var(--accent-bright)", textTransform: "uppercase", marginBottom: 10 }}>
                    {event.event_date}
                  </div>
                  <h1 className="serif" style={{ fontSize: "clamp(2rem, 6vw, 3.2rem)", margin: 0, color: "var(--paper)" }}>
                    {event.title}
                  </h1>
                </div>
              </div>
            ) : (
              <>
                <div className="mono" style={{ fontSize: 10, letterSpacing: "0.2em", color: "var(--accent)", textTransform: "uppercase", marginBottom: 12 }}>
                  {event.title} · {event.event_date}
                </div>
                <h1 className="serif" style={{ fontSize: "clamp(1.8rem, 4vw, 2.6rem)", marginBottom: 8 }}>
                  {viewMode === "matched" ? "התמונות שלכם" : "כל התמונות מהאירוע"}
                </h1>
              </>
            )}
            <p style={{ color: "var(--muted-light)", maxWidth: 420, margin: event.cover_photo_path ? "24px auto 0 auto" : "0 auto" }}>
              דפדפו בגלריה ובחרו את התמונות שאתם אוהבים. רוצים למצוא את עצמכם מהר יותר? אפשר להיעזר בזיהוי פנים.
            </p>
          </header>

          {/* face-recognition helper bar */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
            {viewMode === "matched" ? (
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
                <span className="mono" style={{ fontSize: 11, color: "var(--muted-light)" }}>
                  מציג {matches.length} תמונות שזוהיתם בהן
                </span>
                <button
                  onClick={() => setViewMode("all")}
                  className="mono"
                  style={{ padding: "8px 14px", borderRadius: 2, border: "1px solid rgba(242,237,228,0.3)", background: "transparent", color: "var(--paper)", cursor: "pointer", fontSize: 11 }}
                >
                  ← חזרה לכל התמונות
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={scanning || loadingPhotos}
                className="mono"
                style={{ padding: "10px 20px", borderRadius: 2, border: "1px solid rgba(242,237,228,0.3)", background: "transparent", color: "var(--paper)", cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center", gap: 8 }}
              >
                {scanning ? (
                  <>
                    <span className="spin" style={{ width: 12, height: 12, border: "2px solid var(--accent-bright)", borderTopColor: "transparent", borderRadius: "50%", display: "inline-block" }} />
                    מזהה פרצוף...
                  </>
                ) : (
                  "📷 מצאו את עצמכם עם זיהוי פנים (אופציונלי)"
                )}
              </button>
            )}
          </div>

          {noMatchNotice && (
            <p className="mono" style={{ textAlign: "center", fontSize: 11, color: "var(--muted)", marginBottom: 24 }}>
              לא נמצאה התאמה ודאית - הנה כל התמונות של האירוע, תוכלו לחפש ידנית
            </p>
          )}

          <div style={{ padding: "0 24px 40px 24px" }}>
            {loadingPhotos ? (
              <p className="mono" style={{ textAlign: "center", color: "var(--muted)" }}>טוען תמונות...</p>
            ) : photos.length === 0 ? (
              <p className="mono" style={{ textAlign: "center", color: "var(--muted)" }}>הצלם עדיין לא העלה תמונות לאירוע הזה</p>
            ) : (
              <>
                <div className="masonry-grid" style={{ maxWidth: 900, margin: "0 auto 40px auto" }}>
                  {displayedPhotos.map((p) => {
                    const isSelected = selectedIds.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        onClick={() => toggleSelect(p.id)}
                        className="masonry-item"
                        style={{ position: "relative", border: "none", padding: 0, cursor: "pointer", borderRadius: 2, overflow: "hidden", outline: isSelected ? "3px solid var(--accent-bright)" : "3px solid transparent" }}
                      >
                        <img src={publicPhotoUrl(p.storage_path)} alt="" style={{ width: "100%", height: "auto", display: "block" }} />
                        {isSelected && (
                          <div style={{ position: "absolute", top: 8, left: 8, width: 22, height: 22, borderRadius: "50%", background: "var(--accent-bright)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--paper)", fontSize: 12 }}>
                            ✓
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                <div style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
                  <button
                    onClick={() => setStep("print")}
                    disabled={selectedIds.length === 0}
                    className="mono"
                    style={{ padding: "14px 28px", borderRadius: 2, border: "none", background: selectedIds.length ? "var(--paper)" : "rgba(242,237,228,0.2)", color: "var(--ink)", cursor: selectedIds.length ? "pointer" : "not-allowed", fontSize: 12, textTransform: "uppercase" }}
                  >
                    🖨 הדפיסו {selectedIds.length || ""}
                  </button>
                  <button
                    onClick={downloadSelected}
                    disabled={selectedIds.length === 0 || downloading}
                    className="mono"
                    style={{ padding: "14px 28px", borderRadius: 2, border: "1px solid rgba(242,237,228,0.35)", background: "transparent", color: "var(--paper)", cursor: "pointer", fontSize: 12, textTransform: "uppercase" }}
                  >
                    {downloading ? "מוריד..." : `⬇ הורידו ${selectedIds.length || ""} למכשיר`}
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {step === "print" && (
        <div style={{ padding: "40px 24px", textAlign: "center" }}>
          <button
            onClick={() => setStep("gallery")}
            className="mono"
            style={{ background: "none", border: "none", color: "var(--muted-light)", cursor: "pointer", fontSize: 11, marginBottom: 24, display: "block", margin: "0 auto 24px auto" }}
          >
            ← חזרה לגלריה
          </button>
          <h1 className="serif" style={{ fontSize: "clamp(1.8rem, 4vw, 2.6rem)", marginBottom: 24 }}>מוכן להדפסה</h1>
          <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "center", marginBottom: 32 }}>
            {displayedPhotos.filter((p) => selectedIds.includes(p.id)).map((p) => (
              <img key={p.id} src={publicPhotoUrl(p.storage_path)} alt="" style={{ width: 160, aspectRatio: "4/5", objectFit: "cover", background: "var(--paper)", padding: 6 }} />
            ))}
          </div>
          <button
            onClick={() => window.print()}
            className="mono"
            style={{ padding: "13px 28px", borderRadius: 2, border: "none", background: "var(--accent-bright)", color: "var(--paper)", cursor: "pointer", fontSize: 12, textTransform: "uppercase" }}
          >
            🖨 שלחו להדפסה
          </button>
          <p className="mono" style={{ fontSize: 10, color: "var(--muted)", marginTop: 20, maxWidth: 300, marginInline: "auto" }}>
            ייפתח חלון ההדפסה של הדפדפן — בחרו את מדפסת המגנטים ולחצו הדפס.
          </p>
        </div>
      )}
    </div>
  );
}
