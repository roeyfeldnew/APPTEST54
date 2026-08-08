let faceapi = null;

// קבצי המודלים נמצאים בתיקייה public/models
const MODEL_URL = "/models";

let modelsLoaded = false;

async function getFaceApi() {
  if (typeof window === "undefined") {
    throw new Error("face-api.js can only run in the browser");
  }

  if (!faceapi) {
    faceapi = await import("face-api.js");
  }

  return faceapi;
}

export async function loadModels() {
  if (modelsLoaded) return;

  const api = await getFaceApi();

  await Promise.all([
    api.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    api.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
    api.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
  ]);

  modelsLoaded = true;
}

export async function getFaceDescriptors(imageElement) {
  const api = await getFaceApi();

  const detections = await api
    .detectAllFaces(
      imageElement,
      new api.TinyFaceDetectorOptions()
    )
    .withFaceLandmarks()
    .withFaceDescriptors();

  return detections.map((d) => Array.from(d.descriptor));
}

function euclideanDistance(a, b) {
  let sum = 0;

  for (let i = 0; i < a.length; i++) {
    sum += (a[i] - b[i]) ** 2;
  }

  return Math.sqrt(sum);
}

// סף התאמה
const MATCH_THRESHOLD = 0.55;

export function descriptorsMatch(descriptorsA, descriptorsB) {
  for (const a of descriptorsA) {
    for (const b of descriptorsB) {
      if (euclideanDistance(a, b) < MATCH_THRESHOLD) {
        return true;
      }
    }
  }

  return false;
}

// טוען File לתוך Image בדפדפן
export function fileToImage(file) {
  if (typeof window === "undefined") {
    throw new Error("fileToImage can only run in the browser");
  }

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
