"""
Glacial Lake Change Detection Service

Wraps a UNet-ResNet34 segmentation model that masks glacial lakes in satellite
imagery, then compares two time-separated masks to compute area change
(gained / lost / net) in pixels and hectares.

Tiled sliding-window inference preserves the original geospatial resolution —
no resizing of the input image. Pre and post images must share dimensions.
"""
from flask import Blueprint, request, jsonify
import os
import io
import base64
import traceback

import numpy as np
import cv2
import torch
import segmentation_models_pytorch as smp
from PIL import Image
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Patch

glacial_lake_bp = Blueprint("glacial_lake", __name__)

# ── Config ─────────────────────────────────────────────────────────────
MODEL_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "ml_models",
    "unet_resnet34_glacial_lake.pth",
)
TILE_SIZE = 256
TILE_OVERLAP = 64
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# ImageNet stats — match training preprocessing in reference Gradio app
IMAGENET_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
IMAGENET_STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)

RESOLUTION_OPTIONS = {
    "sentinel2": 10,   # Sentinel-2 native 10 m/px
    "landsat30": 30,   # Landsat / GEE 30 m export
}


# ── Model wrapper ──────────────────────────────────────────────────────
class GlacialLakeMaskTester:
    def __init__(self, model_path=MODEL_PATH):
        self.device = DEVICE
        self.tile_size = TILE_SIZE
        self.tile_overlap = TILE_OVERLAP
        self.model_path = model_path
        self.model_loaded = False

        self.model = smp.Unet(
            encoder_name="resnet34",
            encoder_weights=None,  # weights come from state dict
            in_channels=3,
            classes=1,
        ).to(self.device)
        self._load_weights()

    def _load_weights(self):
        if not os.path.exists(self.model_path):
            print(f"[GlacialLake] Model file not found at {self.model_path}")
            return
        try:
            state_dict = torch.load(self.model_path, map_location=self.device)
            self.model.load_state_dict(state_dict)
            self.model.eval()
            self.model_loaded = True
            print(f"[GlacialLake] Loaded resnet34 model from {self.model_path}")
        except Exception as e:
            print(f"[GlacialLake] Failed to load model: {e}")

    @staticmethod
    def _decode_image(image_data):
        """Accept base64 data URL / raw base64 / bytes → uint8 RGB ndarray."""
        if isinstance(image_data, str):
            if "," in image_data:
                image_data = image_data.split(",", 1)[1]
            image_data = base64.b64decode(image_data)
        pil_img = Image.open(io.BytesIO(image_data)).convert("RGB")
        return np.array(pil_img)

    def _normalize_tile(self, tile_uint8):
        """ImageNet normalization → CHW float32 tensor."""
        tile = tile_uint8.astype(np.float32) / 255.0
        tile = (tile - IMAGENET_MEAN) / IMAGENET_STD
        # HWC → CHW
        tile = np.transpose(tile, (2, 0, 1))
        return torch.from_numpy(tile).unsqueeze(0).to(self.device)

    def predict_mask_tiled(self, img_array, confidence_threshold=0.5):
        H, W = img_array.shape[:2]
        stride = self.tile_size - self.tile_overlap

        pad_h_min = max(0, self.tile_size - H)
        pad_w_min = max(0, self.tile_size - W)
        H2, W2 = H + pad_h_min, W + pad_w_min

        pad_h_extra = (stride - (H2 - self.tile_size) % stride) % stride
        pad_w_extra = (stride - (W2 - self.tile_size) % stride) % stride
        pad_h = pad_h_min + pad_h_extra
        pad_w = pad_w_min + pad_w_extra

        img_padded = cv2.copyMakeBorder(
            img_array, 0, pad_h, 0, pad_w, borderType=cv2.BORDER_REFLECT_101
        )
        pH, pW = img_padded.shape[:2]

        prob_accum = np.zeros((pH, pW), dtype=np.float32)
        count_map = np.zeros((pH, pW), dtype=np.float32)

        with torch.no_grad():
            for y in range(0, pH - self.tile_size + 1, stride):
                for x in range(0, pW - self.tile_size + 1, stride):
                    tile = img_padded[y:y + self.tile_size, x:x + self.tile_size]
                    tensor = self._normalize_tile(tile)
                    logits = self.model(tensor)
                    prob = torch.sigmoid(logits).cpu().squeeze().numpy()
                    prob_accum[y:y + self.tile_size, x:x + self.tile_size] += prob
                    count_map[y:y + self.tile_size, x:x + self.tile_size] += 1.0

        count_map[count_map == 0] = 1
        prob_map_full = (prob_accum / count_map)[:H, :W]
        binary_mask = (prob_map_full > confidence_threshold).astype(np.float32)
        return binary_mask, prob_map_full

    @staticmethod
    def compute_change_metrics(mask1, mask2, pixel_resolution_m=10):
        new_water = np.logical_and(mask2 == 1, mask1 == 0).astype(np.uint8)
        lost_water = np.logical_and(mask1 == 1, mask2 == 0).astype(np.uint8)

        total1 = int(np.sum(mask1))
        total2 = int(np.sum(mask2))
        gained = int(np.sum(new_water))
        lost = int(np.sum(lost_water))
        delta = total2 - total1
        pct_change = (delta / total1 * 100) if total1 > 0 else 0.0

        pixel_area_m2 = pixel_resolution_m ** 2
        to_ha = lambda px: px * pixel_area_m2 / 10_000

        stats = {
            "area_t1": total1,
            "area_t2": total2,
            "gained": gained,
            "lost": lost,
            "delta": delta,
            "pct_change": round(pct_change, 2),
            "pixel_res_m": pixel_resolution_m,
            "area_t1_ha": round(to_ha(total1), 2),
            "area_t2_ha": round(to_ha(total2), 2),
            "gained_ha": round(to_ha(gained), 2),
            "lost_ha": round(to_ha(lost), 2),
            "delta_ha": round(to_ha(delta), 2),
        }
        return new_water, lost_water, stats


