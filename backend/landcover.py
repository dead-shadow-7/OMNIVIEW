"""
Land Cover Segmentation Service
Uses a UNet ONNX model to classify satellite imagery into 5 classes:
  Background, Buildings, Trees/Greens, Water, Road
"""
from flask import Blueprint, request, jsonify
import onnxruntime as ort
import numpy as np
from PIL import Image
import requests
from io import BytesIO
import base64
import math
import traceback
import os

landcover_bp = Blueprint('landcover', __name__)

# ── Model path ──────────────────────────────────────────────────────────────
MODEL_PATH = r"C:\Users\Vinit\Downloads\unet_poland_ds_modelv1.onnx"

# ── Class definitions ───────────────────────────────────────────────────────
CLASS_NAMES = ['Background', 'Buildings', 'Trees/Greens', 'Water', 'Road']
# RGB colours matching the frontend palette
CLASS_COLORS = [
    (74, 35, 90),     # Background  – purple
    (255, 185, 0),    # Buildings   – orange
    (15, 255, 0),     # Greens      – green
    (0, 139, 255),    # Water       – blue
    (255, 246, 0),    # Road        – yellow
]

# ── Load the ONNX model once at startup ─────────────────────────────────────
ort_session = None
try:
    if os.path.exists(MODEL_PATH):
        ort_session = ort.InferenceSession(MODEL_PATH)
        print(f"[Landcover] ONNX model loaded from {MODEL_PATH}")
    else:
        print(f"[Landcover] WARNING: model not found at {MODEL_PATH}")
except Exception as e:
    print(f"[Landcover] Error loading model: {e}")


# ── Helper functions ────────────────────────────────────────────────────────

def lat_lon_to_tile(lat, lon, zoom):
    """Convert latitude/longitude to WMTS tile coordinates."""
    n = 2 ** zoom
    x_tile = int((lon + 180) / 360 * n)
    y_tile = int(
        (1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * n
    )
    return x_tile, y_tile


def fetch_satellite_tile(lat, lon, zoom=17):
    """Fetch a single 256×256 ESRI World Imagery tile."""
    x, y = lat_lon_to_tile(lat, lon, zoom)
    url = (
        f"https://server.arcgisonline.com/ArcGIS/rest/services/"
        f"World_Imagery/MapServer/tile/{zoom}/{y}/{x}"
    )
    resp = requests.get(url, timeout=15)
    if resp.status_code != 200:
        raise RuntimeError(f"Tile fetch failed ({resp.status_code})")
    return Image.open(BytesIO(resp.content)).convert('RGB').resize((256, 256))


def preprocess(image: Image.Image):
    """Normalise a PIL image into the shape expected by the model (1,256,256,3)."""
    img = image.resize((256, 256))
    arr = np.array(img).astype(np.float32).flatten()
    mn, mx = arr.min(), arr.max()
    if mx - mn > 0:
        arr = (arr - mn) / (mx - mn)
    return arr.reshape(1, 256, 256, 3)


def run_inference(session, tensor):
    """Run ONNX inference and return a (256,256) class‑index map."""
    input_name = session.get_inputs()[0].name
    output = session.run(None, {input_name: tensor})[0]
    flat = output.flatten()
    num_classes = 5
    indices = [int(np.argmax(flat[i:i + num_classes])) for i in range(0, len(flat), num_classes)]
    return np.array(indices, dtype=np.uint8).reshape(256, 256)


def prediction_to_color_image(prediction):
    """Map class indices to an RGB PIL image."""
    h, w = prediction.shape
    rgb = np.zeros((h, w, 3), dtype=np.uint8)
    for idx, color in enumerate(CLASS_COLORS):
        rgb[prediction == idx] = color
    return Image.fromarray(rgb)


def pil_to_base64(img, fmt='PNG'):
    buf = BytesIO()
    img.save(buf, format=fmt)
    b64 = base64.b64encode(buf.getvalue()).decode()
    return f"data:image/{fmt.lower()};base64,{b64}"


# ── API endpoint ────────────────────────────────────────────────────────────

@landcover_bp.route('/api/landcover', methods=['POST'])
def landcover_analysis():
    """
    Accepts JSON: { lat, lon, zoom? }
    or           { image_base64 }

    Returns JSON with original image, mask image (both base64),
    and per-class pixel counts/percentages.
    """
    try:
        if ort_session is None:
            return jsonify({"error": "Landcover model not loaded"}), 503

        data = request.get_json(force=True)

        # ── Option A: lat/lon → fetch tile from ESRI ────────────────────────
        if 'lat' in data and 'lon' in data:
            lat = float(data['lat'])
            lon = float(data['lon'])
            zoom = int(data.get('zoom', 17))
            orig_img = fetch_satellite_tile(lat, lon, zoom)
        # ── Option B: base64 image supplied by the frontend ─────────────────
        elif 'image_base64' in data:
            b64 = data['image_base64']
            if ',' in b64:
                b64 = b64.split(',', 1)[1]
            raw = base64.b64decode(b64)
            orig_img = Image.open(BytesIO(raw)).convert('RGB').resize((256, 256))
        else:
            return jsonify({"error": "Provide lat/lon or image_base64"}), 400

        # ── Run model ───────────────────────────────────────────────────────
        tensor = preprocess(orig_img)
        prediction = run_inference(ort_session, tensor)
        mask_img = prediction_to_color_image(prediction)

        # ── Class statistics ────────────────────────────────────────────────
        unique, counts = np.unique(prediction, return_counts=True)
        total = int(prediction.size)
        class_stats = []
        for i, name in enumerate(CLASS_NAMES):
            cnt = int(counts[unique == i][0]) if i in unique else 0
            class_stats.append({
                "name": name,
                "count": cnt,
                "percentage": round(cnt / total * 100, 2),
                "color": f"rgb({CLASS_COLORS[i][0]},{CLASS_COLORS[i][1]},{CLASS_COLORS[i][2]})"
            })

        return jsonify({
            "original": pil_to_base64(orig_img),
            "mask": pil_to_base64(mask_img),
            "classes": class_stats,
            "total_pixels": total
        }), 200

    except Exception as e:
        tb = traceback.format_exc()
        print(f"[Landcover] Error: {tb}")
        return jsonify({"error": str(e), "traceback": tb}), 500
