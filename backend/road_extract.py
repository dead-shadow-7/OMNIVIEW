import os
import tempfile
import shutil
import cv2
import numpy as np
import tensorflow as tf
from flask import Blueprint, request, jsonify, send_file, current_app as app
from werkzeug.utils import secure_filename
from datetime import datetime, timedelta

road_extract_bp = Blueprint('road_extract', __name__)

MODEL_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ml_models", "road_detection_resnet_e50.h5")
TARGET_SIZE = (256, 256)
PATCH_SIZE = (500, 500)
NUM_CROPS = 8
SAVE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "big_masks")
CLEANUP_INTERVAL = 60 * 60  # 1 hour

# Ensure save dir exists
if not os.path.exists(SAVE_DIR):
    os.makedirs(SAVE_DIR)

# --- Helper: Cleanup old files ---
def cleanup_temp_files():
    now = datetime.now()
    for fname in os.listdir(SAVE_DIR):
        fpath = os.path.join(SAVE_DIR, fname)
        if os.path.isfile(fpath):
            mtime = datetime.fromtimestamp(os.path.getmtime(fpath))
            if (now - mtime) > timedelta(hours=2):
                try:
                    os.remove(fpath)
                except Exception:
                    pass

# --- Main API ---
@road_extract_bp.route('/api/extract_roads', methods=['POST'])
def extract_roads():
    try:
        cleanup_temp_files()
        if 'file' not in request.files:
            app.logger.error('No file uploaded')
            return jsonify({'error': 'No file uploaded'}), 400
        file = request.files['file']
        filename = secure_filename(file.filename)
        if not filename.lower().endswith(('.tif', '.tiff')):
            app.logger.error('Only TIFF files supported')
            return jsonify({'error': 'Only TIFF files supported'}), 400
        # Save uploaded file
        temp_input = os.path.join(SAVE_DIR, f"input_{datetime.now().timestamp()}_{filename}")
        file.save(temp_input)
        base_filename = os.path.splitext(os.path.basename(temp_input))[0]
        # --- Step 2: Load TIFF image ---
        img = cv2.imread(temp_input)
        if img is None:
            app.logger.error(f'Cannot load image: {temp_input}')
            return jsonify({'error': 'Cannot load image'}), 400
        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        height, width, _ = img.shape
        # --- Step 3: Convert TIFF to PNG ---
        png_path = os.path.join(SAVE_DIR, f"{base_filename}.png")
        cv2.imwrite(png_path, img)
        # --- Step 6: Load model ---
        model = tf.keras.models.load_model(MODEL_PATH)
        # --- Step 7: Prepare full masks ---
        full_prob_mask = np.zeros((height, width), dtype=np.float32)
        full_binary_mask = np.zeros((height, width), dtype=np.uint8)
        # --- Step 8: Process crops ---
        crop_rows, crop_cols = 2, 4
        crop_height = int(np.ceil(height / crop_rows))
        crop_width = int(np.ceil(width / crop_cols))
        for i in range(crop_rows):
            for j in range(crop_cols):
                y0 = i * crop_height
                y1 = min((i + 1) * crop_height, height)
                x0 = j * crop_width
                x1 = min((j + 1) * crop_width, width)
                crop = img[y0:y1, x0:x1]
                ch, cw, _ = crop.shape
                n_rows = int(np.ceil(ch / PATCH_SIZE[1]))
                n_cols = int(np.ceil(cw / PATCH_SIZE[0]))
                crop_prob_mask = np.zeros((ch, cw), dtype=np.float32)
                crop_binary_mask = np.zeros((ch, cw), dtype=np.uint8)
                for pi in range(n_rows):
                    for pj in range(n_cols):
                        py0 = pi * PATCH_SIZE[1]
                        py1 = min((pi + 1) * PATCH_SIZE[1], ch)
                        px0 = pj * PATCH_SIZE[0]
                        px1 = min((pj + 1) * PATCH_SIZE[0], cw)
                        patch = crop[py0:py1, px0:px1]
                        patch_resized = cv2.resize(patch, TARGET_SIZE)
                        patch_input = np.expand_dims(patch_resized / 255.0, axis=0)
                        pred = model.predict(patch_input, verbose=0)[0]
                        pred_binary = (pred > 0.5).astype(np.uint8)
                        pred_resized = cv2.resize(pred.squeeze(), (px1-px0, py1-py0), interpolation=cv2.INTER_LINEAR)
                        pred_binary_resized = cv2.resize(pred_binary.squeeze(), (px1-px0, py1-py0), interpolation=cv2.INTER_NEAREST)
                        crop_prob_mask[py0:py1, px0:px1] = pred_resized
                        crop_binary_mask[py0:py1, px0:px1] = pred_binary_resized
                full_prob_mask[y0:y1, x0:x1] = crop_prob_mask
                full_binary_mask[y0:y1, x0:x1] = crop_binary_mask
        # --- Step 9: Save final masks ---
        prob_mask_path = os.path.join(SAVE_DIR, f"{base_filename}_prob_mask.png")
        binary_mask_path = os.path.join(SAVE_DIR, f"{base_filename}_binary_mask.png")
        cv2.imwrite(prob_mask_path, (full_prob_mask * 255).astype(np.uint8))
        cv2.imwrite(binary_mask_path, full_binary_mask * 255)
        # --- Post-processing ---
        threshold = 127
        min_road_area = 500
        kernel_size_close = 7
        kernel_size_open = 3
        alpha = 0.6
        orig_img = img
        prob_mask = (full_prob_mask * 255).astype(np.uint8)
        _, binary_mask = cv2.threshold(prob_mask, threshold, 255, cv2.THRESH_BINARY)
        kernel_close = cv2.getStructuringElement(cv2.MORPH_RECT, (kernel_size_close, kernel_size_close))
        closed_mask = cv2.morphologyEx(binary_mask, cv2.MORPH_CLOSE, kernel_close)
        kernel_open = cv2.getStructuringElement(cv2.MORPH_RECT, (kernel_size_open, kernel_size_open))
        opened_mask = cv2.morphologyEx(closed_mask, cv2.MORPH_OPEN, kernel_open)
        num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(opened_mask, connectivity=8)
        processed_mask = np.zeros_like(opened_mask)
        for i in range(1, num_labels):
            if stats[i, cv2.CC_STAT_AREA] >= min_road_area:
                processed_mask[labels == i] = 255
        high_prob_mask = (prob_mask > 200).astype(np.uint8) * 255
        filled_mask = cv2.bitwise_or(processed_mask, high_prob_mask)
        overlay = orig_img.copy()
        red_mask = np.zeros_like(orig_img)
        red_mask[:, :, 0] = filled_mask
        overlay = cv2.addWeighted(overlay, 1, red_mask, alpha, 0)
        processed_mask_path = os.path.join(SAVE_DIR, f"{base_filename}_processed_mask.png")
        overlay_path = os.path.join(SAVE_DIR, f"{base_filename}_overlay.png")
        cv2.imwrite(processed_mask_path, filled_mask)
        cv2.imwrite(overlay_path, cv2.cvtColor(overlay, cv2.COLOR_RGB2BGR))
        # --- Return URLs (use send_file endpoint) ---
        base_url = request.host_url.rstrip('/')
        return jsonify({
            'orig_url': f'{base_url}/api/bigroads_file/{os.path.basename(png_path)}',
            'mask_url': f'{base_url}/api/bigroads_file/{os.path.basename(processed_mask_path)}',
            'overlay_url': f'{base_url}/api/bigroads_file/{os.path.basename(overlay_path)}'
        })
    except Exception as e:
        import traceback
        app.logger.error(f"Error in /api/extract_roads: {e}\n{traceback.format_exc()}")
        return jsonify({'error': str(e)}), 500

# Serve temp files
@road_extract_bp.route('/api/bigroads_file/<filename>')
def serve_bigroads_file(filename):
    fpath = os.path.join(SAVE_DIR, filename)
    if not os.path.exists(fpath):
        return 'Not found', 404
    return send_file(fpath)
