// Initialize speech synthesis
const speechSynth = window.speechSynthesis;

function speakText(text) {
  // Cancel any ongoing speech
  speechSynth.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.9;
  utterance.pitch = 1;
  speechSynth.speak(utterance);
}

function check_backend() {
  fetch("http://127.0.0.1:5000/api/status")
    .then((t) => t.json())
    .then((t) => {
      const status = t.status;
      document.getElementById("status").innerText = status;
      // Speak the status update
      speakText(status);
    })
    .catch((t) => {
      const errorMsg = "Backend not responding.";
      document.getElementById("status").innerText = errorMsg;
      speakText(errorMsg);
      console.error(t);
    });
}
// Building Change Detection Class
class BuildingChangeDetection {
  constructor() {
    this.preImage = null;
    this.postImage = null;
    this.isProcessing = false;
    
    this.initializeEventListeners();
  }

  initializeEventListeners() {
    // Upload area clicks
    document.getElementById('preImageUpload').addEventListener('click', () => {
      document.getElementById('preImageInput').click();
    });
    
    document.getElementById('postImageUpload').addEventListener('click', () => {
      document.getElementById('postImageInput').click();
    });

    // File input changes
    document.getElementById('preImageInput').addEventListener('change', (e) => {
      this.handleImageUpload(e, 'pre');
    });
    
    document.getElementById('postImageInput').addEventListener('change', (e) => {
      this.handleImageUpload(e, 'post');
    });

    // Drag and drop
    this.setupDragAndDrop('preImageUpload', 'pre');
    this.setupDragAndDrop('postImageUpload', 'post');

    // Control buttons
    document.getElementById('runAnalysisBtn').addEventListener('click', () => {
      this.runChangeDetection();
    });
    
    document.getElementById('resetAnalysisBtn').addEventListener('click', () => {
      this.resetAnalysis();
    });
    
    document.getElementById('closeBuildingPanel').addEventListener('click', () => {
      this.closeBuildingPanel();
    });
  }

