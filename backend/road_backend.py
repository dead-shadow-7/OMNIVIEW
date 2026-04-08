from flask import Blueprint, jsonify, request
import base64
import tempfile
import os
import traceback
import numpy as np
import cv2
import tensorflow as tf

# Load model once at import time
MODEL_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ml_models", "road_detection_resnet_e50.h5")
_model = None

def _get_model():
    global _model
    if _model is None:
        print(f"[Road Detection] Loading model from {MODEL_PATH}...")
        _model = tf.keras.models.load_model(MODEL_PATH)
        print("[Road Detection] Model loaded successfully.")
    return _model

# Create a blueprint instead of a Flask app
road_bp = Blueprint("road_backend", __name__)

@road_bp.route("/api/status")
def status():
    return jsonify({"status": "OMNIVU road backend module loaded"})

@road_bp.route("/api/area", methods=["POST"])
def area():
    data = request.json
    bounds = data.get("bounds")
    return jsonify({"message": "Area received", "bounds": bounds})

@road_bp.route("/api/satellite-image", methods=["POST"])
def satellite_image():
    data = request.json
    bounds = data.get("bounds")
    image_url = "https://via.placeholder.com/300x300?text=Satellite+Image"
    return jsonify({"url": image_url})



@road_bp.route("/api/extract-roads", methods=["POST"])
def extract_roads():
    data = request.json
    bounds = data.get("bounds")
    return jsonify({"summary": "Roads extracted for selected area."})

# Road detection — local model inference
@road_bp.route("/api/road-detection", methods=["POST"])
def road_detection():
    try:
        data = request.get_json(force=True)
        image_base64 = data.get("image_base64")

        if not image_base64:
            return jsonify({"error": "No image provided"}), 400

        # Decode base64 (strip data URI prefix if present)
        if "," in image_base64:
            _, b64 = image_base64.split(",", 1)
        else:
            b64 = image_base64

        image_data = base64.b64decode(b64)

        # Decode image from bytes
        img_array = np.frombuffer(image_data, dtype=np.uint8)
        img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
        if img is None:
            return jsonify({"error": "Could not decode image"}), 400

        # Preprocess for model
        img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        img_resized = cv2.resize(img_rgb, (256, 256))
        img_normalized = img_resized / 255.0
        img_input = np.expand_dims(img_normalized, axis=0)

        # Run inference
        print("[Road Detection] Running local inference...")
        model = _get_model()
        pred = model.predict(img_input, verbose=0)[0]  # shape: (256,256,1)

        # Convert probability mask to image
        prob_display = (pred.squeeze() * 255).astype(np.uint8)

        # Encode as PNG and return as base64
        _, buffer = cv2.imencode(".png", prob_display)
        prob_mask_b64 = "data:image/png;base64," + base64.b64encode(buffer).decode()

        print("[Road Detection] Inference complete.")
        return jsonify({
            "probability_mask": prob_mask_b64
        }), 200

    except Exception as e:
        tb = traceback.format_exc()
        return jsonify({"error": str(e), "traceback": tb}), 500

@road_bp.route("/api/disaster-geojson", methods=["POST"])
def disaster_geojson():
    data = request.json
    geojson_data = data.get("geojson")
    return jsonify({"message": "GeoJSON data received", "geojson": geojson_data})