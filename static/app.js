class HealthEquityMap {
    constructor() {
        this.map = null;
        this.currentMeasure = null;
        this.currentData = [];
        this.markers = [];
        this.showSDOH = false;
        this.availableMeasures = [];
        
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
        
        // Add legend
        this.addLegend();
    }
    
    addLegend() {
        const legend = L.control({position: 'bottomright'});
        
        legend.onAdd = function(map) {
            const div = L.DomUtil.create('div', 'legend');
            div.innerHTML = `
                <h4>Data Value Legend</h4>
                <div class="legend-item">
                    <div class="legend-color" style="background-color: #27ae60;"></div>
                    <span>High (Top 25%)</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background-color: #f39c12;"></div>
                    <span>Medium-High (50-75%)</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background-color: #e67e22;"></div>
                    <span>Medium-Low (25-50%)</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background-color: #e74c3c;"></div>
                    <span>Low (Bottom 25%)</span>
                </div>
                <hr style="margin: 0.5rem 0;">
                <p style="font-size: 0.8rem; margin: 0.25rem 0; color: #666;">
                    Colors represent quartiles of the selected measure
                </p>
            `;
            return div;
        };
        
        legend.addTo(this.map);
    }
    
    async loadMeasures() {
        this.showLoading(true);
        
        try {
            const response = await fetch('/api/measures');
            this.availableMeasures = await response.json();
            
            // Populate the measure dropdown
            this.populateMeasureDropdown();
            
            console.log('Loaded measures:', this.availableMeasures.length);
            
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
        
        // Add measures
        this.availableMeasures.forEach(measure => {
            const option = document.createElement('option');
            option.value = measure.Measure_Clean;
            option.textContent = measure.Measure_Short || measure.Measure_Clean;
            select.appendChild(option);
        });
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
            const response = await fetch(`/api/measure-data/${encodeURIComponent(this.currentMeasure)}`);
            this.currentData = await response.json();
            
            if (this.currentData.length === 0) {
                this.showError('No data available for the selected measure.');
                return;
            }
            
            this.renderMap();
            this.updateStatsPanel();
            
            console.log('Loaded data for measure:', this.currentMeasure, 'Records:', this.currentData.length);
            
        } catch (error) {
            console.error('Error loading measure data:', error);
            this.showError('Failed to load data for the selected measure.');
        } finally {
            this.showLoading(false);
        }
    }
    
    renderMap() {
        // Clear existing markers
        this.markers.forEach(marker => this.map.removeLayer(marker));
        this.markers = [];
        
        if (this.currentData.length === 0) return;
        
        // Calculate quartiles for color coding
        const values = this.currentData.map(d => d.Data_Value).filter(v => !isNaN(v));
        const quartiles = this.calculateQuartiles(values);
        
        // Create markers
        this.currentData.forEach(location => {
            const marker = this.createMarker(location, quartiles);
            this.markers.push(marker);
        });
    }
    
    calculateQuartiles(values) {
        const sorted = values.sort((a, b) => a - b);
        const q1 = sorted[Math.floor(sorted.length * 0.25)];
        const q2 = sorted[Math.floor(sorted.length * 0.5)];
        const q3 = sorted[Math.floor(sorted.length * 0.75)];
        
        return { q1, q2, q3, min: sorted[0], max: sorted[sorted.length - 1] };
    }
    
    createMarker(location, quartiles) {
        const value = location.Data_Value;
        const color = this.getDataColor(value, quartiles);
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
    
    getDataColor(value, quartiles) {
        if (value === null || value === undefined || isNaN(value)) return '#95a5a6';
        
        if (value >= quartiles.q3) return '#27ae60'; // High - Green
        if (value >= quartiles.q2) return '#f39c12'; // Medium-High - Orange
        if (value >= quartiles.q1) return '#e67e22'; // Medium-Low - Dark Orange
        return '#e74c3c'; // Low - Red
    }
    
    getMarkerRadius(population) {
        if (!population) return 6;
        
        // Scale marker size based on population
        const minRadius = 4;
        const maxRadius = 15;
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
        
        // Calculate summary statistics
        const values = this.currentData.map(d => d.Data_Value).filter(v => !isNaN(v));
        const avgValue = values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : 0;
        const minValue = Math.min(...values);
        const maxValue = Math.max(...values);
        const totalPopulation = this.currentData.reduce((sum, d) => sum + (d.TotalPopulation || 0), 0);
        
        // Calculate quartiles
        const quartiles = this.calculateQuartiles(values);
        
        statsContent.innerHTML = `
            <h4>Summary Statistics</h4>
            <p><strong>Selected Measure:</strong> ${this.currentMeasure.length > 60 ? this.currentMeasure.substring(0, 60) + '...' : this.currentMeasure}</p>
            <p><strong>Total Locations:</strong> ${this.currentData.length}</p>
            <p><strong>Average Value:</strong> ${avgValue.toFixed(1)}</p>
            <p><strong>Range:</strong> ${minValue.toFixed(1)} - ${maxValue.toFixed(1)}</p>
            <p><strong>Total Population:</strong> ${totalPopulation.toLocaleString()}</p>
            
            <h5>Value Distribution:</h5>
            <div class="value-distribution">
                <div class="dist-item">
                    <span class="dist-color" style="background-color: #27ae60;"></span>
                    <span>High (≥${quartiles.q3.toFixed(1)}): ${values.filter(v => v >= quartiles.q3).length}</span>
                </div>
                <div class="dist-item">
                    <span class="dist-color" style="background-color: #f39c12;"></span>
                    <span>Medium-High (${quartiles.q2.toFixed(1)}-${quartiles.q3.toFixed(1)}): ${values.filter(v => v >= quartiles.q2 && v < quartiles.q3).length}</span>
                </div>
                <div class="dist-item">
                    <span class="dist-color" style="background-color: #e67e22;"></span>
                    <span>Medium-Low (${quartiles.q1.toFixed(1)}-${quartiles.q2.toFixed(1)}): ${values.filter(v => v >= quartiles.q1 && v < quartiles.q2).length}</span>
                </div>
                <div class="dist-item">
                    <span class="dist-color" style="background-color: #e74c3c;"></span>
                    <span>Low (<${quartiles.q1.toFixed(1)}): ${values.filter(v => v < quartiles.q1).length}</span>
                </div>
            </div>
            
            <hr>
            <p><em>Click on a location marker to see detailed information.</em></p>
        `;
    }
    
    clearMap() {
        this.markers.forEach(marker => this.map.removeLayer(marker));
        this.markers = [];
        this.currentData = [];
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
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new HealthEquityMap();
});