  setupDragAndDrop(uploadAreaId, imageType) {
    const uploadArea = document.getElementById(uploadAreaId);
    
    uploadArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadArea.classList.add('dragover');
    });
    
    uploadArea.addEventListener('dragleave', (e) => {
      e.preventDefault();
      uploadArea.classList.remove('dragover');
    });
    
    uploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadArea.classList.remove('dragover');
      
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        this.processImageFile(files[0], imageType);
      }
    });
  }

  handleImageUpload(event, imageType) {
    const file = event.target.files[0];
    if (file) {
      this.processImageFile(file, imageType);
    }
  }

  processImageFile(file, imageType) {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('File size must be less than 10MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64Data = e.target.result;
      
      if (imageType === 'pre') {
        this.preImage = base64Data;
        this.updateImagePreview('preImagePreview', 'preImageUpload', base64Data);
        logger.info('Pre-disaster image uploaded successfully');
        speakText('Pre-disaster image uploaded');
      } else {
        this.postImage = base64Data;
        this.updateImagePreview('postImagePreview', 'postImageUpload', base64Data);
        logger.info('Post-disaster image uploaded successfully');
        speakText('Post-disaster image uploaded');
      }
      
      this.updateAnalysisButton();
    };
    
    reader.readAsDataURL(file);
  }

  updateImagePreview(previewId, uploadAreaId, imageSrc) {
    const preview = document.getElementById(previewId);
    const uploadArea = document.getElementById(uploadAreaId);
    
    preview.src = imageSrc;
    preview.style.display = 'block';
    
    // Hide upload placeholder
    const placeholder = uploadArea.querySelector('.upload-placeholder');
    if (placeholder) {
      placeholder.style.display = 'none';
    }
  }

  updateAnalysisButton() {
    const btn = document.getElementById('runAnalysisBtn');
    if (this.preImage && this.postImage && !this.isProcessing) {
      btn.disabled = false;
    } else {
      btn.disabled = true;
    }
  }

  async runChangeDetection() {
    if (!this.preImage || !this.postImage) {
      alert('Please upload both pre and post disaster images');
      return;
    }

    this.isProcessing = true;
    this.updateAnalysisButton();
    
    // Show loading state
    const btn = document.getElementById('runAnalysisBtn');
    const btnText = btn.querySelector('.btn-text');
    const btnLoader = btn.querySelector('.btn-loader');
    
    btnText.style.display = 'none';
    btnLoader.style.display = 'inline';
    
    logger.info('Starting building change detection analysis...');
    speakText('Starting building change detection analysis');

    try {
      const response = await fetch('http://localhost:5000/api/building-change-detection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pre_image: this.preImage,
          post_image: this.postImage
        })
      });

      const data = await response.json();

      if (data.status === 'success') {
        this.displayResults(data.result);
        logger.success(`Change detection completed: ${data.result.change_percentage}% change detected`);
        speakText(`Analysis complete. ${data.result.change_percentage} percent building change detected`);
      } else {
        throw new Error(data.error || 'Analysis failed');
      }

    } catch (error) {
      console.error('Change detection error:', error);
      logger.error(`Analysis failed: ${error.message}`);
      speakText('Analysis failed. Please check your images and try again');
      alert(`Analysis failed: ${error.message}`);
    } finally {
      this.isProcessing = false;
      this.updateAnalysisButton();
      
      // Reset button state
      btnText.style.display = 'inline';
      btnLoader.style.display = 'none';
    }
  }

  displayResults(result) {
    // Update statistics
    document.getElementById('changePercentage').textContent = `${result.change_percentage}%`;
    document.getElementById('changedPixels').textContent = result.changed_pixels.toLocaleString();
    document.getElementById('totalPixels').textContent = result.total_pixels.toLocaleString();

    // Update result images
    if (result.mask_image) {
      document.getElementById('maskImage').src = result.mask_image;
    }
    if (result.comparison_image) {
      document.getElementById('comparisonImage').src = result.comparison_image;
    }
    if (result.overlay_image) {
      document.getElementById('overlayImage').src = result.overlay_image;
    }

    // Show results section
    document.getElementById('resultsSection').style.display = 'block';
  }

  resetAnalysis() {
    // Clear images
    this.preImage = null;
    this.postImage = null;
    
    // Reset previews
    ['preImagePreview', 'postImagePreview'].forEach(id => {
      const img = document.getElementById(id);
      img.style.display = 'none';
      img.src = '';
    });
    
    // Show placeholders
    ['preImageUpload', 'postImageUpload'].forEach(id => {
      const placeholder = document.getElementById(id).querySelector('.upload-placeholder');
      if (placeholder) {
        placeholder.style.display = 'block';
      }
    });
    
    // Reset file inputs
    document.getElementById('preImageInput').value = '';
    document.getElementById('postImageInput').value = '';
    
    // Hide results
    document.getElementById('resultsSection').style.display = 'none';
    
    // Update button state
    this.updateAnalysisButton();
    
    logger.info('Analysis reset');
    speakText('Analysis reset');
  }

  closeBuildingPanel() {
    document.getElementById('buildingPanel').style.display = 'none';
    logger.info('Building analysis panel closed');
  }

  showBuildingPanel() {
    document.getElementById('buildingPanel').style.display = 'block';
    logger.info('Building analysis panel opened');
    speakText('Building change detection panel opened');
  }
}

// Glacial Lake Change Detection Class
class GlacialLakeDetection {
  constructor() {
    this.image1 = null;
    this.image2 = null;
    this.isProcessing = false;
    this.initializeEventListeners();
  }

  initializeEventListeners() {
    document.getElementById('lakeImage1Upload').addEventListener('click', () => {
      document.getElementById('lakeImage1Input').click();
    });
    document.getElementById('lakeImage2Upload').addEventListener('click', () => {
      document.getElementById('lakeImage2Input').click();
    });

    document.getElementById('lakeImage1Input').addEventListener('change', (e) => {
      this.handleImageUpload(e, 1);
    });
    document.getElementById('lakeImage2Input').addEventListener('change', (e) => {
      this.handleImageUpload(e, 2);
    });

    this.setupDragAndDrop('lakeImage1Upload', 1);
    this.setupDragAndDrop('lakeImage2Upload', 2);

    document.getElementById('runLakeAnalysisBtn').addEventListener('click', () => {
      this.runComparison();
    });
    document.getElementById('resetLakeAnalysisBtn').addEventListener('click', () => {
      this.reset();
    });
    document.getElementById('closeGlacialLakePanel').addEventListener('click', () => {
      this.closePanel();
    });

    const slider = document.getElementById('lakeThreshold');
    const sliderValue = document.getElementById('lakeThresholdValue');
    slider.addEventListener('input', () => {
      sliderValue.textContent = parseFloat(slider.value).toFixed(2);
    });
  }

