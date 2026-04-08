





# OMNIVIEW

**AI-Powered Satellite Image Analysis Software**  
Built with Electron (Frontend) + Python (Backend) for real-time geospatial intelligence and image analysis.

## ✨ Key Features

- **Disaster Dashboard:** Real-time news, alerts, and geospatial data visualization.
- **Analytics:** Visualize disaster patterns, land classification, NDVI, and trends with interactive charts and maps.
- **Extract Big Roads (NEW):**
  - Upload large Sentinel-2 (TIFF) satellite tiles and extract road networks using a local ML model.
  - View original image, road mask, and overlay comparison (zoomable, with overlay toggle).
  - All results are stored in `backend/big_masks` and cleaned up automatically.
- **Modular UI:** Switch between Monitoring, Disaster, and Analytics screens with sub-tabs for each analysis type.
- **Temp File Handling:** All large outputs are stored in a local folder and auto-cleaned for disk efficiency.


## 🧩 Project Structure

```

omniview/
├── backend/         # Python-based API for ML models, image processing
│   ├── app.py
│   ├── requirements.txt
│   └── ...
├── frontend/        # Electron-based UI
│   ├── main.js
│   ├── package.json
│   └── ...
└── README.md

```

## ⚙️ Prerequisites

- **Node.js** (v16+ recommended)
- **Python 3.7+**
- **pip** (Python package manager)
- **TensorFlow** (for road extraction ML model)
- **OpenCV** (for image processing)
- **Git** (optional)
- **Docker** (optional for containerized setup)



## 🚀 Setup Instructions

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/omniview.git
cd omniview
```



## 2. Set Up the Backend (Python)

```bash
cd backend
#if want a virtual environment
    python -m venv venv         # Create virtual environment
    source venv/bin/activate    # On Windows: venv\Scripts\activate


# Install all Python dependencies
pip install -r requirements.txt

# For road extraction, also install:
pip install tensorflow opencv-python

# Download the Road Extraction Model
# [Download model link here]
# Place the model file (e.g. `road_detection_resnet_e50.h5`) in a known location and update `MODEL_PATH` in `backend/road_extract.py` if needed.

# Run backend server
python app.py
```

> 🔁 Make sure `app.py` runs on `localhost:5000` (or configure in `.env` if using one).

---


### 3. Set Up the Frontend (Electron)

```bash
cd ../frontend
npm install      # Install Electron and other dependencies
npm start        # Launch Electron app
```

> This will open the OMNIVIEW UI and communicate with the backend at `localhost:5000`.

---

## 🐳 Optional: Run with Docker

To run the backend inside Docker:

```bash
cd backend
docker build -t omniview-backend .
docker run -p 5000:5000 omniview-backend
```

> You can also dockerize the entire app using Docker Compose if needed.

---


## 📝 Notes

- Ensure the backend is running before launching the frontend.
- For **Extract Big Roads**, results are saved in `backend/big_masks` and are accessible via the UI.
- If you change the backend port or run frontend separately, update API URLs in the frontend config.
- For packaging Electron:
  Use tools like `electron-builder` or `electron-forge`:

  ```bash
  npm install --save-dev electron-builder
  npx electron-builder
  ```

---

## 🧠 Model Setup for Road Extraction

1. Download the pre-trained road extraction model (link to be provided):
   - [Download model link here]
2. Place the model file (e.g. `road_detection_resnet_e50.h5`) in a known location.
3. Update the `MODEL_PATH` variable in `backend/road_extract.py` if your path is different.
4. Ensure you have installed TensorFlow and OpenCV as shown above.

---

---


replace model path in landcover.py

