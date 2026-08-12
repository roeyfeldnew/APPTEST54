"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase, publicPhotoUrl } from "../../../lib/supabaseClient";
import { loadModels, getFaceDescriptors, fileToImage } from "../../../lib/faceApi";

export default function EventDashboard() {
  const { id } = useParams();
  const router = useRouter();

  const [event, setEvent] = useState(null);
  const [scenes, setScenes] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [activeScene, setActiveScene] = useState(null);
  const [addingScene, setAddingScene] = useState(false);
  const [newSceneName, setNewSceneName] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [uploadingCount, setUploadingCount] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    loadEverything();
  }, [id]);

  async function loadEverything() {
    const { data: ev } = await supabase.from("events").select("*").eq("id", id).single();
    setEvent(ev);
    const { data: sc } = await supabase.from("scenes").select("*").eq("event_id", id).order("created_at");
    setScenes(sc || []);
    if (sc && sc.length > 0) setActiveScene(sc[0].id);
    else setAddingScene(true);
    const { data: ph } = await supabase.from("photos").select("*").eq("event_id", id).order("created_at", { ascending: false });
    setPhotos(ph || []);
  }

  async function addScene() {
    if (!newSceneName.trim()) return;
    const { data, error } = await supabase
      .from("scenes")
      .insert({ event_id: id, name: newSceneName.trim().toUpperCase() })
      .select()
      .single();
    if (error) {
      alert("שגיאה ביצירת סצנה: " + error.message);
      return;
    }
    setScenes((prev) => [...prev, data]);
    setActiveScene(data.id);
    setAddingScene(false);
    setNewSceneName("");
  }

  async function removeScene(sceneId) {
    await supabase.from("scenes").delete().eq("id", sceneId);
    const remaining = scenes.filter((s) => s.id !== sceneId);
    setScenes(remaining);
    setPhotos((prev) => prev.filter((p) => p.scene_id !== sceneId));
    if (activeScene === sceneId) {
      setActiveScene(remaining[0]?.id ?? null);
      if (remaining.length === 0) setAddingScene(true);
    }
  }

  async function handleFiles(fileList) {
    if (!activeScene) return;
    const files = Array.from(fileList).filter((f) => f.type.startsWith("image/"));
    if (files.length === 0) return;

    setUploadingCount((c) => c + files.length);
    await loadModels();

    for (const file of files) {
      try {
        // 1. חילוץ טביעות פנים מהתמונה (רץ בדפדפן, חינם)
        const imgEl = await fileToImage(file);
        const descriptors = await getFaceDescriptors(imgEl);

        // 2. העלאה ל-Supabase Storage
        const path = `${id}/${activeScene}/${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage.from("photos").upload(path, file, {
          contentType: file.type || "image/jpeg",
          cacheControl: "3600",
        });
        if (uploadError) throw uploadError;

        // 3. שמירת רשומה בטבלת photos
        const { data: row, error: insertError } = await supabase
          .from("photos")
          .insert({
            event_id: id,
            scene_id: activeScene,
            storage_path: path,
            face_descriptors: descriptors,
          })
          .select()
          .single();
        if (insertError) throw insertError;

        setPhotos((prev) => [row, ...prev]);
      } catch (err) {
        console.error("העלאה נכשלה עבור", file.name, err);
      } finally {
        setUploadingCount((c) => c - 1);
      }
    }
  }

  async function removePhoto(photo) {
    await supabase.storage.from("photos").remove([photo.storage_path]);
    await supabase.from("photos").delete().eq("id", photo.id);
    setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
    if (event.cover_photo_path === photo.storage_path) {
      setEvent((prev) => ({ ...prev, cover_photo_path: null }));
    }
  }

  async function setCoverPhoto(photo) {
    const { error } = await supabase.from("events").update({ cover_photo_path: photo.storage_path }).eq("id", id);
    if (error) {
      alert("שגיאה בקביעת תמונת קאבר: " + error.message);
      return;
    }
    setEvent((prev) => ({ ...prev, cover_photo_path: photo.storage_path }));
  }

  if (!event) return <p className="mono" style={{ padding: 32, color: "var(--muted)" }}>טוען...</p>;

  const scenePhotos = photos.filter((p) => p.scene_id === activeScene);
  const currentSceneName = scenes.find((s) => s.id === activeScene)?.name || "";
  const guestUrl = typeof window !== "undefined" ? `${window.location.origin}/e/${event.id}` : "";

  return (
    <div style={{ minHeight: "100vh" }}>
      <header style={{ padding: 32, borderBottom: "1px solid var(--muted-faint)" }}>
        <button
          onClick={() => router.push("/")}
          className="mono"
          style={{ background: "none", border: "none", color: "var(--muted-light)", cursor: "pointer", fontSize: 11, marginBottom: 24, display: "block" }}
        >
          ← חזרה לכל האירועים
        </button>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
          <div>
            <div className="mono" style={{ fontSize: 10, letterSpacing: "0.2em", color: "var(--accent)", textTransform: "uppercase", marginBottom: 10 }}>
              ניהול אירוע
            </div>
            <h1 className="serif" style={{ fontSize: "clamp(2rem, 5vw, 3rem)", margin: 0 }}>{event.title}</h1>
            <div className="mono" style={{ fontSize: 11, color: "var(--muted-light)", marginTop: 10 }}>{event.event_date}</div>
          </div>
          <button
            onClick={() => window.open(`/e/${event.id}`, "_blank")}
            className="mono"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 18px",
              borderRadius: 2,
              border: "1px solid rgba(242,237,228,0.3)",
              background: "transparent",
              color: "var(--paper)",
              cursor: "pointer",
              fontSize: 10,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            👁 PREVIEW GALLERY
          </button>
        </div>
      </header>

      {/* scene tabs */}
      <div style={{ display: "flex", gap: 8, padding: "20px 32px", borderBottom: "1px solid var(--muted-faint)", flexWrap: "wrap" }}>
        {scenes.map((s) => {
          const count = photos.filter((p) => p.scene_id === s.id).length;
          const isActive = s.id === activeScene;
          return (
            <div key={s.id} style={{ display: "inline-flex", alignItems: "center", borderRadius: 2, border: isActive ? "none" : "1px solid rgba(242,237,228,0.2)", background: isActive ? "var(--paper)" : "transparent" }}>
              <button
                onClick={() => setActiveScene(s.id)}
                className="mono"
                style={{ padding: "9px 10px 9px 16px", border: "none", background: "transparent", color: isActive ? "var(--ink)" : "var(--muted-light)", cursor: "pointer", fontSize: 11 }}
              >
                {s.name} <span style={{ opacity: 0.6 }}>({count})</span>
              </button>
              <button onClick={() => removeScene(s.id)} style={{ border: "none", background: "transparent", color: isActive ? "rgba(28,27,26,0.5)" : "var(--muted-light)", cursor: "pointer", padding: "9px 10px" }}>
                ✕
              </button>
            </div>
          );
        })}
        {addingScene ? (
          <div style={{ display: "flex", gap: 6 }}>
            <input
              autoFocus
              value={newSceneName}
              onChange={(e) => setNewSceneName(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && addScene()}
              placeholder="שם הסצנה"
              className="mono"
              style={{ background: "rgba(242,237,228,0.08)", border: "1px solid rgba(242,237,228,0.25)", borderRadius: 2, padding: "8px 10px", color: "var(--paper)", fontSize: 11, width: 150 }}
            />
            <button onClick={addScene} className="mono" style={{ background: "none", border: "none", color: "var(--accent-bright)", cursor: "pointer" }}>✓</button>
            <button onClick={() => setAddingScene(false)} className="mono" style={{ background: "none", border: "none", color: "var(--muted-light)", cursor: "pointer" }}>✕</button>
          </div>
        ) : (
          <button onClick={() => setAddingScene(true)} className="mono" style={{ padding: "9px 14px", borderRadius: 2, border: "1px dashed rgba(242,237,228,0.25)", background: "transparent", color: "var(--muted-light)", cursor: "pointer", fontSize: 11 }}>
            + סצנה חדשה
          </button>
        )}
      </div>

      <main style={{ padding: 32 }}>
        {!activeScene ? (
          <p className="mono" style={{ color: "var(--muted)", textAlign: "center" }}>צרו סצנה ראשונה כדי להתחיל להעלות תמונות</p>
        ) : (
          <>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
              onClick={() => inputRef.current?.click()}
              style={{ border: `2px dashed ${dragOver ? "var(--accent-bright)" : "rgba(242,237,228,0.25)"}`, borderRadius: 2, padding: "48px 24px", textAlign: "center", cursor: "pointer", marginBottom: 32 }}
            >
              <input ref={inputRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} />
              <div className="serif" style={{ fontSize: 20, marginBottom: 8 }}>גררו תמונות לכאן</div>
              <div className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>
                או לחצו לבחירה · יועלו תחת <span style={{ color: "var(--accent-bright)" }}>{currentSceneName}</span>
              </div>
            </div>

            {uploadingCount > 0 && (
              <p className="mono" style={{ fontSize: 11, color: "var(--muted-light)", marginBottom: 16 }}>
                מעלה ומזהה פנים ב-{uploadingCount} תמונות...
              </p>
            )}

            {scenePhotos.length === 0 ? (
              <p className="mono" style={{ color: "var(--muted)" }}>עדיין אין תמונות ב-{currentSceneName}</p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 16 }}>
                {scenePhotos.map((p) => {
                  const isCover = event.cover_photo_path === p.storage_path;
                  return (
                    <div key={p.id} style={{ position: "relative", borderRadius: 2, overflow: "hidden", aspectRatio: "4/5", background: "rgba(242,237,228,0.06)", outline: isCover ? "3px solid var(--accent-bright)" : "none" }}>
                      <img src={publicPhotoUrl(p.storage_path)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                      {isCover && (
                        <span className="mono" style={{ position: "absolute", top: 8, right: 8, background: "var(--accent-bright)", color: "var(--paper)", fontSize: 9, padding: "3px 8px", borderRadius: 2 }}>
                          קאבר
                        </span>
                      )}
                      <button
                        onClick={() => setCoverPhoto(p)}
                        title="קבעו כתמונת קאבר"
                        className="mono"
                        style={{ position: "absolute", bottom: 8, right: 8, padding: "5px 9px", borderRadius: 2, background: "rgba(28,27,26,0.75)", border: "none", color: "var(--paper)", cursor: "pointer", fontSize: 9 }}
                      >
                        {isCover ? "✓ קאבר" : "הפכו לקאבר"}
                      </button>
                      <button onClick={() => removePhoto(p)} style={{ position: "absolute", bottom: 8, left: 8, width: 28, height: 28, borderRadius: 2, background: "rgba(28,27,26,0.75)", border: "none", color: "var(--paper)", cursor: "pointer" }}>
                        🗑
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        <div style={{ marginTop: 48, background: "rgba(242,237,228,0.06)", borderRadius: 2, padding: "20px 24px", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <span className="mono" style={{ fontSize: 11, color: "var(--muted-light)" }}>קישור לאורחים · {guestUrl}</span>
          <button
            onClick={() => guestUrl && navigator.clipboard.writeText(guestUrl)}
            className="mono"
            style={{ background: "var(--paper)", color: "var(--ink)", padding: "8px 16px", border: "none", borderRadius: 2, cursor: "pointer", fontSize: 10 }}
          >
            העתקת קישור
          </button>
        </div>
      </main>
    </div>
  );
}