  setupDragAndDrop(uploadAreaId, slot) {
    const uploadArea = document.getElementById(uploadAreaId);
    uploadArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadArea.classList.add('dragover');
    });
    uploadArea.addEventListener('dragleave', (e) => {
      e.preventDefault();
      uploadArea.classList.remove('dragover');
    });
    uploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadArea.classList.remove('dragover');
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        this.processImageFile(files[0], slot);
      }
    });
  }

  handleImageUpload(event, slot) {
    const file = event.target.files[0];
    if (file) this.processImageFile(file, slot);
  }

  processImageFile(file, slot) {
    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      alert('File size must be less than 20MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64Data = e.target.result;
      if (slot === 1) {
        this.image1 = base64Data;
        this.updatePreview('lakeImage1Preview', 'lakeImage1Upload', base64Data);
        logger.info('Glacial lake image (Time 1) uploaded');
      } else {
        this.image2 = base64Data;
        this.updatePreview('lakeImage2Preview', 'lakeImage2Upload', base64Data);
        logger.info('Glacial lake image (Time 2) uploaded');
      }
      this.updateRunButton();
    };
    reader.readAsDataURL(file);
  }

  updatePreview(previewId, uploadAreaId, imageSrc) {
    const preview = document.getElementById(previewId);
    const uploadArea = document.getElementById(uploadAreaId);
    preview.src = imageSrc;
    preview.style.display = 'block';
    const placeholder = uploadArea.querySelector('.upload-placeholder');
    if (placeholder) placeholder.style.display = 'none';
  }

  updateRunButton() {
    const btn = document.getElementById('runLakeAnalysisBtn');
    btn.disabled = !(this.image1 && this.image2 && !this.isProcessing);
  }

  async runComparison() {
    if (!this.image1 || !this.image2) {
      alert('Please upload both Time 1 and Time 2 images');
      return;
    }

    this.isProcessing = true;
    this.updateRunButton();

    const btn = document.getElementById('runLakeAnalysisBtn');
    const btnText = btn.querySelector('.btn-text');
    const btnLoader = btn.querySelector('.btn-loader');
    btnText.style.display = 'none';
    btnLoader.style.display = 'inline';

    const threshold = parseFloat(document.getElementById('lakeThreshold').value);
    const resolution = document.getElementById('lakeResolution').value;

    logger.info('Running glacial lake change detection...');
    speakText('Running glacial lake change detection');

    try {
      const response = await fetch(API_CONFIG.getUrl('GLACIAL_LAKE_CHANGE'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image1: this.image1,
          image2: this.image2,
          threshold,
          resolution,
        }),
      });

      const data = await response.json();
      if (!response.ok || data.status !== 'success') {
        const msg = data.error || `Server error (${response.status})`;
        const details = data.details ? ` — ${data.details}` : '';
        throw new Error(msg + details);
      }

      this.displayResults(data);
      logger.success(`Lake comparison complete: ${data.stats.pct_change}% change`);
      speakText(`Lake comparison complete. ${data.stats.pct_change} percent change`);
    } catch (error) {
      console.error('Glacial lake error:', error);
      logger.error(`Lake comparison failed: ${error.message}`);
      alert(`Lake comparison failed: ${error.message}`);
    } finally {
      this.isProcessing = false;
      this.updateRunButton();
      btnText.style.display = 'inline';
      btnLoader.style.display = 'none';
    }
  }

  displayResults(data) {
    const s = data.stats;
    const pct = Number(s.pct_change) || 0;
    const delta = Number(s.delta_ha) || 0;

    // Hero card — direction drives color + arrow
    const hero = document.getElementById('lakeHeroCard');
    const arrow = document.getElementById('lakeHeroArrow');
    const pctEl = document.getElementById('lakeHeroPct');
    const deltaEl = document.getElementById('lakeHeroDelta');

    hero.classList.remove('lake-hero-up', 'lake-hero-down', 'lake-hero-flat');
    if (Math.abs(pct) < 0.5) {
      hero.classList.add('lake-hero-flat');
      arrow.textContent = '→';
    } else if (pct > 0) {
      hero.classList.add('lake-hero-up');
      arrow.textContent = '↗';
    } else {
      hero.classList.add('lake-hero-down');
      arrow.textContent = '↘';
    }
    const pctSign = pct > 0 ? '+' : '';
    const deltaSign = delta > 0 ? '+' : '';
    pctEl.textContent = `${pctSign}${pct.toFixed(2)}%`;
    deltaEl.textContent = `${deltaSign}${delta.toFixed(2)} ha net`;

    // T1 vs T2
    document.getElementById('lakeAreaT1').textContent = Number(s.area_t1_ha).toFixed(2);
    document.getElementById('lakeAreaT2').textContent = Number(s.area_t2_ha).toFixed(2);

    // Water balance proportional bar
    const gained = Number(s.gained_ha) || 0;
    const lost = Number(s.lost_ha) || 0;
    const total = gained + lost;
    const gainedPct = total > 0 ? (gained / total) * 100 : 0;
    const lostPct = total > 0 ? (lost / total) * 100 : 0;
    document.getElementById('lakeBalanceGained').style.width = `${gainedPct}%`;
    document.getElementById('lakeBalanceLost').style.width = `${lostPct}%`;
    document.getElementById('lakeGainedHa').textContent = `${gained.toFixed(2)} ha`;
    document.getElementById('lakeLostHa').textContent = `${lost.toFixed(2)} ha`;
    const totalChangedPx = (Number(s.gained) || 0) + (Number(s.lost) || 0);
    document.getElementById('lakeBalanceMeta').textContent =
      `${totalChangedPx.toLocaleString()} px changed`;

    // Risk / context banner — interpretive text based on magnitude + direction
    const banner = document.getElementById('lakeRiskBanner');
    const riskIcon = document.getElementById('lakeRiskIcon');
    const riskText = document.getElementById('lakeRiskText');
    banner.classList.remove(
      'lake-risk-neutral', 'lake-risk-info', 'lake-risk-warning', 'lake-risk-alert'
    );
    const mag = Math.abs(pct);
    if (mag < 1) {
      banner.classList.add('lake-risk-neutral');
      riskIcon.textContent = '✓';
      riskText.textContent = 'Lake extent appears stable between the two observations.';
    } else if (pct > 0 && mag < 10) {
      banner.classList.add('lake-risk-info');
      riskIcon.textContent = 'ℹ';
      riskText.textContent = 'Lake is expanding — consistent with glacial melt or seasonal inflow.';
    } else if (pct > 0 && mag >= 10) {
      banner.classList.add('lake-risk-warning');
      riskIcon.textContent = '⚠';
      riskText.textContent = 'Significant expansion detected — monitor for downstream GLOF risk.';
    } else if (pct < 0 && mag < 10) {
      banner.classList.add('lake-risk-info');
      riskIcon.textContent = 'ℹ';
      riskText.textContent = 'Lake is receding — possible seasonal drawdown or controlled drainage.';
    } else {
      banner.classList.add('lake-risk-alert');
      riskIcon.textContent = '⚠';
      riskText.textContent = 'Notable contraction — check for sudden drainage or outburst events.';
    }

    // Change map
    if (data.change_image) {
      document.getElementById('lakeChangeImage').src = data.change_image;
      const dl = document.getElementById('downloadChangeBtn');
      dl.onclick = () => {
        const link = document.createElement('a');
        link.href = data.change_image;
        link.download = 'glacial_lake_change.png';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      };
    }

    // Params actually used
    document.getElementById('lakeParamThreshold').textContent =
      Number(data.threshold).toFixed(2);
    document.getElementById('lakeParamResolution').textContent =
      `${data.resolution_m} m/px`;

    document.getElementById('lakeResultsSection').style.display = 'block';
  }

  reset() {
    this.image1 = null;
    this.image2 = null;
    ['lakeImage1Preview', 'lakeImage2Preview'].forEach(id => {
      const img = document.getElementById(id);
      img.style.display = 'none';
      img.src = '';
    });
    ['lakeImage1Upload', 'lakeImage2Upload'].forEach(id => {
      const placeholder = document.getElementById(id).querySelector('.upload-placeholder');
      if (placeholder) placeholder.style.display = 'block';
    });
    document.getElementById('lakeImage1Input').value = '';
    document.getElementById('lakeImage2Input').value = '';
    document.getElementById('lakeResultsSection').style.display = 'none';
    this.updateRunButton();
    logger.info('Glacial lake analysis reset');
  }

  closePanel() {
    document.getElementById('glacialLakePanel').style.display = 'none';
    logger.info('Glacial lake panel closed');
  }

  showPanel() {
    document.getElementById('glacialLakePanel').style.display = 'block';
    logger.info('Glacial lake panel opened');
    speakText('Glacial lake change detection panel opened');
  }
}

