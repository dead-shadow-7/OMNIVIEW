// Speech synthesis setup
let speechSynthesis = window.speechSynthesis;
let speaking = false;
let recognition = null;

// Initialize voice commands
function initializeVoiceCommands() {
  // Create voice indicator element
  const voiceIndicator = document.createElement('div');
  voiceIndicator.className = 'voice-indicator';
  voiceIndicator.innerHTML = `
    <span class="icon">🎤</span>
    <span class="status">Voice Ready</span>
  `;
  document.body.appendChild(voiceIndicator);

  // Check if browser supports speech recognition
  if ('webkitSpeechRecognition' in window) {
    recognition = new webkitSpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {
      voiceIndicator.classList.add('active');
      voiceIndicator.querySelector('.status').textContent = 'Listening...';
      addLog('Voice recognition started', 'info');
    };

    recognition.onend = () => {
      voiceIndicator.classList.remove('active');
      voiceIndicator.querySelector('.status').textContent = 'Voice Ready';
      addLog('Voice recognition ended', 'info');
    };

    recognition.onresult = (event) => {
      const command = event.results[event.results.length - 1][0].transcript.toLowerCase().trim();
      addLog(`Voice command received: ${command}`, 'info');
      
      // Process voice commands
      if (command.includes('draw') || command.includes('draw area')) {
        handleVoiceCommand('draw');
      } else if (command.includes('clear') || command.includes('reset')) {
        handleVoiceCommand('clear');
      } else if (command.includes('fit') || command.includes('zoom to selection')) {
        handleVoiceCommand('fit');
      } else if (command.includes('roads') || command.includes('extract roads')) {
        handleVoiceCommand('roads');
      } else if (command.includes('land cover') || command.includes('landcover') || command.includes('segmentation')) {
        handleVoiceCommand('landcover');
      } else if (command.includes('trends')) {
        handleVoiceCommand('trends');
      } else if (command.includes('classification')) {
        handleVoiceCommand('classification');
      } else if (command.includes('ndvi')) {
        handleVoiceCommand('ndvi');
      } else if (command.includes('help')) {
        handleVoiceCommand('help');
      }
    };

    recognition.start();
  }
}

// Handle voice commands
function handleVoiceCommand(command) {
  switch (command) {
    case 'draw':
      speak('Activating draw tools');
      document.getElementById('drawBtn').click();
      break;
    case 'clear':
      speak('Clearing selection');
      document.getElementById('clearSelection').click();
      break;
    case 'fit':
      speak('Fitting view to selection');
      document.getElementById('fitToSelection').click();
      break;
    case 'roads':
      speak('Switching to road extraction');
      document.querySelector('.analytics-item[data-section="bigroads"]').click();
      break;
    case 'landcover':
      speak('Switching to land cover segmentation');
      document.querySelector('.analytics-item[data-section="landcover"]').click();
      break;
    case 'trends':
      speak('Switching to trends analysis');
      document.querySelector('.analytics-item[data-section="trends"]').click();
      break;
    case 'classification':
      speak('Switching to classification analysis');
      document.querySelector('.analytics-item[data-section="classification"]').click();
      break;
    case 'ndvi':
      speak('Switching to NDVI analysis');
      document.querySelector('.analytics-item[data-section="ndvi"]').click();
      break;
    case 'help':
      speak('Available commands: draw area, clear selection, fit to selection, extract roads, trends, classification, NDVI, help');
      break;
  }
}

// Text to speech function
function speak(text) {
  if (speaking) {
    speechSynthesis.cancel();
  }
  
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.onend = () => {
    speaking = false;
  };
  
  speaking = true;
  speechSynthesis.speak(utterance);
}

