import torch
import torch.nn as nn
from torchvision import transforms
from PIL import Image
import matplotlib.pyplot as plt
import os
import numpy as np
import rasterio
from flask import Flask, request, jsonify
import io
import base64

# Model path configuration - UPDATE THIS PATH TO YOUR MODEL FILE
MODEL_PATH = "C:\\Users\\Vinit\\Desktop\\isro\\nrsc\\ISRO_F\\ISRO_NRSC\\unet_builtup_cd.pth"  # Change this to your actual model path

# --- UNet Model Definition ---
class UNet(nn.Module):
    def __init__(self, in_channels=6, out_channels=1):
        super(UNet, self).__init__()
        self.enc1 = self.conv_block(in_channels, 64)
        self.enc2 = self.conv_block(64, 128)
        self.enc3 = self.conv_block(128, 256)
        self.enc4 = self.conv_block(256, 512)
        self.pool = nn.MaxPool2d(2)
        self.center = self.conv_block(512, 1024)
        self.up4 = nn.ConvTranspose2d(1024, 512, kernel_size=2, stride=2)
        self.dec4 = self.conv_block(1024, 512)
        self.up3 = nn.ConvTranspose2d(512, 256, kernel_size=2, stride=2)
        self.dec3 = self.conv_block(512, 256)
        self.up2 = nn.ConvTranspose2d(256, 128, kernel_size=2, stride=2)
        self.dec2 = self.conv_block(256, 128)
        self.up1 = nn.ConvTranspose2d(128, 64, kernel_size=2, stride=2)
        self.dec1 = self.conv_block(128, 64)
        self.final = nn.Conv2d(64, out_channels, kernel_size=1)

    def conv_block(self, in_channels, out_channels):
        block = nn.Sequential(
            nn.Conv2d(in_channels, out_channels, kernel_size=3, padding=1),
            nn.BatchNorm2d(out_channels),
            nn.ReLU(inplace=True),
            nn.Conv2d(out_channels, out_channels, kernel_size=3, padding=1),
            nn.BatchNorm2d(out_channels),
            nn.ReLU(inplace=True)
        )
        return block

    def forward(self, x):
        enc1 = self.enc1(x)
        enc2 = self.enc2(self.pool(enc1))
        enc3 = self.enc3(self.pool(enc2))
        enc4 = self.enc4(self.pool(enc3))
        center = self.center(self.pool(enc4))
        dec4 = self.up4(center)
        dec4 = torch.cat([dec4, enc4], dim=1)
        dec4 = self.dec4(dec4)
        dec3 = self.up3(dec4)
        dec3 = torch.cat([dec3, enc3], dim=1)
        dec3 = self.dec3(dec3)
        dec2 = self.up2(dec3)
        dec2 = torch.cat([dec2, enc2], dim=1)
        dec2 = self.dec2(dec2)
        dec1 = self.up1(dec2)
        dec1 = torch.cat([dec1, enc1], dim=1)
        dec1 = self.dec1(dec1)
        out = self.final(dec1)
        return out