// Global building change detection instance
let buildingChangeDetection;
let glacialLakeDetection;

document.addEventListener("DOMContentLoaded", function () {
  // Initialize building change detection
  buildingChangeDetection = new BuildingChangeDetection();
  glacialLakeDetection = new GlacialLakeDetection();

  const t = document.getElementById("sidebarTitle"),
    e = document.getElementById("screenDropdown"),
    n = document.querySelector(".dropdown-arrow"),
    o = document.querySelectorAll(".dropdown-item"),
    s = document.querySelector(".sidebar-title-container");
  (s.addEventListener("click", function (t) {
    (t.preventDefault(),
      t.stopPropagation(),
      e.classList.toggle("show"),
      n.classList.toggle("rotated"));
  }),
    window.addEventListener("click", function (t) {
      s.contains(t.target) ||
        (e.classList.remove("show"), n.classList.remove("rotated"));
    }),
    e.addEventListener("click", function (t) {
      t.stopPropagation();
    }),
    o.forEach((s) => {
      s.addEventListener("click", function (s) {
        s.stopPropagation();
        const c = this.getAttribute("data-screen"),
          i = this.querySelector("span").textContent;
        (o.forEach((t) => t.classList.remove("active")),
          this.classList.add("active"),
          (t.textContent = i),
          e.classList.remove("show"),
          n.classList.remove("rotated"),
          (function (t) {
            switch (t) {
              case "monitoring":
                console.log("Switched to Monitoring");
                break;
              case "disaster":
                window.location.href = "../disaster/disaster.html";
                break;
              case "analytics":
                window.location.href = "../analysis/analysis.html";
                break;
            }
          })(c));
      });
    }));
});