document.addEventListener('DOMContentLoaded', () => {
  console.log("✅ Analytics screen loaded");

  const logsContent = document.querySelector(".logs-content");
  function addLog(message, type = "info") {
    if (logsContent) {
      const logEntry = document.createElement("div");
      logEntry.className = `log-${type}`;
      logEntry.textContent = `${type.charAt(0).toUpperCase() + type.slice(1)}: ${message}`;
      logsContent.appendChild(logEntry);
      logsContent.scrollTop = logsContent.scrollHeight;
    }
  }
  addLog("Analytics dashboard initialized");

  // Sidebar navigation implementation
  const sidebarTitle = document.getElementById("sidebarTitle");
  const screenDropdown = document.getElementById("screenDropdown");
  const dropdownArrow = document.querySelector(".dropdown-arrow");
  const dropdownItems = document.querySelectorAll(".dropdown-item");
  const sidebarTitleContainer = document.querySelector(".sidebar-title-container");
  
  // Ensure dropdown starts hidden
  if (screenDropdown) {
    screenDropdown.classList.remove("show");
  }
  // Analytics section navigation
  const analyticsItems = document.querySelectorAll(".analytics-item");
  const analyticsGrid = document.querySelector(".analytics-grid");
  const bigroadsSection = document.getElementById("bigroadsSection");
  const landcoverSection = document.getElementById("landcoverSection");
  const analyticsContainer = document.getElementById("analyticsContainer");
  
  // Analytics section switching logic
  analyticsItems.forEach((item) => {
    item.addEventListener("click", function () {
      analyticsItems.forEach((el) => el.classList.remove("active"));
      this.classList.add("active");
      
      const section = this.getAttribute("data-section");
      
      // Hide everything first
      if (analyticsGrid) analyticsGrid.style.display = "none";
      if (bigroadsSection) bigroadsSection.style.display = "none";
      if (landcoverSection) landcoverSection.style.display = "none";
      
      // Show selected section
      if (section === "bigroads") {
        if (analyticsContainer) analyticsContainer.style.display = "";
        if (bigroadsSection) bigroadsSection.style.display = "block";
        addLog("Switched to Road Extraction", "info");
      } else if (section === "landcover") {
        // Hide entire analytics container (filters etc.) when showing landcover
        if (analyticsContainer) analyticsContainer.style.display = "none";
        if (landcoverSection) landcoverSection.style.display = "block";
        addLog("Switched to Land Cover Segmentation", "info");
        // Notify the inline landcover script to init/resize map
        window.dispatchEvent(new Event('landcover-show'));
      } else {
        if (analyticsContainer) analyticsContainer.style.display = "";
        if (analyticsGrid) analyticsGrid.style.display = "flex";
        addLog(`Switched to ${section} analysis`, "info");
        
        // Initialize map if not already done
        if (section === "analytics" && !window.mapInitialized) {
          setTimeout(() => {
            if (typeof analysisMap !== 'undefined') {
              analysisMap.invalidateSize();
            }
          }, 100);
        }
      }
    });
  });

  // --- Big Roads Extraction Feature ---
  const bigRoadsForm = document.getElementById("bigRoadsForm");
  const sentinelFile = document.getElementById("sentinelFile");
  const bigRoadsStatus = document.getElementById("bigRoadsStatus");
  const bigRoadsResults = document.getElementById("bigRoadsResults");
  const bigRoadsOrig = document.getElementById("bigRoadsOrig");
  const bigRoadsMask = document.getElementById("bigRoadsMask");
  const bigRoadsOverlay = document.getElementById("bigRoadsOverlay");
  const toggleOverlayBtn = document.getElementById("toggleOverlayBtn");
  let overlayMode = true;

  if (bigRoadsForm) {
    bigRoadsForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      bigRoadsStatus.textContent =
        "Uploading and processing... (this may take a while)";
      bigRoadsResults.style.display = "none";
      const file = sentinelFile.files[0];
      if (!file) {
        bigRoadsStatus.textContent = "Please select a Sentinel-2 TIFF file.";
        return;
      }
      const formData = new FormData();
      formData.append("file", file);
      try {
        const resp = await fetch("http://localhost:5000/api/extract_roads", {
          method: "POST",
          body: formData,
        });
        if (!resp.ok) throw new Error("Processing failed");
        const data = await resp.json();
        // data: { orig_url, mask_url, overlay_url }
        bigRoadsOrig.innerHTML = `<img src="${data.orig_url}" class="result-img"/>`;
        bigRoadsMask.innerHTML = `<img src="${data.mask_url}" class="result-img"/>`;
        bigRoadsOverlay.innerHTML = `<img id="overlayImg" src="${data.overlay_url}" class="result-img"/>`;
        bigRoadsResults.style.display = "";
        bigRoadsStatus.textContent = "Extraction complete!";
        overlayMode = true;
      } catch (err) {
        bigRoadsStatus.textContent = "Error: " + err.message;
      }
    });
    // Overlay toggle
    if (toggleOverlayBtn) {
      toggleOverlayBtn.addEventListener("click", () => {
        overlayMode = !overlayMode;
        const overlayImg = document.getElementById("overlayImg");
        if (!overlayImg) return;
        overlayImg.style.opacity = overlayMode ? "1" : "0.3";
        toggleOverlayBtn.textContent = overlayMode
          ? "Toggle Overlay"
          : "Show Overlay";
      });
    }
  }

  // Toggle dropdown
  sidebarTitleContainer.addEventListener("click", function (event) {
    event.preventDefault();
    event.stopPropagation();
    screenDropdown.classList.toggle("show");
    dropdownArrow.classList.toggle("rotated");
  });

  // Close dropdown when clicking outside
  window.addEventListener("click", function (event) {
    if (!sidebarTitleContainer.contains(event.target)) {
      screenDropdown.classList.remove("show");
      dropdownArrow.classList.remove("rotated");
    }
  });

  // Prevent dropdown from closing when clicking inside it
  screenDropdown.addEventListener("click", function (event) {
    event.stopPropagation();
  });

  // Handle dropdown item clicks
  dropdownItems.forEach((item) => {
    item.addEventListener("click", function (event) {
      event.stopPropagation();
      const screen = this.getAttribute("data-screen");
      const screenName = this.querySelector("span").textContent;

      // Update active state
      dropdownItems.forEach((item) => item.classList.remove("active"));
      this.classList.add("active");

      // Update sidebar title
      sidebarTitle.textContent = screenName;

      // Close dropdown
      screenDropdown.classList.remove("show");
      dropdownArrow.classList.remove("rotated");

      // Navigate to screen
      switchScreen(screen);
    });
  });

  // Screen switching function
  function switchScreen(screen) {
    addLog(`Navigating to ${screen.toUpperCase()} screen`, "info");
    
    switch (screen) {
      case "monitoring":
        window.location.href = "../monitoring/monitoring.html";
        break;
      case "disaster":
        window.location.href = "../disaster/disaster.html";
        break;
      case "analytics":
        addLog("Already on Analytics screen", "info");
        break;
      default:
        addLog(`Unknown screen: ${screen}`, "warning");
        break;
    }
  }

  // Mock Data Expansion
  const mockDisasterData = {
    years: ["2019", "2020", "2021", "2022", "2023", "2024", "2025"],
    events: {
      Flood: [5, 7, 4, 6, 8, 5, 9],
      Fire: [3, 4, 6, 5, 7, 8, 6],
      Earthquake: [2, 3, 1, 4, 2, 3, 5],
    },
    classifications: [
      {
        labels: ["Urban", "Forest", "Water", "Agriculture", "Other"],
        data: [40, 20, 15, 15, 10],
      }, // Urban area
      {
        labels: ["Urban", "Forest", "Water", "Agriculture", "Other"],
        data: [10, 50, 20, 15, 5],
      }, // Rural area
    ],
    ndviValues: [0.2, 0.4, 0.6, 0.3, 0.5, 0.7, 0.8], // Mock NDVI over time
  };

  // Populate Filters
  const yearFilter = document.getElementById("yearFilter");
  mockDisasterData.years.forEach((year) => {
    const option = document.createElement("option");
    option.value = year;
    option.textContent = year;
    yearFilter.appendChild(option);
  });

  // Map Setup (enhanced with markers and overlays)
  let analysisMap;
  let drawnItems;
  
  function initializeMap() {
    const mapElement = document.getElementById("map");
    if (mapElement && !window.mapInitialized) {
      try {
        analysisMap = L.map("map").setView([40.7128, -74.0060], 10); // New York as default
        
        L.tileLayer(
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          {
            attribution: "Tiles &copy; Esri",
            maxZoom: 18,
          }
        ).addTo(analysisMap);

        // Initialize drawn items feature group
        drawnItems = new L.FeatureGroup();
        analysisMap.addLayer(drawnItems);
        
        // Make variables globally accessible
        window.analysisMap = analysisMap;
        window.drawnItems = drawnItems;
        
        window.mapInitialized = true;
        addLog("Map initialized successfully", "success");
        
        // Force map to resize properly
        setTimeout(() => {
          analysisMap.invalidateSize();
          addLog("Map size invalidated for proper display", "info");
        }, 200);
        
        return true;
      } catch (error) {
        addLog("Error initializing map: " + error.message, "error");
        return false;
      }
    }
    return false;
  }
  
  // Initialize map immediately
  const mapInitSuccess = initializeMap();
  
  if (mapInitSuccess) {
    // Setup draw controls after short delay to ensure map is ready
    setTimeout(() => {
      setupDrawControls();
    }, 300);
  } else {
    addLog("Failed to initialize map", "error");
  }

  // NDVI Heatmap Overlay (mock)
  let ndviLayer;
  function addNdviOverlay() {
    if (ndviLayer) map.removeLayer(ndviLayer);
    const bounds = drawnItems.getBounds() || map.getBounds();
    ndviLayer = L.rectangle(bounds, {
      color: "none",
      fillColor: getNdviColor(Math.random() * 0.8 + 0.2),
      fillOpacity: 0.5,
    }).addTo(map);
    addLog("NDVI overlay added");
  }

  function getNdviColor(ndvi) {
    return ndvi > 0.5 ? "#4caf50" : ndvi > 0.3 ? "#ffeb3b" : "#f44336";
  }

  // Charts
  let trendChart, classificationChart, barChart;

  const trendCtx = document.getElementById("trendChart").getContext("2d");
  trendChart = new Chart(trendCtx, {
    type: "line",
    data: { labels: mockDisasterData.years, datasets: [] },
    options: { responsive: true, scales: { y: { beginAtZero: true } } },
  });

  const classCtx = document
    .getElementById("classificationChart")
    .getContext("2d");
  classificationChart = new Chart(classCtx, {
    type: "pie",
    data: {
      labels: [],
      datasets: [
        {
          data: [],
          backgroundColor: [
            "#ff6384",
            "#36a2eb",
            "#ffce56",
            "#4bc0c0",
            "#9966ff",
          ],
        },
      ],
    },
    options: { responsive: true },
  });

  const barCtx = document.getElementById("disasterBarChart").getContext("2d");
  barChart = new Chart(barCtx, {
    type: "bar",
    data: {
      labels: ["Flood", "Fire", "Earthquake"],
      datasets: [{ label: "Events", data: [], backgroundColor: "#ff9800" }],
    },
    options: { responsive: true, scales: { y: { beginAtZero: true } } },
  });

  // Update Charts Function
  function updateCharts(year = "", type = "") {
    const index = mockDisasterData.years.indexOf(year);
    const datasets = Object.keys(mockDisasterData.events)
      .map((key) => ({
        label: key,
        data: mockDisasterData.events[key],
        borderColor: getRandomColor(),
        tension: 0.1,
      }))
      .filter((ds) => !type || ds.label === type);
    trendChart.data.datasets = datasets;
    trendChart.update();

    const classIndex = Math.floor(
      Math.random() * mockDisasterData.classifications.length
    );
    classificationChart.data.labels =
      mockDisasterData.classifications[classIndex].labels;
    classificationChart.data.datasets[0].data =
      mockDisasterData.classifications[classIndex].data;
    classificationChart.update();

    const barData = Object.values(mockDisasterData.events).map(
      (arr) => arr.reduce((a, b) => a + b, 0) / arr.length
    ); // Average
    barChart.data.datasets[0].data = barData;
    barChart.update();

    addLog("Charts updated with filters");
  }
  updateCharts(); // Initial

  function getRandomColor() {
    return "#" + Math.floor(Math.random() * 16777215).toString(16);
  }

  // Time Slider
  const timeSlider = document.getElementById("timeSlider");
  timeSlider.addEventListener("input", (e) => {
    const year = e.target.value;
    updateCharts(year);
    addLog(`Time slider set to ${year}`);
  });

  // Filters
  yearFilter.addEventListener("change", (e) =>
    updateCharts(e.target.value, document.getElementById("typeFilter").value)
  );
  document
    .getElementById("typeFilter")
    .addEventListener("change", (e) =>
      updateCharts(document.getElementById("yearFilter").value, e.target.value)
    );

  // Analyze Buttons
  document.getElementById("analyzeBtn").addEventListener("click", () => {
    if (drawnItems.getLayers().length === 0)
      return addLog("No area", "warning");
    const mockDetails = `Classification: ${JSON.stringify(mockDisasterData.classifications[0])}`;
    showModal(mockDetails);
    updateCharts();
    addLog("Analysis complete");
  });

  document.getElementById("ndviBtn").addEventListener("click", () => {
    if (drawnItems.getLayers().length === 0)
      return addLog("No area", "warning");
    const mockNdvi =
      mockDisasterData.ndviValues[
        Math.floor(Math.random() * mockDisasterData.ndviValues.length)
      ];
    addNdviOverlay();
    showModal(`Mock NDVI: ${mockNdvi.toFixed(2)} (Healthy if >0.5)`);
    addLog("NDVI computed");
  });

  // Modal
  const modal = document.getElementById("analysisModal");
  const closeBtn = document.querySelector(".close");
  function showModal(details) {
    document.getElementById("modalDetails").textContent = details;
    modal.style.display = "block";
  }
  closeBtn.addEventListener("click", () => (modal.style.display = "none"));
  window.addEventListener("click", (e) => {
    if (e.target === modal) modal.style.display = "none";
  });

  // Export
  function exportChart(chartId, filename) {
    html2canvas(document.getElementById(chartId).parentNode).then((canvas) => {
      const link = document.createElement("a");
      link.download = filename;
      link.href = canvas.toDataURL();
      link.click();
      addLog(`${filename} exported`);
    });
  }
  document
    .getElementById("exportTrend")
    .addEventListener("click", () => exportChart("trendChart", "trends.png"));
  document
    .getElementById("exportBar")
    .addEventListener("click", () =>
      exportChart("disasterBarChart", "disasters.png")
    );

  // -- interactive map + area analysis --
  // Map already initialized above, just ensure drawnItems is added

  // Setup draw controls and event handlers
  function setupDrawControls() {
    // Use global variables if available
    const map = window.analysisMap || analysisMap;
    const items = window.drawnItems || drawnItems;
    
    if (!map || !items || !document.getElementById('drawBtn')) {
      console.error("Draw controls setup failed - missing requirements");
      addLog("Draw controls setup failed - missing requirements", "error");
      return;
    }
    
    try {
      // Initialize draw control immediately
      const drawControl = new L.Control.Draw({
        draw: { 
          marker: false, 
          polyline: false, 
          circle: false, 
          rectangle: {
            shapeOptions: {
              color: '#3b82f6',
              weight: 3,
              fillOpacity: 0.2,
              fillColor: '#3b82f6'
            }
          },
          circlemarker: false,
          polygon: {
            allowIntersection: false,
            showArea: true,
            shapeOptions: {
              color: '#3b82f6',
              weight: 3,
              fillOpacity: 0.2,
              fillColor: '#3b82f6'
            }
          }
        },
        edit: { 
          featureGroup: items, 
          remove: true 
        }
      });
      
      // Add draw control to map immediately
      map.addControl(drawControl);
      map.hasDrawControl = true;
      
      addLog("Draw controls added successfully", "success");
      
      // Draw button event - just log that tools are ready
      document.getElementById('drawBtn').addEventListener('click', () => {
        addLog("Draw tools are ready - use the rectangle or polygon tools from the map toolbar", "info");
        if (typeof speak === 'function') {
          speak("Draw tools activated. Use the toolbar to draw rectangles or polygons.");
        }
      });

      // Clear selection button
      document.getElementById('clearSelection').addEventListener('click', () => {
        items.clearLayers();
        document.getElementById('resultsContent').innerHTML = '<div id="summary" class="result-block">No area selected.</div>';
        document.getElementById('fitToSelection').style.display = 'none';
        addLog("Selection cleared", "info");
      });

      // Draw event handlers
      map.on(L.Draw.Event.CREATED, function (event) {
        console.log("Draw event triggered:", event);
        const layer = event.layer;
        items.clearLayers();
        items.addLayer(layer);
        const gj = layer.toGeoJSON();
        addLog("Area drawn successfully, starting analysis...", "success");
        analyzeSelection(gj, layer);
      });

      map.on('draw:edited', function(e) {
        const layers = e.layers;
        layers.eachLayer(function(l){
          const gj = l.toGeoJSON();
          analyzeSelection(gj, l);
          addLog("Selection edited and re-analyzed", "info");
        });
      });
      
    } catch (error) {
      console.error("Error setting up draw controls:", error);
      addLog("Error setting up draw controls: " + error.message, "error");
    }
  }
  
  // Draw controls are already set up above

  async function analyzeSelection(geojson, layer) {
    console.log("analyzeSelection called with:", geojson, layer);
    addLog("Starting area analysis...", "info");
    
    // Check if Turf.js is available
    if (typeof turf === 'undefined') {
      addLog("Turf.js not available - using simplified analysis", "warning");
      // Simplified analysis without Turf.js
      const bounds = layer.getBounds();
      const areaM2 = Math.random() * 1000000 + 50000; // Mock area
      const areaRounded = Math.round(areaM2);
      const areaKm2 = (areaM2 / 1000000).toFixed(2);
      const perimeterM = Math.round(Math.sqrt(areaM2) * 4); // Approximate perimeter
      
      generateMockAnalysis(areaM2, areaKm2, perimeterM, geojson, layer);
      return;
    }
    
    try {
      // compute area (m²) and perimeter (m) using Turf.js
      const areaM2 = turf.area(geojson);
      const line = turf.polygonToLine(geojson);
      const perimeterKm = turf.length(line, {units: 'kilometers'});
      const perimeterM = Math.round(perimeterKm * 1000);
      const areaRounded = Math.round(areaM2);
      const areaKm2 = (areaM2 / 1000000).toFixed(2);
      
      generateMockAnalysis(areaM2, areaKm2, perimeterM, geojson, layer);
    } catch (error) {
      console.error("Error in area analysis:", error);
      addLog("Error calculating area - using mock data", "warning");
      // Fallback to mock data
      const areaM2 = Math.random() * 1000000 + 50000;
      const areaKm2 = (areaM2 / 1000000).toFixed(2);
      const perimeterM = Math.round(Math.sqrt(areaM2) * 4);
      generateMockAnalysis(areaM2, areaKm2, perimeterM, geojson, layer);
    }
  }
  
  function generateMockAnalysis(areaM2, areaKm2, perimeterM, geojson, layer) {

    const areaRounded = Math.round(areaM2);
    
    // Show initial summary
    const summaryHtml = `
      <div class="result-block">
        <h4>🗺️ Area Analysis</h4>
        <p><strong>Area:</strong> ${areaRounded.toLocaleString()} m² (${areaKm2} km²)</p>
        <p><strong>Perimeter:</strong> ${perimeterM.toLocaleString()} m</p>
        <p><strong>Shape:</strong> ${geojson ? geojson.geometry.type : 'Polygon'}</p>
      </div>
    `;
    
    document.getElementById('resultsContent').innerHTML = summaryHtml + '<div class="result-block">🔍 Analyzing landcover...</div>';
    document.getElementById('fitToSelection').style.display = '';
    
    // Fit map to selection
    if (layer && layer.getBounds) {
      analysisMap.fitBounds(layer.getBounds(), {padding:[20,20]});
    }

    // Generate mock analysis data
    setTimeout(() => {
      // Mock landcover breakdown with realistic percentages
      const mockBreakdown = generateMockLandcover(areaM2);
      
      // Mock environmental data
      const mockEnvironmental = {
        ndvi: (Math.random() * 0.6 + 0.2).toFixed(3), // 0.2 to 0.8
        temperature: (Math.random() * 15 + 10).toFixed(1), // 10-25°C
        humidity: (Math.random() * 30 + 40).toFixed(0), // 40-70%
        elevation: Math.floor(Math.random() * 500 + 50), // 50-550m
        slope: (Math.random() * 25).toFixed(1) // 0-25 degrees
      };
      
      // Mock risk assessment
      const riskFactors = assessRisks(mockBreakdown, mockEnvironmental);
      
      // Build comprehensive results HTML
      let resultsHtml = summaryHtml;
      
      // Landcover breakdown
      resultsHtml += `
        <div class="result-block">
          <h4>Landcover Analysis</h4>
          <div>
      `;

      Object.entries(mockBreakdown).forEach(([type, data]) => {
        const percentage = ((data.area / areaM2) * 100).toFixed(1);
        resultsHtml += `
          <div class="landuse-row">
            <span>${data.icon} ${type}</span>
            <span>${percentage}% (${Math.round(data.area).toLocaleString()} m²)</span>
          </div>
        `;
      });
      
      resultsHtml += `</div></div>`;
      
      // Environmental conditions
      resultsHtml += `
        <div class="result-block">
          <h4>🌡️ Environmental Data</h4>
          <p><strong>NDVI:</strong> ${mockEnvironmental.ndvi} ${getNdviStatus(mockEnvironmental.ndvi)}</p>
          <p><strong>Avg Temperature:</strong> ${mockEnvironmental.temperature}°C</p>
          <p><strong>Humidity:</strong> ${mockEnvironmental.humidity}%</p>
          <p><strong>Elevation:</strong> ${mockEnvironmental.elevation}m</p>
          <p><strong>Avg Slope:</strong> ${mockEnvironmental.slope}°</p>
        </div>
      `;
      
      // Risk assessment
      resultsHtml += `
        <div class="result-block">
          <h4>⚠️ Risk Assessment</h4>
          ${riskFactors.map(risk => `
            <div class="risk-item" style="background: rgba(${risk.color}, 0.2);">
              <strong>${risk.type}:</strong> ${risk.level}
              <div class="risk-reason">${risk.reason}</div>
            </div>
          `).join('')}
        </div>
      `;
      
      document.getElementById('resultsContent').innerHTML = resultsHtml;
      addLog(`Analysis completed for ${areaKm2} km² area`, "success");
      
    }, 1500); // Simulate processing time
  }
  
  function generateMockLandcover(totalArea) {
    const landcoverTypes = {
      'Urban': { icon: '🏢', base: 0.3 },
      'Forest': { icon: '🌲', base: 0.25 },
      'Agriculture': { icon: '🌾', base: 0.2 },
      'Water': { icon: '💧', base: 0.1 },
      'Grassland': { icon: '🌿', base: 0.1 },
      'Bare Soil': { icon: '🏔️', base: 0.05 }
    };
    
    let remaining = 1.0;
    const result = {};
    
    Object.entries(landcoverTypes).forEach(([type, data], index) => {
      const variance = (Math.random() - 0.5) * 0.4; // ±20% variance
      let percentage = Math.max(0.01, data.base + variance);
      
      if (index === Object.keys(landcoverTypes).length - 1) {
        percentage = remaining; // Use remaining for last type
      } else {
        percentage = Math.min(percentage, remaining - 0.01);
        remaining -= percentage;
      }
      
      result[type] = {
        icon: data.icon,
        area: totalArea * percentage
      };
    });
    
    return result;
  }
  
  function getNdviStatus(ndvi) {
    const val = parseFloat(ndvi);
    if (val > 0.6) return '🟢 (Healthy vegetation)';
    if (val > 0.3) return '🟡 (Moderate vegetation)';
    return '🔴 (Sparse/unhealthy vegetation)';
  }
  
  function assessRisks(landcover, environmental) {
    const risks = [];
    
    // Flood risk assessment
    const waterPercentage = (landcover.Water?.area || 0) / Object.values(landcover).reduce((sum, data) => sum + data.area, 0);
    if (waterPercentage > 0.15) {
      risks.push({
        type: 'Flood Risk',
        level: 'HIGH',
        color: '255,69,58',
        reason: 'High water coverage detected'
      });
    } else if (waterPercentage > 0.05) {
      risks.push({
        type: 'Flood Risk',
        level: 'MEDIUM',
        color: '255,159,10',
        reason: 'Moderate water presence'
      });
    }
    
    // Fire risk assessment
    const ndvi = parseFloat(environmental.ndvi);
    const temp = parseFloat(environmental.temperature);
    const humidity = parseInt(environmental.humidity);
    
    if (ndvi < 0.3 && temp > 20 && humidity < 50) {
      risks.push({
        type: 'Wildfire Risk',
        level: 'HIGH',
        color: '255,69,58',
        reason: 'Low vegetation, high temp, low humidity'
      });
    }
    
    // Erosion risk
    const slope = parseFloat(environmental.slope);
    if (slope > 15) {
      risks.push({
        type: 'Erosion Risk',
        level: slope > 20 ? 'HIGH' : 'MEDIUM',
        color: slope > 20 ? '255,69,58' : '255,159,10',
        reason: `Steep terrain (${slope}° slope)`
      });
    }
    
    // Urban development pressure
    const urbanPercentage = (landcover.Urban?.area || 0) / Object.values(landcover).reduce((sum, data) => sum + data.area, 0);
    if (urbanPercentage > 0.4) {
      risks.push({
        type: 'Development Pressure',
        level: 'MEDIUM',
        color: '255,159,10',
        reason: 'High urban density'
      });
    }
    
    if (risks.length === 0) {
      risks.push({
        type: 'Environmental Risk',
        level: 'LOW',
        color: '52,199,89',
        reason: 'No significant risks detected'
      });
    }
    
    return risks;
  }

  // fit to selection button
  document.getElementById('fitToSelection').addEventListener('click', () => {
    const layers = drawnItems.getLayers();
    if (!layers.length) return;
    analysisMap.fitBounds(layers[0].getBounds(), {padding:[20,20]});
  });

  // Initialize voice commands
  initializeVoiceCommands();
});
