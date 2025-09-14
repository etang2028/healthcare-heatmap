class HealthEquityMap {
    constructor() {
        this.map = null;
        this.currentMeasure = null;
        this.currentData = [];
        this.markers = [];
        this.showSDOH = false;
        this.availableMeasures = [];
        this.minZoomForMarkers = 7; // Minimum zoom level to show markers
        this.markersVisible = false;
        this.isStateView = false; // Toggle between state and city view
        
        this.init();
    }
    
    async init() {
        this.initMap();
        await this.loadMeasures();
        this.setupEventListeners();
        this.showInitialSummaryStats();
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
        const viewType = this.isStateView ? 'State-level aggregation' : 'City-level data';
        
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
            <p style="font-size: 0.8rem; margin: 0.25rem 0; color: #666;">
                <strong>View:</strong> ${viewType}
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
                this.showInitialSummaryStats();
            }
        });
        
        document.getElementById('view-toggle').addEventListener('change', (e) => {
            this.isStateView = e.target.checked;
            this.updateToggleText();
            if (this.currentMeasure) {
                // Reload data from the correct API endpoint
                this.loadMeasureData();
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
    
    updateToggleText() {
        const toggleText = document.querySelector('.toggle-text');
        if (toggleText) {
            toggleText.textContent = 'State View';
        }
    }
    
    updateStateStatsPanel(state, measureName, quartiles) {
        const statsContent = document.getElementById('stats-content');
        if (!statsContent) return;
        
        const isPositive = this.isPositiveMeasure(measureName);
        const valueDescription = isPositive ? 
            (state.avgValue >= quartiles.q3 ? 'High (Good)' : state.avgValue >= quartiles.q2 ? 'Medium-High' : state.avgValue >= quartiles.q1 ? 'Medium-Low' : 'Low (Bad)') :
            (state.avgValue >= quartiles.q3 ? 'High (Bad)' : state.avgValue >= quartiles.q2 ? 'Medium-High' : state.avgValue >= quartiles.q1 ? 'Medium-Low' : 'Low (Good)');
        
        statsContent.innerHTML = `
            <h4>${state.stateName} - State Statistics</h4>
            <p><strong>Selected Measure:</strong> ${measureName.length > 60 ? measureName.substring(0, 60) + '...' : measureName}</p>
            
            <h5>State-Level Data:</h5>
            <div class="state-stats">
                <div class="stat-item">
                    <strong>Average Value:</strong> ${state.avgValue.toFixed(1)}% ${valueDescription}
                </div>
                <div class="stat-item">
                    <strong>Total Population:</strong> ${state.totalPopulation.toLocaleString()}
                </div>
                <div class="stat-item">
                    <strong>Number of Locations:</strong> ${state.locationCount}
                </div>
                <div class="stat-item">
                    <strong>Value Range:</strong> ${state.minValue.toFixed(1)}% - ${state.maxValue.toFixed(1)}%
                </div>
            </div>
            
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
            </div>
            
            <h5>State Context:</h5>
            <div class="state-context">
                <p><strong>Data Type:</strong> Population-weighted average across ${state.locationCount} locations</p>
                <p><strong>Coverage:</strong> ${((state.locationCount / 28) * 100).toFixed(0)}% of expected locations</p>
                <p><strong>Reliability:</strong> ${state.locationCount >= 20 ? 'High' : state.locationCount >= 10 ? 'Medium' : 'Low'} (based on location count)</p>
            </div>
            
            <hr style="margin: 1rem 0;">
            <p style="font-size: 0.8rem; color: #666; margin: 0;">
                <em>Click on other state markers to view their statistics</em>
            </p>
        `;
    }
    
    updateCityStatsPanel(location, measureName, quartiles) {
        const statsContent = document.getElementById('stats-content');
        if (!statsContent) return;
        
        const isPositive = this.isPositiveMeasure(measureName);
        const valueDescription = isPositive ? 
            (location.Data_Value >= quartiles.q3 ? 'High (Good)' : location.Data_Value >= quartiles.q2 ? 'Medium-High' : location.Data_Value >= quartiles.q1 ? 'Medium-Low' : 'Low (Bad)') :
            (location.Data_Value >= quartiles.q3 ? 'High (Bad)' : location.Data_Value >= quartiles.q2 ? 'Medium-High' : location.Data_Value >= quartiles.q1 ? 'Medium-Low' : 'Low (Good)');
        
        statsContent.innerHTML = `
            <h4>${location.LocationName} - City Statistics</h4>
            <p><strong>Selected Measure:</strong> ${measureName.length > 60 ? measureName.substring(0, 60) + '...' : measureName}</p>
            
            <h5>City-Level Data:</h5>
            <div class="state-stats">
                <div class="stat-item">
                    <strong>Value:</strong> ${location.Data_Value.toFixed(1)}% ${valueDescription}
                </div>
                <div class="stat-item">
                    <strong>Population:</strong> ${(location.TotalPopulation || 0).toLocaleString()}
                </div>
                <div class="stat-item">
                    <strong>State:</strong> ${location.StateDesc}
                </div>
                <div class="stat-item">
                    <strong>Data Type:</strong> ${location.Data_Value_Type || 'N/A'}
                </div>
                ${location.Low_Confidence_Limit && location.High_Confidence_Limit ? 
                    `<div class="stat-item"><strong>Confidence Interval:</strong> ${location.Low_Confidence_Limit.toFixed(1)}% - ${location.High_Confidence_Limit.toFixed(1)}%</div>` : ''
                }
            </div>
            
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
            </div>
            
            <h5>Location Context:</h5>
            <div class="state-context">
                <p><strong>Data Type:</strong> Direct measurement from ${location.Data_Value_Type || 'survey data'}</p>
                <p><strong>Reliability:</strong> ${location.Low_Confidence_Limit && location.High_Confidence_Limit ? 'High (confidence interval available)' : 'Standard'}</p>
                <p><strong>Population Size:</strong> ${(location.TotalPopulation || 0) >= 100000 ? 'Large' : (location.TotalPopulation || 0) >= 10000 ? 'Medium' : 'Small'} city/county</p>
            </div>
            
            <hr style="margin: 1rem 0;">
            <p style="font-size: 0.8rem; color: #666; margin: 0;">
                <em>Click on other city markers to view their statistics</em>
            </p>
        `;
    }
    
    showInitialSummaryStats() {
        const statsContent = document.getElementById('stats-content');
        if (!statsContent) return;
        
        statsContent.innerHTML = `
            <h4>Health Equity Heatmap</h4>
            <p><strong>Data Coverage:</strong> 28 health measures across all 50 states + DC</p>
            <p><strong>Total Locations:</strong> 28,335 cities and counties</p>
            <p><strong>Population Coverage:</strong> 330+ million Americans</p>
            
            <h5>Available Measures:</h5>
            <div class="measure-categories">
                <div class="category">
                    <strong>Chronic Conditions:</strong>
                    <ul>
                        <li>Diabetes, Heart Disease, Cancer</li>
                        <li>Asthma, COPD, Stroke</li>
                        <li>High Blood Pressure, High Cholesterol</li>
                    </ul>
                </div>
                <div class="category">
                    <strong>Preventive Care:</strong>
                    <ul>
                        <li>Cancer Screenings</li>
                        <li>Annual Checkups</li>
                        <li>Cholesterol Screening</li>
                    </ul>
                </div>
                <div class="category">
                    <strong>Lifestyle Factors:</strong>
                    <ul>
                        <li>Smoking, Obesity</li>
                        <li>Physical Activity</li>
                        <li>Sleep Patterns</li>
                    </ul>
                </div>
            </div>
            
            <hr style="margin: 1rem 0;">
            <p style="font-size: 0.9rem; color: #666; margin: 0;">
                <strong>Instructions:</strong> Select a health measure from the dropdown above to view data on the map. Use the toggle switch to switch between city-level and state-level views.
            </p>
        `;
    }
    
    async loadMeasureData() {
        if (!this.currentMeasure) return;
        
        this.showLoading(true);
        
        try {
            console.log('Loading data for measure:', this.currentMeasure);
            
            // Choose API endpoint based on view mode
            const apiEndpoint = this.isStateView ? 
                `/api/state-measure-data/${encodeURIComponent(this.currentMeasure)}` :
                `/api/measure-data/${encodeURIComponent(this.currentMeasure)}`;
            
            const response = await fetch(apiEndpoint);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            this.currentData = await response.json();
            
            console.log('Received data:', this.currentData.length, 'records');
            
            if (this.currentData.length === 0) {
                this.showError('No data available for the selected measure.');
                return;
            }
            
            // Check if we should render markers based on view mode and zoom level
            const currentZoom = this.map.getZoom();
            const shouldShowMarkers = this.isStateView || currentZoom >= this.minZoomForMarkers;
            console.log('Current zoom level:', currentZoom, 'State view:', this.isStateView, 'Should show markers:', shouldShowMarkers);
            
            if (shouldShowMarkers) {
                console.log('Rendering markers...');
                this.renderMap();
            } else {
                console.log('Zoom level too low for city markers, not rendering');
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
        
        // State view is always visible, city view respects zoom level
        const shouldShowMarkers = this.isStateView || currentZoom >= this.minZoomForMarkers;
        
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
        
        // Render based on toggle state
        if (this.isStateView) {
            console.log('Rendering state aggregation (always visible)');
            this.renderStateAggregation();
            this.markersVisible = true;
        } else {
            // City view - check zoom level
            const currentZoom = this.map.getZoom();
            if (currentZoom < this.minZoomForMarkers) {
                console.log('Zoom level too low for city markers');
                this.markersVisible = false;
                this.showZoomMessage();
                return;
            }
            console.log('Rendering city markers');
            this.renderCityMarkers();
            this.markersVisible = true;
            this.hideZoomMessage();
        }
    }
    
    renderStateAggregation() {
        console.log('Rendering state-level aggregation');
        console.log('Current data length:', this.currentData.length);
        
        // Aggregate data by state
        const stateData = this.aggregateDataByState();
        console.log('Aggregated state data:', stateData.length, 'states');
        
        if (stateData.length === 0) {
            console.warn('No state data to render!');
            return;
        }
        
        // Calculate quartiles for state data
        const values = stateData.map(d => d.avgValue).filter(v => !isNaN(v));
        const quartiles = this.calculateQuartiles(values);
        
        console.log('Creating state markers for', stateData.length, 'states');
        console.log('State value range:', Math.min(...values), 'to', Math.max(...values));
        console.log('Sample state data:', stateData.slice(0, 3));
        
        // Create state markers
        let markersCreated = 0;
        stateData.forEach((state, index) => {
            if (state.lat && state.lng && !isNaN(state.lat) && !isNaN(state.lng)) {
                const marker = this.createStateMarker(state, quartiles, this.currentMeasure);
                marker.addTo(this.map); // Add marker to map
                this.markers.push(marker);
                markersCreated++;
            } else {
                console.warn('Invalid coordinates for state:', state.stateName, state.lat, state.lng);
            }
        });
        
        console.log('Created', markersCreated, 'state markers');
    }
    
    renderCityMarkers() {
        console.log('Rendering city-level markers');
        
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
                marker.addTo(this.map); // Add marker to map
                this.markers.push(marker);
                markersCreated++;
            } else {
                console.warn('Invalid coordinates for location:', location.LocationName, location.lat, location.lng);
            }
        });
        
        console.log('Created', markersCreated, 'city markers');
    }
    
    calculateQuartiles(values) {
        const sorted = values.sort((a, b) => a - b);
        const q1 = sorted[Math.floor(sorted.length * 0.25)];
        const q2 = sorted[Math.floor(sorted.length * 0.5)];
        const q3 = sorted[Math.floor(sorted.length * 0.75)];
        
        return { q1, q2, q3, min: sorted[0], max: sorted[sorted.length - 1] };
    }
    
    aggregateDataByState() {
        // Group data by state
        const stateGroups = {};
        
        this.currentData.forEach(location => {
            const state = location.StateDesc;
            if (!stateGroups[state]) {
                stateGroups[state] = {
                    locations: [],
                    totalPopulation: 0,
                    values: []
                };
            }
            
            stateGroups[state].locations.push(location);
            stateGroups[state].totalPopulation += location.TotalPopulation || 0;
            stateGroups[state].values.push(location.Data_Value);
        });
        
        // Calculate aggregated values for each state
        const stateData = [];
        
        Object.keys(stateGroups).forEach(stateName => {
            const group = stateGroups[stateName];
            const validValues = group.values.filter(v => !isNaN(v));
            
            if (validValues.length === 0) return;
            
            // Calculate weighted average (by population) or simple average
            let avgValue;
            if (group.totalPopulation > 0) {
                // Weighted average by population
                let weightedSum = 0;
                let totalWeight = 0;
                
                group.locations.forEach(location => {
                    if (!isNaN(location.Data_Value)) {
                        const weight = location.TotalPopulation || 1;
                        weightedSum += location.Data_Value * weight;
                        totalWeight += weight;
                    }
                });
                
                avgValue = totalWeight > 0 ? weightedSum / totalWeight : validValues.reduce((a, b) => a + b, 0) / validValues.length;
            } else {
                // Simple average
                avgValue = validValues.reduce((a, b) => a + b, 0) / validValues.length;
            }
            
            // Calculate state center coordinates (average of all locations)
            const avgLat = group.locations.reduce((sum, loc) => sum + loc.lat, 0) / group.locations.length;
            const avgLng = group.locations.reduce((sum, loc) => sum + loc.lng, 0) / group.locations.length;
            
            stateData.push({
                stateName: stateName,
                avgValue: avgValue,
                totalPopulation: group.totalPopulation,
                locationCount: group.locations.length,
                lat: avgLat,
                lng: avgLng,
                minValue: Math.min(...validValues),
                maxValue: Math.max(...validValues)
            });
        });
        
        return stateData;
    }
    
    createStateMarker(state, quartiles, measureName) {
        const value = state.avgValue;
        const color = this.getDataColor(value, quartiles, measureName);
        const radius = this.getStateMarkerRadius(state.totalPopulation);
        
        const marker = L.circleMarker([state.lat, state.lng], {
            radius: radius,
            fillColor: color,
            color: 'white',
            weight: 3,
            opacity: 1,
            fillOpacity: 0.8
        });
        
        // Create popup content for state
        const isPositive = this.isPositiveMeasure(measureName);
        const valueDescription = isPositive ? 
            (value >= quartiles.q3 ? 'High (Good)' : value >= quartiles.q2 ? 'Medium-High' : value >= quartiles.q1 ? 'Medium-Low' : 'Low (Bad)') :
            (value >= quartiles.q3 ? 'High (Bad)' : value >= quartiles.q2 ? 'Medium-High' : value >= quartiles.q1 ? 'Medium-Low' : 'Low (Good)');
        
        const popupContent = `
            <div style="min-width: 200px;">
                <h4>${state.stateName}</h4>
                <p><strong>Average Value:</strong> ${value.toFixed(1)}% ${valueDescription}</p>
                <p><strong>Total Population:</strong> ${state.totalPopulation.toLocaleString()}</p>
                <p><strong>Locations:</strong> ${state.locationCount}</p>
                <p><strong>Range:</strong> ${state.minValue.toFixed(1)}% - ${state.maxValue.toFixed(1)}%</p>
                <hr style="margin: 0.5rem 0;">
                <p style="font-size: 0.8rem; color: #666; margin: 0;">
                    <em>State-level aggregation</em>
                </p>
            </div>
        `;
        
        marker.bindPopup(popupContent);
        
        // Add click event to update sidebar with state data
        marker.on('click', () => {
            this.updateStateStatsPanel(state, measureName, quartiles);
        });
        
        return marker;
    }
    
    getStateMarkerRadius(population) {
        if (!population) return 15;
        
        // Get current zoom level for dynamic sizing
        const currentZoom = this.map.getZoom();
        const zoomFactor = Math.max(0.5, (currentZoom - 3) * 0.3); // Scale based on zoom
        
        // Scale marker size based on population and zoom level
        const minRadius = 12 * zoomFactor;
        const maxRadius = 35 * zoomFactor;
        const minPop = 100000; // Minimum state population
        const maxPop = 40000000; // Maximum state population (California)
        
        const normalizedPop = Math.min(Math.max(population, minPop), maxPop);
        const ratio = (normalizedPop - minPop) / (maxPop - minPop);
        
        return minRadius + (maxRadius - minRadius) * ratio;
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
        marker.on('click', () => this.updateCityStatsPanel(location, measureName, quartiles));
        
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
        // Only show zoom message for city view
        if (this.isStateView) {
            return;
        }
        
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
            zoomBar.textContent = 'Zoom in to see city data points';
            
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