# ── Visualization helpers ──────────────────────────────────────────────

def _change_visualization(img1, img2, mask1, mask2, new_water, lost_water, stats):
    fig, axes = plt.subplots(2, 2, figsize=(12, 10))
    fig.patch.set_facecolor("white")

    axes[0, 0].imshow(img1)
    axes[0, 0].set_title("Time 1 – Original Image", fontsize=14, fontweight="bold")
    axes[0, 0].axis("off")

    axes[0, 1].imshow(img2)
    axes[0, 1].set_title("Time 2 – Original Image", fontsize=14, fontweight="bold")
    axes[0, 1].axis("off")

    change_map = np.zeros((*mask1.shape, 3), dtype=np.uint8)
    stable_lake = np.logical_and(mask1 == 1, mask2 == 1)
    change_map[stable_lake] = [0, 0, 255]
    change_map[new_water == 1] = [0, 200, 0]
    change_map[lost_water == 1] = [220, 0, 0]

    axes[1, 0].imshow(change_map)
    axes[1, 0].set_title("Change Map", fontsize=14, fontweight="bold")
    axes[1, 0].axis("off")

    axes[1, 1].axis("off")
    res = stats["pixel_res_m"]
    stats_text = (
        f"Resolution: {res} m/px  |  1 px = {res * res:,} m²\n"
        f"Inference : tiled {TILE_SIZE}×{TILE_SIZE}, overlap {TILE_OVERLAP}px\n\n"
        f"Area T1 : {stats['area_t1']:>10,} px   {stats['area_t1_ha']:>8.2f} ha\n"
        f"Area T2 : {stats['area_t2']:>10,} px   {stats['area_t2_ha']:>8.2f} ha\n"
        f"Gained  : {stats['gained']:>10,} px   {stats['gained_ha']:>8.2f} ha\n"
        f"Lost    : {stats['lost']:>10,} px   {stats['lost_ha']:>8.2f} ha\n"
        f"Net Δ   : {stats['delta']:>+10,} px   {stats['delta_ha']:>+8.2f} ha\n"
        f"% Change: {stats['pct_change']:>+9.2f} %"
    )
    axes[1, 1].text(
        0.05, 0.95, stats_text,
        transform=axes[1, 1].transAxes,
        fontsize=11, va="top", ha="left",
        fontfamily="monospace",
        bbox=dict(boxstyle="round,pad=0.6", facecolor="#f0f9ff", edgecolor="#0284c7"),
    )
    legend_elements = [
        Patch(facecolor="blue", alpha=0.6, label="Stable Lake"),
        Patch(facecolor="green", alpha=0.6, label="New Lake Area"),
        Patch(facecolor="red", alpha=0.6, label="Lost Lake Area"),
    ]
    axes[1, 1].legend(handles=legend_elements, loc="lower left", frameon=False)

    plt.tight_layout()
    buf = io.BytesIO()
    plt.savefig(buf, format="png", dpi=100, bbox_inches="tight")
    plt.close(fig)
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


# ── Lazy singleton ─────────────────────────────────────────────────────
_tester = None

def get_tester():
    global _tester
    if _tester is None:
        _tester = GlacialLakeMaskTester()
    return _tester


# ── Endpoint ───────────────────────────────────────────────────────────
@glacial_lake_bp.route("/api/glacial-lake-change", methods=["POST"])
def glacial_lake_change():
    try:
        data = request.json or {}
        image1 = data.get("image1")
        image2 = data.get("image2")
        if not image1 or not image2:
            return jsonify({"error": "Both image1 and image2 are required"}), 400

        threshold = float(data.get("threshold", 0.5))
        threshold = max(0.05, min(0.95, threshold))
        resolution_key = data.get("resolution", "sentinel2")
        pixel_res_m = RESOLUTION_OPTIONS.get(resolution_key, 10)

        tester = get_tester()
        if not tester.model_loaded:
            return jsonify({
                "error": "Glacial lake model not loaded. "
                         f"Expected weights at {MODEL_PATH}"
            }), 500

        img1 = tester._decode_image(image1)
        img2 = tester._decode_image(image2)

        if img1.shape != img2.shape:
            return jsonify({
                "error": "Image dimensions must match.",
                "details": (
                    f"T1: {img1.shape[1]}×{img1.shape[0]} px, "
                    f"T2: {img2.shape[1]}×{img2.shape[0]} px. "
                    "Export both images at the same resolution and extent."
                ),
            }), 400

        mask1, _ = tester.predict_mask_tiled(img1, threshold)
        mask2, _ = tester.predict_mask_tiled(img2, threshold)
        new_water, lost_water, stats = tester.compute_change_metrics(
            mask1, mask2, pixel_resolution_m=pixel_res_m
        )

        return jsonify({
            "status": "success",
            "stats": stats,
            "threshold": threshold,
            "resolution_m": pixel_res_m,
            "change_image": _change_visualization(
                img1, img2, mask1, mask2, new_water, lost_water, stats
            ),
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": "Glacial lake change detection failed",
                        "details": str(e)}), 500
