"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { supabase, publicPhotoUrl } from "../../../lib/supabaseClient";
import { loadModels, getFaceDescriptors, fileToImage, descriptorsMatch } from "../../../lib/faceApi";

export default function GuestPage() {
  const { id } = useParams();
  const [event, setEvent] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [aiOpen, setAiOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [matches, setMatches] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [downloading, setDownloading] = useState(false);
  const [activePhoto, setActivePhoto] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    (async () => {
      const { data: ev, error: eventError } = await supabase.from("events").select("*").eq("id", id).single();
      if (eventError) console.error(eventError);
      setEvent(ev || null);

      const { data: ph, error: photosError } = await supabase
        .from("photos")
        .select("*")
        .eq("event_id", id)
        .order("created_at", { ascending: false });
      if (photosError) console.error(photosError);
      setPhotos(ph || []);
    })();
  }, [id]);

  const visiblePhotos = matches === null ? photos : matches;
  const cover = event?.cover_photo_id ? photos.find((p) => p.id === event.cover_photo_id) : photos[0];

  async function handleSelfie(file) {
    if (!file) return;
    setScanning(true);
    try {
      await loadModels();
      const img = await fileToImage(file);
      const selfieDescriptors = await getFaceDescriptors(img);

      if (selfieDescriptors.length === 0) {
        alert("לא זיהינו פנים בסלפי. נסו תמונה ברורה יותר, עם פנים מול המצלמה ותאורה טובה.");
        return;
      }

      const found = photos.filter((p) => descriptorsMatch(selfieDescriptors, p.face_descriptors || []));
      setMatches(found);
      setSelectedIds([]);
      setAiOpen(false);

      if (found.length === 0) {
        alert("לא מצאנו תמונות שלכם. אפשר לנסות סלפי אחר או להמשיך ולראות את כל הגלריה.");
      }
    } catch (err) {
      console.error(err);
      alert("משהו השתבש בזיהוי. נסו שוב או המשיכו לגלריה.");
    } finally {
      setScanning(false);
    }
  }

  function toggleSelect(photoId) {
    setSelectedIds((prev) => (prev.includes(photoId) ? prev.filter((x) => x !== photoId) : [...prev, photoId]));
  }

  function clearAiResults() {
    setMatches(null);
    setSelectedIds([]);
  }

  async function downloadPhotos(photoList) {
    if (!photoList.length) return;
    setDownloading(true);
    try {
      for (const p of photoList) {
        const url = publicPhotoUrl(p.storage_path);
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Download failed: ${res.status}`);
        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = objectUrl;
        a.download = p.storage_path.split("/").pop() || "photo.jpg";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(objectUrl);
        await new Promise((r) => setTimeout(r, 350));
      }
    } catch (err) {
      console.error(err);
      alert("לא הצלחנו להוריד את התמונה. נסו שוב.");
    } finally {
      setDownloading(false);
    }
  }

  function printPhotos(photoList) {
    if (!photoList.length) return;
    const urls = photoList.map((p) => publicPhotoUrl(p.storage_path));
    const printWindow = window.open("", "_blank", "width=900,height=900");
    if (!printWindow) {
      alert("הדפדפן חסם את חלון ההדפסה. אפשרו חלונות קופצים ונסו שוב.");
      return;
    }

    const images = urls.map((url) => `<img src="${url.replaceAll('"', '&quot;')}" />`).join("");
    printWindow.document.write(`<!doctype html><html dir="rtl"><head><title>הדפסת תמונות</title><style>body{margin:0;background:white;display:flex;flex-direction:column;gap:20px;align-items:center}img{max-width:100%;max-height:100vh;object-fit:contain;display:block;page-break-after:always}@media print{img{width:100%;max-height:none;page-break-after:always}}</style></head><body>${images}<script>const imgs=[...document.images]; Promise.all(imgs.map(i=>i.complete?Promise.resolve():new Promise(r=>{i.onload=i.onerror=r}))).then(()=>setTimeout(()=>window.print(),300));<\/script></body></html>`);
    printWindow.document.close();
  }

  if (!event) return <main className="guest-loading">טוען...</main>;

  return (
    <main className="guest-page">
      <section className="guest-hero">
        {cover ? <img src={publicPhotoUrl(cover.storage_path)} alt="" className="guest-hero-image" /> : <div className="guest-hero-placeholder" />}
        <div className="guest-hero-overlay" />
        <div className="guest-hero-content">
          <div className="guest-kicker">TREND54 · רגעים מהאירוע</div>
          <h1 className="guest-title">{event.title}</h1>
          <div className="guest-date">{event.event_date}</div>
        </div>
      </section>

      <section className="guest-content">
        <div className="guest-intro">
          <p className="guest-eyebrow">THE GALLERY</p>
          <h2>הרגעים היפים שלכם</h2>
          <p>עברו בין התמונות, בחרו את הרגעים שאהבתם והורידו או הדפיסו אותם.</p>
        </div>

        <div className="guest-ai-card">
          <div>
            <div className="guest-ai-title">✨ רוצים למצוא את התמונות שלכם?</div>
            <div className="guest-ai-text">סריקת פנים היא אפשרות בלבד — הגלריה המלאה זמינה לכם בכל מקרה.</div>
          </div>
          <button className="guest-primary-button" onClick={() => setAiOpen(true)}>מצאו את התמונות שלי</button>
          {matches !== null && <button className="guest-link-button" onClick={clearAiResults}>הצג את כל התמונות</button>}
        </div>

        {matches !== null && (
          <div className="guest-results-note">
            נמצאו {matches.length} תמונות {matches.length ? "התואמות לסלפי שלכם" : ""}.
          </div>
        )}

        {visiblePhotos.length === 0 ? (
          <div className="guest-empty">הצלם עדיין לא העלה תמונות לאירוע הזה.</div>
        ) : (
          <div className="guest-gallery">
            {visiblePhotos.map((p) => {
              const selected = selectedIds.includes(p.id);
              return (
                <article key={p.id} className={`guest-photo-card ${selected ? "is-selected" : ""}`}>
                  <button className="guest-photo-button" onClick={() => setActivePhoto(p)} aria-label="פתיחת תמונה">
                    <img src={publicPhotoUrl(p.storage_path)} alt="" loading="lazy" />
                  </button>
                  <button className="guest-select-button" onClick={() => toggleSelect(p.id)} aria-label={selected ? "בטל בחירה" : "בחר תמונה"}>
                    {selected ? "✓" : "○"}
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {selectedIds.length > 0 && (
        <div className="guest-selection-bar">
          <span>{selectedIds.length} תמונות נבחרו</span>
          <div>
            <button onClick={() => downloadPhotos(photos.filter((p) => selectedIds.includes(p.id)))} disabled={downloading}>⬇ הורד נבחרות</button>
            <button onClick={() => printPhotos(photos.filter((p) => selectedIds.includes(p.id)))}>🖨 הדפס נבחרות</button>
          </div>
        </div>
      )}

      {activePhoto && (
        <div className="guest-lightbox" onClick={() => setActivePhoto(null)}>
          <button className="guest-close" onClick={() => setActivePhoto(null)} aria-label="סגור">×</button>
          <img src={publicPhotoUrl(activePhoto.storage_path)} alt="" onClick={(e) => e.stopPropagation()} />
          <div className="guest-lightbox-actions" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => toggleSelect(activePhoto.id)}>{selectedIds.includes(activePhoto.id) ? "✓ נבחרה" : "בחרו להדפסה"}</button>
            <button onClick={() => downloadPhotos([activePhoto])} disabled={downloading}>⬇ הורדה</button>
            <button onClick={() => printPhotos([activePhoto])}>🖨 הדפסה</button>
          </div>
        </div>
      )}

      {aiOpen && (
        <div className="guest-modal" onClick={() => !scanning && setAiOpen(false)}>
          <div className="guest-modal-card" onClick={(e) => e.stopPropagation()}>
            <button className="guest-modal-close" onClick={() => setAiOpen(false)}>×</button>
            <div className="guest-eyebrow">OPTIONAL AI</div>
            <h2>מצאו את התמונות שלכם</h2>
            <p>העלו סלפי ברור. אנחנו נשווה את הפנים שלכם לתמונות שכבר עובדו באירוע.</p>
            <input ref={fileInputRef} type="file" accept="image/*" capture="user" hidden onChange={(e) => e.target.files[0] && handleSelfie(e.target.files[0])} />
            <button className="guest-primary-button guest-modal-action" onClick={() => fileInputRef.current?.click()} disabled={scanning}>
              {scanning ? "מזהים פנים..." : "📷 בחרו סלפי"}
            </button>
            <button className="guest-link-button" onClick={() => setAiOpen(false)}>לא תודה, המשיכו לגלריה</button>
          </div>
        </div>
      )}
    </main>
  );
}
