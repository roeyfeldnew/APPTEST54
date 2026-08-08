import * as faceapi from "face-api.js";

// קבצי המודלים חייבים להיות בתיקייה public/models (ראו README - הורדה חד-פעמית)
const MODEL_URL = "/models";

let modelsLoaded = false;

export async function loadModels() {
  if (modelsLoaded) return;
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
  ]);
  modelsLoaded = true;
}

// מקבל אלמנט <img> טעון ומחזיר מערך של טביעות אצבע (אחת לכל פרצוף שזוהה בתמונה)
export async function getFaceDescriptors(imageElement) {
  const detections = await faceapi
    .detectAllFaces(imageElement, new faceapi.TinyFaceDetectorOptions())
    .withFaceLandmarks()
    .withFaceDescriptors();
  return detections.map((d) => Array.from(d.descriptor));
}

function euclideanDistance(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2;
  return Math.sqrt(sum);
}

// סף התאמה - ככל שנמוך יותר, ההתאמה מחמירה יותר. 0.55-0.6 הוא טווח סביר ל-face-api.js
const MATCH_THRESHOLD = 0.55;

export function descriptorsMatch(descriptorsA, descriptorsB) {
  for (const a of descriptorsA) {
    for (const b of descriptorsB) {
      if (euclideanDistance(a, b) < MATCH_THRESHOLD) return true;
    }
  }
  return false;
}

// עוזר: טוען קובץ תמונה (File) לתוך אלמנט Image בתוך הדפדפן, כדי ש-face-api יוכל לעבד אותו
export function fileToImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (e) => {
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