// Search functionality
document
  .querySelector(".search-input")
  .addEventListener("keypress", async function (e) {
    if (e.key === "Enter") {
      const query = this.value.trim();
      if (!query) {
        logger.warning("Please enter a location to search");
        return;
      }

      logger.info(`Searching for: ${query}`);

      try {
        // Using Nominatim API (OpenStreetMap's geocoding service)
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const results = await response.json();

        if (!results || results.length === 0) {
          logger.warning(`No results found for: ${query}`);
          return;
        }

        // Clear previous search results
        if (window.searchResultsLayer) {
          map.removeLayer(window.searchResultsLayer);
        }
        window.searchResultsLayer = L.layerGroup().addTo(map);

        // Get the first result (best match)
        const firstResult = results[0];
        const lat = parseFloat(firstResult.lat);
        const lon = parseFloat(firstResult.lon);

        logger.success(`Found: ${firstResult.display_name}`);

        // Create a marker for the search result
        const searchMarker = L.marker([lat, lon], {
          icon: L.icon({
            iconUrl:
              "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
            shadowUrl:
              "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41],
          }),
        }).addTo(window.searchResultsLayer);

        // Fly to the location with animation
        map.flyTo([lat, lon], 13, {
          duration: 1.5,
          easeLinearity: 0.5,
        });

        // Clear the search input
        this.value = "";
      } catch (error) {
        logger.error(`Search failed: ${error.message}`);
      }
    }
  });

// Global function to navigate to a location (called from popup)
window.goToLocation = function (lat, lon, name) {
  logger.info(`Navigating to: ${name}`);
  map.flyTo([lat, lon], 15, {
    duration: 1,
    easeLinearity: 0.5,
  });
};