class ChangeDetectionService:
    def __init__(self, model_path=None):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.image_size = (256, 256)
        self.transform = transforms.Compose([
            transforms.Resize(self.image_size),
            transforms.ToTensor(),
        ])
        self.model = None
        self.model_path = model_path
        if model_path:
            self.load_model(model_path)

    def load_model(self, model_path):
        """Load the trained UNet model from the specified path"""
        try:
            self.model = UNet(in_channels=6, out_channels=1)
            
            if os.path.exists(model_path):
                self.model.load_state_dict(torch.load(model_path, map_location=self.device))
                self.model.to(self.device)
                self.model.eval()
                print(f"Model loaded successfully from {model_path}")
                self.model_path = model_path
            else:
                print(f"Model file not found at {model_path}")
                self.model = None
        except Exception as e:
            print(f"Error loading model: {str(e)}")
            self.model = None

    def preprocess_image(self, image_data):
        """Preprocess uploaded image data"""
        try:
            # If image_data is base64 string, decode it
            if isinstance(image_data, str):
                image_data = base64.b64decode(image_data.split(',')[1])
            
            # Open image from bytes
            original_image = Image.open(io.BytesIO(image_data)).convert('RGB')
            
            # Keep original size for visualization
            original_size = original_image.size
            
            # Transform for model (resizes to 256x256)
            tensor = self.transform(original_image)
            
            # Also create a resized version for consistent visualization
            resized_image = original_image.resize(self.image_size, Image.LANCZOS)
            
            return tensor, resized_image, original_size
        except Exception as e:
            print(f"Error preprocessing image: {str(e)}")
            return None, None, None

    def detect_changes(self, pre_image_data, post_image_data):
        """Run change detection on pre and post images"""
        if not self.model:
            return {"error": "Model not loaded"}

        try:
            # Preprocess images
            pre_tensor, pre_image, pre_original_size = self.preprocess_image(pre_image_data)
            post_tensor, post_image, post_original_size = self.preprocess_image(post_image_data)

            if pre_tensor is None or post_tensor is None:
                return {"error": "Failed to process images"}

            # Concatenate pre and post images along the channel dimension
            input_tensor = torch.cat([pre_tensor, post_tensor], dim=0).unsqueeze(0)

            # Run inference
            with torch.no_grad():
                input_tensor = input_tensor.to(self.device)
                output = self.model(input_tensor)
                pred = torch.sigmoid(output)
                pred_mask = (pred > 0.5).float().squeeze().cpu().numpy()

            # Convert mask to uint8 for visualization
            mask_uint8 = (pred_mask * 255).astype(np.uint8)

            # Create visualization
            result_images = self.create_visualization(pre_image, post_image, pred_mask)
            
            # Calculate statistics
            total_pixels = pred_mask.size
            changed_pixels = np.sum(pred_mask > 0.5)
            change_percentage = (changed_pixels / total_pixels) * 100

            return {
                "success": True,
                "change_percentage": round(change_percentage, 2),
                "changed_pixels": int(changed_pixels),
                "total_pixels": int(total_pixels),
                "mask_image": result_images["mask"],
                "comparison_image": result_images["comparison"],
                "overlay_image": result_images["overlay"]
            }

        except Exception as e:
            print(f"Error in change detection: {str(e)}")
            return {"error": f"Change detection failed: {str(e)}"}

    def create_visualization(self, pre_image, post_image, pred_mask):
        """Create visualization images"""
        try:
            # Create figure with subplots
            fig, axes = plt.subplots(1, 4, figsize=(20, 5))
            
            # Pre-image
            axes[0].imshow(pre_image)
            axes[0].set_title("Pre-Image", fontsize=12)
            axes[0].axis("off")
            
            # Post-image
            axes[1].imshow(post_image)
            axes[1].set_title("Post-Image", fontsize=12)
            axes[1].axis("off")
            
            # Change mask
            axes[2].imshow(pred_mask, cmap='Reds')
            axes[2].set_title("Change Detection Mask", fontsize=12)
            axes[2].axis("off")
            
            # Overlay - create red overlay for changes
            overlay = np.array(post_image.copy())
            
            # Ensure pred_mask is the right shape (should be 256x256 same as resized images)
            if len(pred_mask.shape) == 2:  # 2D mask
                # Create red overlay for changes
                red_overlay = np.zeros_like(overlay)
                red_overlay[:, :, 0] = pred_mask * 255  # Red channel for changes
                overlay = np.clip(overlay + red_overlay * 0.5, 0, 255).astype(np.uint8)
            else:
                print(f"Warning: Unexpected pred_mask shape: {pred_mask.shape}")
                overlay = np.array(post_image.copy())  # Fallback to original image
            axes[3].imshow(overlay)
            axes[3].set_title("Change Overlay", fontsize=12)
            axes[3].axis("off")
            
            plt.tight_layout()
            
            # Save to base64
            buffer = io.BytesIO()
            plt.savefig(buffer, format='png', dpi=100, bbox_inches='tight')
            buffer.seek(0)
            comparison_b64 = base64.b64encode(buffer.getvalue()).decode()
            plt.close()
            
            # Create individual mask image
            mask_fig, mask_ax = plt.subplots(figsize=(6, 6))
            mask_ax.imshow(pred_mask, cmap='Reds')
            mask_ax.set_title("Built-up Change Detection")
            mask_ax.axis("off")
            
            mask_buffer = io.BytesIO()
            mask_fig.savefig(mask_buffer, format='png', dpi=100, bbox_inches='tight')
            mask_buffer.seek(0)
            mask_b64 = base64.b64encode(mask_buffer.getvalue()).decode()
            plt.close()
            
            # Create overlay image
            overlay_fig, overlay_ax = plt.subplots(figsize=(6, 6))
            overlay_ax.imshow(overlay)
            overlay_ax.set_title("Changes Highlighted in Red")
            overlay_ax.axis("off")
            
            overlay_buffer = io.BytesIO()
            overlay_fig.savefig(overlay_buffer, format='png', dpi=100, bbox_inches='tight')
            overlay_buffer.seek(0)
            overlay_b64 = base64.b64encode(overlay_buffer.getvalue()).decode()
            plt.close()
            
            return {
                "mask": f"data:image/png;base64,{mask_b64}",
                "comparison": f"data:image/png;base64,{comparison_b64}",
                "overlay": f"data:image/png;base64,{overlay_b64}"
            }
            
        except Exception as e:
            print(f"Error creating visualization: {str(e)}")
            return {"mask": "", "comparison": "", "overlay": ""}

# Global service instance - will be initialized automatically
change_detection_service = ChangeDetectionService(MODEL_PATH)

def detect_building_changes(pre_image_data, post_image_data):
    """API function for change detection"""
    if not change_detection_service or not change_detection_service.model:
        return {"error": "Model not loaded. Please check MODEL_PATH in change_detection.py"}
    return change_detection_service.detect_changes(pre_image_data, post_image_data)