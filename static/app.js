class HealthEquityMap {
    constructor() {
        this.map = null;
        this.currentMeasure = null;
        this.currentData = [];
        this.markers = [];
        this.showSDOH = false;
        this.availableMeasures = [];
        this.minZoomForMarkers = 6; // Minimum zoom level to show markers
        this.markersVisible = false;
        
        this.init();
    }
    
    async init() {
        this.initMap();
        await this.loadMeasures();
        this.setupEventListeners();
        this.updateStatsPanel();
    }
    
    initMap() {
        // Initialize map centered on United States
        this.map = L.map('map').setView([39.8283, -98.5795], 4);
        
        // Add OpenStreetMap tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(this.map);
        
        // Add zoom event listener
        this.map.on('zoomend', () => {
            this.handleZoomChange();
        });
        
        // Add legend
        this.addLegend();
    }
    
    addLegend() {
        this.legend = L.control({position: 'bottomright'});
        
        this.legend.onAdd = (map) => {
            this.legendDiv = L.DomUtil.create('div', 'legend');
            // Show default legend initially
            this.legendDiv.innerHTML = `
                <h4>Data Value Legend</h4>
                <div class="legend-gradient" style="
                    height: 20px; 
                    background: linear-gradient(to right, #e74c3c, #3498db); 
                    border-radius: 4px; 
                    margin: 0.5rem 0;
                    border: 1px solid #ddd;
                "></div>
                <div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: #666; margin-bottom: 0.5rem;">
                    <span>Low</span>
                    <span>High</span>
                </div>
                <hr style="margin: 0.5rem 0;">
                <p style="font-size: 0.8rem; margin: 0.25rem 0; color: #666;">
                    <strong>All 50 states + DC included</strong>
                </p>
            `;
            return this.legendDiv;
        };
        
        this.legend.addTo(this.map);
    }
    
    updateLegendContent() {
        if (!this.legendDiv) return;
        
        const isPositive = this.isPositiveMeasure(this.currentMeasure);
        const measureType = isPositive ? 'Positive' : 'Negative';
        const lowColor = isPositive ? '#e74c3c' : '#3498db';
        const highColor = isPositive ? '#3498db' : '#e74c3c';
        const lowDescription = isPositive ? 'Low (Bad)' : 'Low (Good)';
        const highDescription = isPositive ? 'High (Good)' : 'High (Bad)';
        
        this.legendDiv.innerHTML = `
            <h4>Data Value Legend</h4>
            <div class="legend-gradient" style="
                height: 20px; 
                background: linear-gradient(to right, ${lowColor}, ${highColor}); 
                border-radius: 4px; 
                margin: 0.5rem 0;
                border: 1px solid #ddd;
            "></div>
            <div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: #666; margin-bottom: 0.5rem;">
                <span>${lowDescription}</span>
                <span>${highDescription}</span>
            </div>
            <hr style="margin: 0.5rem 0;">
            <p style="font-size: 0.8rem; margin: 0.25rem 0; color: #666;">
                <strong>${measureType} Measure:</strong> Gradient from ${lowDescription} to ${highDescription}
            </p>
            <hr style="margin: 0.5rem 0;">
            <p style="font-size: 0.8rem; margin: 0.25rem 0; color: #666;">
                <strong>All 50 states + DC included</strong>
            </p>
        `;
    }
    
    async loadMeasures() {
        this.showLoading(true);
        
        try {
            console.log('Loading measures...');
            const response = await fetch('/api/measures');
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            this.availableMeasures = await response.json();
            
            // Populate the measure dropdown
            this.populateMeasureDropdown();
            
            console.log('Loaded measures:', this.availableMeasures.length);
            console.log('Sample measures:', this.availableMeasures.slice(0, 5));
            
        } catch (error) {
            console.error('Error loading measures:', error);
            this.showError('Failed to load measures. Please try again.');
        } finally {
            this.showLoading(false);
        }
    }
    
    populateMeasureDropdown() {
        const select = document.getElementById('measure-select');
        
        // Clear existing options
        select.innerHTML = '<option value="">Select a health measure...</option>';
        
        console.log('Populating dropdown with', this.availableMeasures.length, 'measures');
        
        // Add measures
        this.availableMeasures.forEach((measure, index) => {
            const option = document.createElement('option');
            option.value = measure.Measure_Clean;
            option.textContent = measure.Measure_Short || measure.Measure_Clean;
            select.appendChild(option);
            
            if (index < 5) {
                console.log(`Added measure ${index + 1}:`, measure.Measure_Short, '->', measure.Measure_Clean);
            }
        });
        
        console.log('Dropdown populated with', select.options.length - 1, 'options');
    }
    
    setupEventListeners() {
        document.getElementById('measure-select').addEventListener('change', (e) => {
            this.currentMeasure = e.target.value;
            if (this.currentMeasure) {
                this.loadMeasureData();
            } else {
                this.clearMap();
                this.updateStatsPanel();
            }
        });
        
        document.getElementById('toggle-sdoh').addEventListener('click', () => {
            this.showSDOH = !this.showSDOH;
            // SDOH functionality not implemented yet
            console.log('SDOH toggle:', this.showSDOH);
        });
        
        document.getElementById('refresh-data').addEventListener('click', () => {
            if (this.currentMeasure) {
                this.loadMeasureData();
            }
        });
    }
    
    async loadMeasureData() {
        if (!this.currentMeasure) return;
        
        this.showLoading(true);
        
        try {
            console.log('Loading data for measure:', this.currentMeasure);
            const response = await fetch(`/api/measure-data/${encodeURIComponent(this.currentMeasure)}`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            this.currentData = await response.json();
            
            console.log('Received data:', this.currentData.length, 'records');
            
            if (this.currentData.length === 0) {
                this.showError('No data available for the selected measure.');
                return;
            }
            
            // Check if we should render markers based on current zoom level
            const currentZoom = this.map.getZoom();
            console.log('Current zoom level:', currentZoom, 'Min zoom for markers:', this.minZoomForMarkers);
            
            if (currentZoom >= this.minZoomForMarkers) {
                console.log('Rendering markers...');
                this.renderMap();
            } else {
                console.log('Zoom level too low, not rendering markers');
                this.markersVisible = false;
            }
            
            this.updateStatsPanel();
            this.updateLegendContent();
            
            console.log('Loaded data for measure:', this.currentMeasure, 'Records:', this.currentData.length);
            
        } catch (error) {
            console.error('Error loading measure data:', error);
            this.showError('Failed to load data for the selected measure.');
        } finally {
            this.showLoading(false);
        }
    }
    
    handleZoomChange() {
        const currentZoom = this.map.getZoom();
        const shouldShowMarkers = currentZoom >= this.minZoomForMarkers;
        
        if (shouldShowMarkers && !this.markersVisible && this.currentData.length > 0) {
            this.renderMap();
            this.markersVisible = true;
            this.hideZoomMessage();
        } else if (!shouldShowMarkers && this.markersVisible) {
            this.clearMap();
            this.markersVisible = false;
            if (this.currentData.length > 0) {
                this.showZoomMessage();
            }
        } else if (!shouldShowMarkers && this.currentData.length > 0) {
            this.showZoomMessage();
        } else if (shouldShowMarkers) {
            this.hideZoomMessage();
        }
    }
    
    renderMap() {
        console.log('renderMap called with', this.currentData.length, 'data points');
        
        // Clear existing markers
        this.markers.forEach(marker => this.map.removeLayer(marker));
        this.markers = [];
        
        if (this.currentData.length === 0) {
            console.log('No data to render');
            return;
        }
        
        // Check if we should show markers based on zoom level
        const currentZoom = this.map.getZoom();
        if (currentZoom < this.minZoomForMarkers) {
            console.log('Zoom level too low for markers');
            this.markersVisible = false;
            return;
        }
        
        // Calculate quartiles for color coding
        const values = this.currentData.map(d => d.Data_Value).filter(v => !isNaN(v));
        const quartiles = this.calculateQuartiles(values);
        
        console.log('Creating markers for', this.currentData.length, 'locations');
        console.log('Value range:', Math.min(...values), 'to', Math.max(...values));
        
        // Create markers
        let markersCreated = 0;
        this.currentData.forEach((location, index) => {
            if (location.lat && location.lng && !isNaN(location.lat) && !isNaN(location.lng)) {
                const marker = this.createMarker(location, quartiles, this.currentMeasure);
                this.markers.push(marker);
                markersCreated++;
            } else {
                console.warn('Invalid coordinates for location:', location.LocationName, location.lat, location.lng);
            }
        });
        
        console.log('Created', markersCreated, 'markers');
        this.markersVisible = true;
    }
    
    calculateQuartiles(values) {
        const sorted = values.sort((a, b) => a - b);
        const q1 = sorted[Math.floor(sorted.length * 0.25)];
        const q2 = sorted[Math.floor(sorted.length * 0.5)];
        const q3 = sorted[Math.floor(sorted.length * 0.75)];
        
        return { q1, q2, q3, min: sorted[0], max: sorted[sorted.length - 1] };
    }
    
    createMarker(location, quartiles, measureName = null) {
        const value = location.Data_Value;
        const color = this.getDataColor(value, quartiles, measureName);
        const radius = this.getMarkerRadius(location.TotalPopulation || 1000);
        
        const marker = L.circleMarker([location.lat, location.lng], {
            radius: radius,
            fillColor: color,
            color: 'white',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8,
            className: 'health-marker'
        });
        
        // Create popup content
        const popupContent = `
            <div class="popup-content">
                <h4>${location.LocationName || 'Unknown Location'}</h4>
                <p><strong>State:</strong> ${location.StateDesc || 'N/A'}</p>
                <p><strong>Value:</strong> ${value.toFixed(1)}${location.Data_Value_Unit || ''}</p>
                <p><strong>Population:</strong> ${location.TotalPopulation ? location.TotalPopulation.toLocaleString() : 'N/A'}</p>
                <p><strong>Type:</strong> ${location.Data_Value_Type || 'N/A'}</p>
                ${location.Low_Confidence_Limit && location.High_Confidence_Limit ? 
                    `<p><strong>Confidence Interval:</strong> ${location.Low_Confidence_Limit.toFixed(1)} - ${location.High_Confidence_Limit.toFixed(1)}</p>` : ''
                }
            </div>
        `;
        
        marker.bindPopup(popupContent);
        
        // Add click handler
        marker.on('click', () => this.showLocationStats(location));
        
        return marker.addTo(this.map);
    }
    
    formatMeasuresForPopup(measures) {
        if (!measures || Object.keys(measures).length === 0) {
            return '<p>No measures available</p>';
        }
        
        let measuresHtml = '<ul style="max-height: 200px; overflow-y: auto;">';
        
        for (const [measureName, measureData] of Object.entries(measures)) {
            const value = measureData.value;
            const unit = measureData.unit || '';
            const confidence = measureData.low_confidence && measureData.high_confidence ? 
                ` (${measureData.low_confidence.toFixed(1)}-${measureData.high_confidence.toFixed(1)})` : '';
            
            measuresHtml += `
                <li style="margin-bottom: 8px;">
                    <strong>${measureName}:</strong><br>
                    <span style="color: #2c3e50; font-weight: bold;">${value.toFixed(1)}${unit}</span>${confidence}
                </li>
            `;
        }
        
        measuresHtml += '</ul>';
        return measuresHtml;
    }
    
    isPositiveMeasure(measureName) {
        if (!measureName) return true; // Default to positive if unknown
        
        const measureLower = measureName.toLowerCase();
        
        // Positive measures (higher is better)
        const positiveKeywords = [
            'screening', 'checkup', 'visit', 'control', 'medication', 'vaccination',
            'preventive', 'mammography', 'cholesterol screening', 'cervical cancer screening',
            'colorectal cancer screening', 'dental visit', 'routine checkup',
            'core preventive services', 'up to date', 'flu shot', 'ppv shot'
        ];
        
        // Negative measures (higher is worse)
        const negativeKeywords = [
            'cancer', 'disease', 'diabetes', 'asthma', 'copd', 'stroke', 'arthritis',
            'obesity', 'smoking', 'drinking', 'binge drinking', 'high blood pressure',
            'high cholesterol', 'chronic kidney disease', 'mental health not good',
            'physical health not good', 'sleeping less', 'teeth lost', 'lack of health insurance',
            'no leisure-time physical activity', 'physical inactivity'
        ];
        
        // Check for negative keywords first (more specific)
        for (const keyword of negativeKeywords) {
            if (measureLower.includes(keyword)) {
                return false;
            }
        }
        
        // Check for positive keywords
        for (const keyword of positiveKeywords) {
            if (measureLower.includes(keyword)) {
                return true;
            }
        }
        
        // Default to positive if no clear indication
        return true;
    }

    getDataColor(value, quartiles, measureName = null) {
        if (value === null || value === undefined || isNaN(value)) return '#95a5a6';
        
        const isPositive = this.isPositiveMeasure(measureName);
        const min = quartiles.min;
        const max = quartiles.max;
        
        // Normalize value to 0-1 range
        const normalized = (value - min) / (max - min);
        
        if (isPositive) {
            // For positive measures: red (low) to blue (high)
            return this.getGradientColor(normalized, '#e74c3c', '#3498db');
        } else {
            // For negative measures: blue (low) to red (high)
            return this.getGradientColor(normalized, '#3498db', '#e74c3c');
        }
    }
    
    getGradientColor(normalized, startColor, endColor) {
        // Ensure normalized is between 0 and 1
        normalized = Math.max(0, Math.min(1, normalized));
        
        // Parse hex colors
        const start = this.hexToRgb(startColor);
        const end = this.hexToRgb(endColor);
        
        // Interpolate between start and end colors
        const r = Math.round(start.r + (end.r - start.r) * normalized);
        const g = Math.round(start.g + (end.g - start.g) * normalized);
        const b = Math.round(start.b + (end.b - start.b) * normalized);
        
        return `rgb(${r}, ${g}, ${b})`;
    }
    
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }
    
    getMarkerRadius(population) {
        if (!population) return 8;
        
        // Get current zoom level for dynamic sizing
        const currentZoom = this.map.getZoom();
        const zoomFactor = Math.max(1, (currentZoom - this.minZoomForMarkers + 1) * 0.5);
        
        // Scale marker size based on population and zoom level
        const minRadius = 6 * zoomFactor;
        const maxRadius = 20 * zoomFactor;
        const minPop = 100;
        const maxPop = 100000;
        
        const normalizedPop = Math.min(Math.max(population, minPop), maxPop);
        const ratio = (normalizedPop - minPop) / (maxPop - minPop);
        
        return minRadius + (maxRadius - minRadius) * ratio;
    }
    
    showLocationStats(location) {
        const statsContent = document.getElementById('stats-content');
        const value = location.Data_Value;
        
        statsContent.innerHTML = `
            <h4>${location.LocationName || 'Unknown Location'}</h4>
            <p><strong>State:</strong> ${location.StateDesc || 'N/A'}</p>
            <p><strong>Value:</strong> ${value.toFixed(1)}${location.Data_Value_Unit || ''}</p>
            <p><strong>Population:</strong> ${location.TotalPopulation ? location.TotalPopulation.toLocaleString() : 'N/A'}</p>
            <p><strong>Coordinates:</strong> ${location.lat ? location.lat.toFixed(4) : 'N/A'}, ${location.lng ? location.lng.toFixed(4) : 'N/A'}</p>
            <p><strong>Type:</strong> ${location.Data_Value_Type || 'N/A'}</p>
            ${location.Low_Confidence_Limit && location.High_Confidence_Limit ? 
                `<p><strong>Confidence Interval:</strong> ${location.Low_Confidence_Limit.toFixed(1)} - ${location.High_Confidence_Limit.toFixed(1)}</p>` : ''
            }
        `;
    }
    
    formatMeasuresForDetails(measures) {
        if (!measures || Object.keys(measures).length === 0) {
            return '<p>No measures available</p>';
        }
        
        let measuresHtml = '<ul style="max-height: 300px; overflow-y: auto;">';
        
        for (const [measureName, measureData] of Object.entries(measures)) {
            const value = measureData.value;
            const unit = measureData.unit || '';
            const confidence = measureData.low_confidence && measureData.high_confidence ? 
                ` (${measureData.low_confidence.toFixed(1)}-${measureData.high_confidence.toFixed(1)})` : '';
            
            measuresHtml += `
                <li style="margin-bottom: 10px; padding: 8px; background: #f8f9fa; border-radius: 4px;">
                    <strong>${measureName}:</strong><br>
                    <span style="color: #2c3e50; font-weight: bold; font-size: 1.1em;">${value.toFixed(1)}${unit}</span>${confidence}
                </li>
            `;
        }
        
        measuresHtml += '</ul>';
        return measuresHtml;
    }
    
    updateStatsPanel() {
        const statsContent = document.getElementById('stats-content');
        
        if (!this.currentMeasure) {
            statsContent.innerHTML = `
                <p>Select a health measure from the dropdown to view data on the map.</p>
                <p><strong>Available measures:</strong> ${this.availableMeasures.length}</p>
            `;
            return;
        }
        
        if (this.currentData.length === 0) {
            statsContent.innerHTML = '<p>No data available for the selected measure.</p>';
            return;
        }
        
        // Check if markers should be visible based on zoom level
        const currentZoom = this.map.getZoom();
        const shouldShowMarkers = currentZoom >= this.minZoomForMarkers;
        
        if (!shouldShowMarkers) {
            // Show zoom message in the stats panel but keep it minimal
            statsContent.innerHTML = `
                <div style="background: #f8f9fa; padding: 0.5rem; border-radius: 4px; border-left: 3px solid #6c757d;">
                    <p style="margin: 0; color: #6c757d;"><strong>Data loaded:</strong> ${this.currentData.length} locations ready to display</p>
                    <p style="margin: 0.25rem 0 0 0; color: #6c757d; font-size: 0.9rem;">Click on a location marker to see detailed information.</p>
                </div>
            `;
            this.showZoomMessage();
            return;
        } else {
            this.hideZoomMessage();
        }
        
        // Calculate summary statistics
        const values = this.currentData.map(d => d.Data_Value).filter(v => !isNaN(v));
        const avgValue = values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : 0;
        const minValue = Math.min(...values);
        const maxValue = Math.max(...values);
        const totalPopulation = this.currentData.reduce((sum, d) => sum + (d.TotalPopulation || 0), 0);
        
        // Calculate quartiles
        const quartiles = this.calculateQuartiles(values);
        
        // Determine if this is a positive or negative measure
        const isPositive = this.isPositiveMeasure(this.currentMeasure);
        
        statsContent.innerHTML = `
            <h4>Summary Statistics</h4>
            <p><strong>Selected Measure:</strong> ${this.currentMeasure.length > 60 ? this.currentMeasure.substring(0, 60) + '...' : this.currentMeasure}</p>
            <p><strong>Total Locations:</strong> ${this.currentData.length}</p>
            <p><strong>Average Value:</strong> ${avgValue.toFixed(1)}</p>
            <p><strong>Range:</strong> ${minValue.toFixed(1)} - ${maxValue.toFixed(1)}</p>
            <p><strong>Total Population:</strong> ${totalPopulation.toLocaleString()}</p>
            
            <h5>Value Distribution:</h5>
            <div class="value-distribution">
                <div class="gradient-bar" style="
                    height: 20px; 
                    background: linear-gradient(to right, ${isPositive ? '#e74c3c' : '#3498db'}, ${isPositive ? '#3498db' : '#e74c3c'}); 
                    border-radius: 4px; 
                    margin: 0.5rem 0;
                    border: 1px solid #ddd;
                "></div>
                <div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: #666; margin-bottom: 0.5rem;">
                    <span>${isPositive ? 'Low (Bad)' : 'Low (Good)'}</span>
                    <span>${isPositive ? 'High (Good)' : 'High (Bad)'}</span>
                </div>
                <div class="dist-item">
                    <span class="dist-color" style="background-color: ${isPositive ? '#e74c3c' : '#3498db'};"></span>
                    <span>Low (<${quartiles.q1.toFixed(1)}): ${values.filter(v => v < quartiles.q1).length}</span>
                </div>
                <div class="dist-item">
                    <span class="dist-color" style="background-color: ${isPositive ? '#c0392b' : '#2980b9'};"></span>
                    <span>Medium-Low (${quartiles.q1.toFixed(1)}-${quartiles.q2.toFixed(1)}): ${values.filter(v => v >= quartiles.q1 && v < quartiles.q2).length}</span>
                </div>
                <div class="dist-item">
                    <span class="dist-color" style="background-color: ${isPositive ? '#2980b9' : '#c0392b'};"></span>
                    <span>Medium-High (${quartiles.q2.toFixed(1)}-${quartiles.q3.toFixed(1)}): ${values.filter(v => v >= quartiles.q2 && v < quartiles.q3).length}</span>
                </div>
                <div class="dist-item">
                    <span class="dist-color" style="background-color: ${isPositive ? '#3498db' : '#e74c3c'};"></span>
                    <span>High (≥${quartiles.q3.toFixed(1)}): ${values.filter(v => v >= quartiles.q3).length}</span>
                </div>
            </div>
            
            <hr>
            <p><em>Click on a location marker to see detailed information.</em></p>
        `;
    }
    
    clearMap() {
        this.markers.forEach(marker => this.map.removeLayer(marker));
        this.markers = [];
        this.markersVisible = false;
        // Don't clear currentData here as we want to keep it for when zooming back in
    }
    
    showLoading(show) {
        const loading = document.getElementById('loading');
        if (show) {
            loading.classList.remove('hidden');
        } else {
            loading.classList.add('hidden');
        }
    }
    
    showError(message) {
        const statsContent = document.getElementById('stats-content');
        statsContent.innerHTML = `
            <div style="color: #e74c3c; background: #fdf2f2; padding: 1rem; border-radius: 4px; border-left: 4px solid #e74c3c;">
                <strong>Error:</strong> ${message}
            </div>
        `;
    }
    
    showZoomMessage() {
        let zoomBar = document.getElementById('zoom-message-bar');
        if (!zoomBar) {
            // Create the zoom message bar
            zoomBar = document.createElement('div');
            zoomBar.id = 'zoom-message-bar';
            zoomBar.style.cssText = `
                position: absolute;
                top: 10px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(52, 152, 219, 0.9);
                color: white;
                padding: 8px 16px;
                border-radius: 4px;
                font-size: 14px;
                font-weight: 500;
                z-index: 1000;
                box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                pointer-events: none;
            `;
            zoomBar.textContent = 'Zoom in to see data points';
            
            // Add it to the map container
            const mapContainer = document.getElementById('map');
            mapContainer.appendChild(zoomBar);
        }
        zoomBar.style.display = 'block';
    }
    
    hideZoomMessage() {
        const zoomBar = document.getElementById('zoom-message-bar');
        if (zoomBar) {
            zoomBar.style.display = 'none';
        }
    }
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new HealthEquityMap();
});
