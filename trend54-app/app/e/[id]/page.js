"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { supabase, publicPhotoUrl } from "../../../lib/supabaseClient";
import { loadModels, getFaceDescriptors, fileToImage, descriptorsMatch } from "../../../lib/faceApi";

export default function GuestPage() {
  const { id } = useParams();
  const [event, setEvent] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [step, setStep] = useState(1);
  const [scanning, setScanning] = useState(false);
  const [matches, setMatches] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [downloading, setDownloading] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    (async () => {
      const { data: ev } = await supabase.from("events").select("*").eq("id", id).single();
      setEvent(ev);
      const { data: ph } = await supabase.from("photos").select("*").eq("event_id", id);
      setPhotos(ph || []);
    })();
  }, [id]);

  async function handleSelfie(file) {
    setScanning(true);
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
      setMatches(found);
      setStep(2);
    } catch (err) {
      console.error(err);
      alert("משהו השתבש בזיהוי, נסו שוב");
    } finally {
      setScanning(false);
    }
  }

  function toggleSelect(id) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function downloadSelected() {
    setDownloading(true);
    const selected = matches.filter((p) => selectedIds.includes(p.id));
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
      <div style={{ display: "flex", justifyContent: "center", gap: 32, padding: 24, borderBottom: "1px solid var(--muted-faint)" }}>
        <span className="mono" style={{ fontSize: 10, color: step >= 1 ? "var(--paper)" : "var(--muted)" }}>1. סלפי</span>
        <span className="mono" style={{ fontSize: 10, color: step >= 2 ? "var(--paper)" : "var(--muted)" }}>2. בחירה</span>
        <span className="mono" style={{ fontSize: 10, color: step >= 3 ? "var(--paper)" : "var(--muted)" }}>3. הדפסה/הורדה</span>
      </div>

      {step === 1 && (
        <div style={{ textAlign: "center", padding: "40px 24px" }}>
          <div className="mono" style={{ fontSize: 10, letterSpacing: "0.2em", color: "var(--accent)", textTransform: "uppercase", marginBottom: 16 }}>
            {event.title} · {event.event_date}
          </div>
          <h1 className="serif" style={{ fontSize: "clamp(2rem, 5vw, 3rem)", marginBottom: 12 }}>מצאו את עצמכם</h1>
          <p style={{ color: "var(--muted-light)", maxWidth: 360, margin: "0 auto 40px auto" }}>
            צלמו סלפי ואנחנו נמצא עבורכם את כל התמונות מהאירוע שאתם מופיעים בהן.
          </p>

          {photos.length === 0 ? (
            <p className="mono" style={{ color: "var(--muted)", fontSize: 11 }}>הצלם עדיין לא העלה תמונות לאירוע הזה</p>
          ) : (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="user"
                style={{ display: "none" }}
                onChange={(e) => e.target.files[0] && handleSelfie(e.target.files[0])}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={scanning}
                style={{
                  width: 220,
                  height: 220,
                  borderRadius: "50%",
                  border: scanning ? "none" : "2px dashed rgba(242,237,228,0.3)",
                  background: scanning ? "var(--paper)" : "transparent",
                  color: scanning ? "var(--ink)" : "var(--muted-light)",
                  cursor: scanning ? "default" : "pointer",
                  margin: "0 auto",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 12,
                }}
                className="mono"
              >
                {scanning ? (
                  <>
                    <div className="spin" style={{ width: 28, height: 28, border: "3px solid var(--accent-bright)", borderTopColor: "transparent", borderRadius: "50%" }} />
                    <span style={{ fontSize: 10, textTransform: "uppercase" }}>מזהה פרצוף...</span>
                  </>
                ) : (
                  <span style={{ fontSize: 10, textTransform: "uppercase" }}>לחצו לצילום סלפי</span>
                )}
              </button>
            </>
          )}
        </div>
      )}

      {step === 2 && (
        <div style={{ padding: "40px 24px" }}>
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div className="mono" style={{ fontSize: 10, color: "var(--accent)", textTransform: "uppercase", marginBottom: 12 }}>
              נמצאו {matches.length} תמונות שלכם
            </div>
            <h1 className="serif" style={{ fontSize: "clamp(1.8rem, 4vw, 2.6rem)" }}>בחרו תמונות</h1>
          </div>

          {matches.length === 0 ? (
            <p className="mono" style={{ textAlign: "center", color: "var(--muted)" }}>לא מצאנו תמונות שאתם מופיעים בהן, נסו סלפי אחר</p>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 16, maxWidth: 700, margin: "0 auto 40px auto" }}>
                {matches.map((p) => {
                  const isSelected = selectedIds.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => toggleSelect(p.id)}
                      style={{ position: "relative", border: "none", padding: 0, cursor: "pointer", borderRadius: 2, overflow: "hidden", aspectRatio: "4/5", outline: isSelected ? "3px solid var(--accent-bright)" : "3px solid transparent" }}
                    >
                      <img src={publicPhotoUrl(p.storage_path)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    </button>
                  );
                })}
              </div>

              <div style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
                <button
                  onClick={() => setStep(3)}
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
      )}

      {step === 3 && (
        <div style={{ padding: "40px 24px", textAlign: "center" }}>
          <h1 className="serif" style={{ fontSize: "clamp(1.8rem, 4vw, 2.6rem)", marginBottom: 24 }}>מוכן להדפסה</h1>
          <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "center", marginBottom: 32 }}>
            {matches.filter((p) => selectedIds.includes(p.id)).map((p) => (
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
