# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is OMNIVIEW

AI-powered satellite image analysis desktop application for disaster monitoring and geospatial intelligence. Electron frontend communicates with a Flask backend over REST at `localhost:5000`.

## Development Commands

### Backend (Python/Flask)
```bash
cd backend
python -m venv venv && venv\Scripts\activate   # Windows
pip install -r requirements.txt
python app.py                                   # Starts Flask on port 5000
```

### Frontend (Electron)
```bash
cd frontend
npm install
npm start          # Launch Electron app (backend must be running first)
```

### Build / Package
```bash
# Dev build (no minification)
npm run build

# Production build (minify + asar)
npm run dist

# electron-builder
npm run build:win
```

### Docker (backend only)
```bash
cd backend
docker build -t omniview-backend .
docker run -p 5000:5000 omniview-backend
```

### Tests
No test suite exists. The only smoke test is `GET /api/test` which checks Gemini, Google Search, and image generation connectivity.

## Architecture

### Frontend (Electron)
- **Entry point**: `frontend/src/main/main.js` — creates BrowserWindow, loads splash screen, sets up IPC and menus.
- **Screens** (each has `.html`, `.js`, `.css` in its own folder under `frontend/src/renderer/screens/`):
  - `splash/` — 12-second initialization sequence, then navigates to monitoring
  - `monitoring/` — building change detection UI, Leaflet map, location search (Nominatim)
  - `disaster/` — news search, post/pre-disaster maps, AI report generation
  - `analysis/` — voice commands, road extraction (TIFF upload), NDVI/classification charts (demo data)
  - `settings/` — placeholder
- **API config**: `frontend/src/renderer/screens/config.js` — all backend endpoint URLs defined here; update if endpoints change.
- **Shared**: `frontend/src/renderer/shared/logger.js` (TTS-enabled logger), `logs.html` (Ctrl+L toggle).
- No bundler — plain HTML/JS/CSS loaded directly by Electron. `minify.js` runs terser for production builds.
- UI libraries loaded via CDN/local: Leaflet, Leaflet.draw, html2canvas, Turf.js, Chart.js.

### Backend (Flask)
- **Main app**: `backend/app.py` (~1500 lines) — Flask routes + `DisasterResponseAgent` class that orchestrates the agentic pipeline (news search -> image analysis -> charts -> report).
- **ML modules**:
  - `change_detection.py` — PyTorch UNet (6-channel input: pre+post RGB stacked). Model weights: `backend/unet_builtup_cd.pth` (124MB).
  - `road_extract.py` — TensorFlow ResNet for road extraction from large TIFF tiles. Model weights loaded from a local path (not in repo). Outputs go to `backend/big_masks/` with auto-cleanup after 2 hours.
  - `road_backend.py` — Gradio client wrapper that delegates to HF Space `Vinit710/road_omniview`.
- **Services**: `services/flight_data.py` — background daemon thread fetching OpenSky Network every 4 minutes, caching to `flights.json`.
- **Standalone CLI** (not wired into Flask): `nlp_socilmedia.py` — Twitter/Reddit disaster data collector with spaCy NER + SQLite.

### LLM Fallback Chain
The backend cascades through multiple providers: Gemini (primary) -> DeepSeek -> Groq (Llama-3.1-70B) -> static JSON default. LLM responses are parsed by extracting the outermost `{...}` JSON block, with safe defaults on parse failure.

### Key API Endpoints
| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/generate_report` | Full pipeline: news -> images -> AI analysis -> charts -> markdown report |
| POST | `/api/building-change-detection` | UNet change detection (base64 pre/post images) |
| POST | `/api/extract_roads` | Road extraction from TIFF (multipart upload) |
| POST | `/api/road-detection` | Road detection via HF Space |
| POST | `/api/news` | Google Custom Search news |
| POST | `/api/analyze-disasters` | LLM summarization of map selection |
| GET | `/api/flights` | Cached OpenSky flight data |
| GET | `/api/disaster-csv` | Curated disaster dataset for map markers |
| GET | `/api/bigroads_file/<filename>` | Serve road extraction output images |

## Environment Variables

Backend uses `python-dotenv` loading from `backend/.env`:
- `GEMINI_API_KEY` — Google Generative AI (primary LLM)
- `GOOGLE_API_KEY`, `GOOGLE_CX` — Google Custom Search (news + images)
- `HUGGINGFACE_API_KEY` — HF Inference API (BLIP captioning)
- `DEEPSEEK_API_KEY` — DeepSeek fallback LLM
- `GROQ_API_KEY` — Groq fallback LLM

## Known Issues / Caveats

- **Platform-specific model paths**: `change_detection.py` and `road_extract.py` contain hardcoded Windows absolute paths for model weights. These must be updated per machine.
- **Road extraction model not in repo**: `road_detection_resnet_e50.h5` must be downloaded separately and its path set in `road_extract.py` (`MODEL_PATH`).
- **No auth on APIs**: Intended for local desktop use only.
- **Demo data**: Analysis screen charts (trends, classification, NDVI) use mock/demo data, not real computations.
- **Backend must start before frontend**: The Electron app expects Flask at `localhost:5000` on launch.
