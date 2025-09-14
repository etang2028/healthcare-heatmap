class HealthEquityMap {
    constructor() {
        this.map = null;
        this.currentMeasure = null;
        this.currentData = [];
        this.markers = [];
        this.showSDOH = false;
        this.showOverlay = false;
        this.availableMeasures = [];
        this.availableSDOHMeasures = [];
        this.overlayHealthData = [];
        this.overlaySDOHData = [];
        this.currentHealthMeasure = null;
        this.currentSDOHMeasure = null;
        this.minZoomForMarkers = 4; // Minimum zoom level to show markers
        this.markersVisible = false;
        this.isStateView = false; // Toggle between state and county view
        
        this.init();
    }
    
    async init() {
        this.initMap();
        await this.loadMeasures();
        await this.loadSDOHMeasures();
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
            // Show default legend initially (will be updated when data is loaded)
            this.legendDiv.innerHTML = `
                <h4>Data Value Legend</h4>
                <div class="legend-gradient" style="
                    height: 20px; 
                    background: linear-gradient(to right, #ffffff, #8B0000); 
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
        
        const measureType = 'Measure';
        const lowColor = '#ffffff';
        let highColor, dataType;
        
        const lowDescription = 'Low';
        const highDescription = 'High';
        const viewType = this.isStateView ? 'State-level aggregation' : 'County-level data';
        
        let legendContent;
        
        if (this.showOverlay) {
            // Overlay mode: show two separate gradient bars
            legendContent = `
                <h4>Data Value Legend</h4>
                <div style="margin-bottom: 0.5rem;">
                    <p style="font-size: 0.8rem; margin: 0.25rem 0; color: #666; font-weight: bold;">
                        Health Data (Left Half)
                    </p>
                    <div class="legend-gradient" style="
                        height: 15px; 
                        background: linear-gradient(to right, ${lowColor}, #8B0000); 
                        border-radius: 4px; 
                        margin: 0.25rem 0;
                        border: 1px solid #ddd;
                    "></div>
                    <div style="display: flex; justify-content: space-between; font-size: 0.7rem; color: #666; margin-bottom: 0.5rem;">
                        <span>${lowDescription}</span>
                        <span>${highDescription}</span>
                    </div>
                </div>
                <div style="margin-bottom: 0.5rem;">
                    <p style="font-size: 0.8rem; margin: 0.25rem 0; color: #666; font-weight: bold;">
                        SDOH Data (Right Half)
                    </p>
                    <div class="legend-gradient" style="
                        height: 15px; 
                        background: linear-gradient(to right, ${lowColor}, #0066cc); 
                        border-radius: 4px; 
                        margin: 0.25rem 0;
                        border: 1px solid #ddd;
                    "></div>
                    <div style="display: flex; justify-content: space-between; font-size: 0.7rem; color: #666; margin-bottom: 0.5rem;">
                        <span>${lowDescription}</span>
                        <span>${highDescription}</span>
                    </div>
                </div>
                <hr style="margin: 0.5rem 0;">
                <p style="font-size: 0.8rem; margin: 0.25rem 0; color: #666;">
                    <strong>Data Type:</strong> Overlay Data
                </p>
                <p style="font-size: 0.8rem; margin: 0.25rem 0; color: #666;">
                    <strong>View:</strong> ${viewType}
                </p>
                <hr style="margin: 0.5rem 0;">
                <p style="font-size: 0.8rem; margin: 0.25rem 0; color: #666;">
                    <strong>Health Measure:</strong> ${this.currentHealthMeasure ? this.currentHealthMeasure.substring(0, 40) + '...' : 'None selected'}
                </p>
                <p style="font-size: 0.8rem; margin: 0.25rem 0; color: #666;">
                    <strong>SDOH Measure:</strong> ${this.currentSDOHMeasure ? this.currentSDOHMeasure.substring(0, 40) + '...' : 'None selected'}
                </p>
                <hr style="margin: 0.5rem 0;">
                <p style="font-size: 0.8rem; margin: 0.25rem 0; color: #666;">
                    <strong>All 50 states + DC included</strong>
                </p>
            `;
        } else {
            // Regular mode: single gradient bar
            let highColor, dataType;
            
            if (this.showSDOH) {
                highColor = '#0066cc';
                dataType = 'SDOH Data';
            } else {
                highColor = '#8B0000';
                dataType = 'Health Data';
            }
            
            legendContent = `
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
                    <strong>Data Type:</strong> ${dataType}
                </p>
                <p style="font-size: 0.8rem; margin: 0.25rem 0; color: #666;">
                    <strong>View:</strong> ${viewType}
                </p>
            `;
        }
        
        if (!this.showOverlay) {
            legendContent += `
                <hr style="margin: 0.5rem 0;">
                <p style="font-size: 0.8rem; margin: 0.25rem 0; color: #666;">
                    <strong>All 50 states + DC included</strong>
                </p>
            `;
        }
        
        this.legendDiv.innerHTML = legendContent;
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

    async loadSDOHMeasures() {
        try {
            console.log('Loading SDOH measures...');
            const response = await fetch('/api/sdoh-measures');
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            this.availableSDOHMeasures = await response.json();
            
            // Populate the SDOH measure dropdown
            this.populateSDOHMeasureDropdown();
            
            console.log('Loaded SDOH measures:', this.availableSDOHMeasures.length);
            console.log('Sample SDOH measures:', this.availableSDOHMeasures.slice(0, 5));
            
        } catch (error) {
            console.error('Error loading SDOH measures:', error);
            this.showError('Failed to load SDOH measures. Please try again.');
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

    populateSDOHMeasureDropdown() {
        const optionsList = document.getElementById('sdoh-options-list');
        
        // Clear existing options
        optionsList.innerHTML = '';
        
        console.log('Populating SDOH dropdown with', this.availableSDOHMeasures.length, 'measures');
        
        // Add SDOH measures
        this.availableSDOHMeasures.forEach((measure, index) => {
            const option = document.createElement('div');
            option.className = 'dropdown-option';
            option.setAttribute('data-value', measure.name);
            option.textContent = measure.name;
            optionsList.appendChild(option);
            
            if (index < 5) {
                console.log(`Added SDOH measure ${index + 1}:`, measure.name);
            }
        });
        
        console.log('SDOH dropdown populated with', optionsList.children.length, 'options');
    }
    
    setupSDOHDropdownEvents() {
        const selectedElement = document.getElementById('sdoh-dropdown-selected');
        const optionsContainer = document.getElementById('sdoh-dropdown-options');
        const optionsList = document.getElementById('sdoh-options-list');
        const searchInput = document.getElementById('sdoh-search');
        
        // Toggle dropdown on click
        selectedElement.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = optionsContainer.style.display === 'block';
            
            if (isOpen) {
                this.closeSDOHDropdown();
            } else {
                this.openSDOHDropdown();
            }
        });
        
        // Handle option selection
        optionsList.addEventListener('click', (e) => {
            if (e.target.classList.contains('dropdown-option')) {
                const value = e.target.getAttribute('data-value');
                const text = e.target.textContent;
                
                // Update selected text
                selectedElement.querySelector('span:first-child').textContent = text;
                
                // Close dropdown
                this.closeSDOHDropdown();
                
                // Handle selection
                if (this.showSDOH || this.showOverlay) {
                    this.currentMeasure = value;
                    if (this.showOverlay) {
                        // In overlay mode, set SDOH measure and load if both are selected
                        this.currentSDOHMeasure = value;
                        if (this.currentHealthMeasure && this.currentSDOHMeasure) {
                            this.loadOverlayData();
                        } else {
                            this.clearMap();
                            this.showInitialSummaryStats();
                        }
                    } else if (this.currentMeasure) {
                        this.loadSDOHMeasureData();
                    } else {
                        this.clearMap();
                        this.showInitialSummaryStats();
                    }
                }
            }
        });
        
        // Search functionality
        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const options = optionsList.querySelectorAll('.dropdown-option');
            
            options.forEach(option => {
                const text = option.textContent.toLowerCase();
                if (text.includes(searchTerm)) {
                    option.style.display = 'block';
                } else {
                    option.style.display = 'none';
                }
            });
        });
        
        // Prevent search input from closing dropdown
        searchInput.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!selectedElement.contains(e.target) && !optionsContainer.contains(e.target)) {
                this.closeSDOHDropdown();
            }
        });
    }
    
    openSDOHDropdown() {
        const selectedElement = document.getElementById('sdoh-dropdown-selected');
        const optionsContainer = document.getElementById('sdoh-dropdown-options');
        const searchInput = document.getElementById('sdoh-search');
        
        selectedElement.classList.add('open');
        optionsContainer.style.display = 'block';
        
        // Clear search and show all options
        searchInput.value = '';
        const options = document.querySelectorAll('#sdoh-options-list .dropdown-option');
        options.forEach(option => option.style.display = 'block');
        
        // Focus on search input
        setTimeout(() => searchInput.focus(), 100);
    }
    
    closeSDOHDropdown() {
        const selectedElement = document.getElementById('sdoh-dropdown-selected');
        const optionsContainer = document.getElementById('sdoh-dropdown-options');
        
        selectedElement.classList.remove('open');
        optionsContainer.style.display = 'none';
    }
    
    setupEventListeners() {
        // Health measure selection
        document.getElementById('measure-select').addEventListener('change', (e) => {
            if (!this.showSDOH || this.showOverlay) {
                this.currentMeasure = e.target.value;
                if (this.showOverlay) {
                    // In overlay mode, set health measure and load if both are selected
                    this.currentHealthMeasure = e.target.value;
                    if (this.currentHealthMeasure && this.currentSDOHMeasure) {
                        this.loadOverlayData();
                    } else {
                        this.clearMap();
                        this.showInitialSummaryStats();
                    }
                } else if (this.currentMeasure) {
                    this.loadMeasureData();
                } else {
                    this.clearMap();
                    this.showInitialSummaryStats();
                }
            }
        });
        
        // SDOH measure selection - custom dropdown
        this.setupSDOHDropdownEvents();
        
        // Data type dropdown (Health vs SDOH vs Overlay)
        document.getElementById('data-type-select').addEventListener('change', (e) => {
            const selectedValue = e.target.value;
            this.showSDOH = selectedValue === 'sdoh';
            this.showOverlay = selectedValue === 'overlay';
            this.toggleDataType();
        });
        
        // State view toggle
        document.getElementById('view-toggle').addEventListener('change', (e) => {
            this.isStateView = e.target.checked;
            this.updateToggleText();
            if (this.currentMeasure) {
                // Reload data from the correct API endpoint
                if (this.showOverlay) {
                    this.loadOverlayData();
                } else if (this.showSDOH) {
                    this.loadSDOHMeasureData();
                } else {
                    this.loadMeasureData();
                }
            }
        });
    }
    
    updateToggleText() {
        const toggleText = document.querySelector('.toggle-text');
        if (toggleText) {
            toggleText.textContent = 'State View';
        }
    }

    toggleDataType() {
        const healthGroup = document.getElementById('health-measure-group');
        const sdohGroup = document.getElementById('sdoh-measure-group');
        
        if (this.showOverlay) {
            // Overlay mode: show both measure groups
            healthGroup.style.display = 'block';
            sdohGroup.style.display = 'block';
        } else if (this.showSDOH) {
            // SDOH mode: show only SDOH group
            healthGroup.style.display = 'none';
            sdohGroup.style.display = 'block';
        } else {
            // Health mode: show only health group
            healthGroup.style.display = 'block';
            sdohGroup.style.display = 'none';
        }
        
        // Clear current selection and map
        this.currentMeasure = null;
        this.currentHealthMeasure = null;
        this.currentSDOHMeasure = null;
        this.overlayHealthData = [];
        this.overlaySDOHData = [];
        document.getElementById('measure-select').value = '';
        
        // Reset SDOH dropdown
        const sdohSelected = document.getElementById('sdoh-dropdown-selected');
        sdohSelected.querySelector('span:first-child').textContent = 'Select an SDOH measure...';
        this.closeSDOHDropdown();
        
        this.clearMap();
        this.showInitialSummaryStats();
    }
    
    updateStateStatsPanel(state, measureName, quartiles) {
        const statsContent = document.getElementById('stats-content');
        if (!statsContent) return;
        
        const valueClassification = this.getValueClassification(state.avgValue, quartiles);
        
        statsContent.innerHTML = `
            <h4>${state.stateName} - State Statistics</h4>
            <p><strong>Selected Measure:</strong> ${measureName.length > 60 ? measureName.substring(0, 60) + '...' : measureName}</p>
            
            <h5>State-Level Data:</h5>
            <div class="state-stats">
                <div class="stat-item">
                    <strong>Average Value:</strong> ${state.avgValue.toFixed(1)}% <span style="color: ${this.getClassificationColor(valueClassification)}; font-weight: bold;">(${valueClassification})</span>
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
    
    updateCountyStatsPanel(location, measureName, quartiles) {
        const statsContent = document.getElementById('stats-content');
        if (!statsContent) return;
        
        const valueClassification = this.getValueClassification(location.Data_Value, quartiles);
        
        if (this.showOverlay) {
            // Overlay mode: show both datasets
            const matchingSDOH = this.findMatchingData(this.overlayHealthData, this.overlaySDOHData, location);
            const sdohClassification = matchingSDOH ? this.getValueClassification(matchingSDOH.Data_Value, quartiles) : 'Unknown';
            
            statsContent.innerHTML = `
                <h4>${location.LocationName} - County Statistics (Overlay)</h4>
                <p><strong>Health Measure:</strong> ${this.currentHealthMeasure.length > 60 ? this.currentHealthMeasure.substring(0, 60) + '...' : this.currentHealthMeasure}</p>
                <p><strong>SDOH Measure:</strong> ${this.currentSDOHMeasure.length > 60 ? this.currentSDOHMeasure.substring(0, 60) + '...' : this.currentSDOHMeasure}</p>
            
                <div class="state-stats">
                    <div class="stat-item">
                        <strong>Value:</strong> ${(() => {
                            let valueDisplay = `${location.Data_Value.toFixed(1)}%`;
                            if (location.Low_Confidence_Limit && location.High_Confidence_Limit) {
                                const margin = ((location.High_Confidence_Limit - location.Low_Confidence_Limit) / 2).toFixed(1);
                                valueDisplay += ` ± ${margin}%`;
                            }
                            return valueDisplay + ` <span style="color: ${this.getClassificationColor(valueClassification)}; font-weight: bold;">(${valueClassification})</span>`;
                        })()}
                    </div>
                    <div class="stat-item">
                        <strong>Population:</strong> ${(location.TotalPopulation || 0).toLocaleString()}
                    </div>
                    <div class="stat-item">
                        <strong>State:</strong> ${location.StateDesc}
                    </div>
                </div>
                
                ${matchingSDOH ? `
                    <h5>SDOH Data (${this.currentSDOHMeasure}):</h5>
                    <div class="state-stats" style="background: #f0f8ff; border-left: 4px solid #8B0080;">
                        <div class="stat-item">
                            <strong>Value:</strong> ${matchingSDOH.Data_Value ? matchingSDOH.Data_Value.toFixed(1) + (matchingSDOH.Data_Value_Unit || '') : 'N/A'} <span style="color: ${this.getClassificationColor(sdohClassification)}; font-weight: bold;">(${sdohClassification})</span>
                        </div>
                        <div class="stat-item">
                            <strong>Population:</strong> ${(matchingSDOH.TotalPopulation || 0).toLocaleString()}
                        </div>
                        <div class="stat-item">
                            <strong>Data Type:</strong> ${matchingSDOH.Data_Value_Type || 'survey data'}
                        </div>
                    </div>
                ` : `
                    <h5>SDOH Data (${this.currentSDOHMeasure}):</h5>
                    <div class="state-stats" style="background: #f8f8f8; border-left: 4px solid #ccc;">
                        <div class="stat-item">
                            <strong>Status:</strong> <span style="color: #666; font-style: italic;">No matching SDOH data available</span>
                        </div>
                    </div>
                `}
                
                <h5>Location Context:</h5>
                <div class="state-context">
                    <p><strong>Data Type:</strong> Direct measurement from ${location.Data_Value_Type || 'survey data'}</p>
                    <p><strong>Reliability:</strong> ${location.Low_Confidence_Limit && location.High_Confidence_Limit ? 'High (confidence interval available)' : 'Standard'}</p>
                    <p><strong>Population Size:</strong> ${(location.TotalPopulation || 0) >= 100000 ? 'Large' : (location.TotalPopulation || 0) >= 10000 ? 'Medium' : 'Small'} county</p>
                </div>
                
                <hr style="margin: 1rem 0;">
                <p style="font-size: 0.8rem; color: #666; margin: 0;">
                    <em>Click on other county markers to view their statistics</em>
                </p>
            `;
        } else {
            // Regular mode: show single dataset
            statsContent.innerHTML = `
                <h4>${location.LocationName} - County Statistics</h4>
                <p><strong>Selected Measure:</strong> ${measureName.length > 60 ? measureName.substring(0, 60) + '...' : measureName}</p>
                
                <h5>County-Level Data:</h5>
                <div class="state-stats">
                    <div class="stat-item">
                        <strong>Value:</strong> ${(() => {
                            let valueDisplay = `${location.Data_Value.toFixed(1)}%`;
                            if (location.Low_Confidence_Limit && location.High_Confidence_Limit) {
                                const margin = ((location.High_Confidence_Limit - location.Low_Confidence_Limit) / 2).toFixed(1);
                                valueDisplay += ` ± ${margin}%`;
                            }
                            return valueDisplay + ` <span style="color: ${this.getClassificationColor(valueClassification)}; font-weight: bold;">(${valueClassification})</span>`;
                        })()}
                    </div>
                    <div class="stat-item">
                        <strong>Population:</strong> ${(location.TotalPopulation || 0).toLocaleString()}
                    </div>
                    <div class="stat-item">
                        <strong>State:</strong> ${location.StateDesc}
                    </div>
                </div>
                
                <h5>Location Context:</h5>
                <div class="state-context">
                    <p><strong>Data Type:</strong> Direct measurement from ${location.Data_Value_Type || 'survey data'}</p>
                    <p><strong>Reliability:</strong> ${location.Low_Confidence_Limit && location.High_Confidence_Limit ? 'High (confidence interval available)' : 'Standard'}</p>
                    <p><strong>Population Size:</strong> ${(location.TotalPopulation || 0) >= 100000 ? 'Large' : (location.TotalPopulation || 0) >= 10000 ? 'Medium' : 'Small'} county</p>
                </div>
                
                <hr style="margin: 1rem 0;">
                <p style="font-size: 0.8rem; color: #666; margin: 0;">
                    <em>Click on other county markers to view their statistics</em>
                </p>
            `;
        }
    }
    
    showInitialSummaryStats() {
        const statsContent = document.getElementById('stats-content');
        if (!statsContent) return;
        
        if (this.showOverlay) {
            statsContent.innerHTML = `
                <h4>SDOH/Health Measure Overlay</h4>
                <p><strong>Mode:</strong> Compare health measures with social determinants of health</p>
                <p><strong>Instructions:</strong> Select both a health measure and an SDOH measure to view combined data</p>
                
                <div class="state-context" style="background: #e8f4fd; border-left: 4px solid #8B0080;">
                    <h5>Current Selection:</h5>
                    <p><strong>Health Measure:</strong> ${this.currentHealthMeasure || 'None selected'}</p>
                    <p><strong>SDOH Measure:</strong> ${this.currentSDOHMeasure || 'None selected'}</p>
                </div>
                
                <h5>How Overlay Works:</h5>
                <div class="measure-categories">
                    <div class="category">
                        <strong>Data Display:</strong>
                        <ul>
                            <li>Map markers show health data values</li>
                            <li>Popups display both health and SDOH values</li>
                            <li>Sidebar shows detailed comparison</li>
                        </ul>
                    </div>
                    <div class="category">
                        <strong>Matching:</strong>
                        <ul>
                            <li>Data matched by county name and state</li>
                            <li>Shows "No matching data" when unavailable</li>
                            <li>Purple gradient indicates overlay mode</li>
                        </ul>
                    </div>
                </div>
                
                <hr style="margin: 1rem 0;">
                <p style="font-size: 0.9rem; color: #666; margin: 0;">
                    <strong>Next Steps:</strong> Select both measures from the dropdowns above to begin overlay analysis.
                </p>
            `;
        } else {
            statsContent.innerHTML = `
                <h4>Health Equity Heatmap</h4>
                <p><strong>Data Coverage:</strong> 28 health measures across all 50 states + DC</p>
                <p><strong>Total Locations:</strong> 3,142 counties</p>
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
                    <strong>Instructions:</strong> Select a health measure from the dropdown above to view data on the map. Use the toggle switch to switch between county-level and state-level views.
                </p>
            `;
        }
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
                console.log('Zoom level too low for county markers, not rendering');
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

    async loadSDOHMeasureData() {
        if (!this.currentMeasure) return;
        
        this.showLoading(true);
        
        try {
            console.log('Loading SDOH data for measure:', this.currentMeasure);
            
            // For now, SDOH data only supports county view (no state aggregation)
            const apiEndpoint = `/api/sdoh-measure-data/${encodeURIComponent(this.currentMeasure)}`;
            
            const response = await fetch(apiEndpoint);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            this.currentData = await response.json();
            
            console.log('Received SDOH data:', this.currentData.length, 'records');
            
            if (this.currentData.length === 0) {
                this.showError('No SDOH data available for the selected measure.');
                return;
            }
            
            // Check if we should render markers based on view mode and zoom level
            const currentZoom = this.map.getZoom();
            const shouldShowMarkers = this.isStateView || currentZoom >= this.minZoomForMarkers;
            console.log('Current zoom level:', currentZoom, 'State view:', this.isStateView, 'Should show markers:', shouldShowMarkers);
            
            if (shouldShowMarkers) {
                console.log('Rendering SDOH markers...');
                this.renderMap();
            } else {
                console.log('Zoom level too low for county markers, not rendering');
                this.markersVisible = false;
            }
            
            this.updateStatsPanel();
            this.updateLegendContent();
            
            console.log('Loaded SDOH data for measure:', this.currentMeasure, 'Records:', this.currentData.length);
            
        } catch (error) {
            console.error('Error loading SDOH measure data:', error);
            this.showError('Failed to load SDOH data for the selected measure.');
        } finally {
            this.showLoading(false);
        }
    }

    findMatchingData(healthData, sdohData, location) {
        // Find matching SDOH data for a health location
        const matchingSDOH = sdohData.find(sdoh => 
            sdoh.LocationName === location.LocationName && 
            sdoh.StateDesc === location.StateDesc
        );
        
        return matchingSDOH || null;
    }
    
    findMatchingHealthData(healthData, sdohData, location) {
        // Find matching health data for an SDOH location
        const matchingHealth = healthData.find(health => 
            health.LocationName === location.LocationName && 
            health.StateDesc === location.StateDesc
        );
        
        return matchingHealth || null;
    }

    async loadOverlayData() {
        if (!this.currentHealthMeasure || !this.currentSDOHMeasure) {
            this.showError('Please select both a health measure and an SDOH measure for overlay mode.');
            return;
        }
        
        this.showLoading(true);
        
        try {
            console.log('Loading overlay data for health measure:', this.currentHealthMeasure, 'and SDOH measure:', this.currentSDOHMeasure);
            
            // Load both health and SDOH data simultaneously
            const [healthResponse, sdohResponse] = await Promise.all([
                fetch(this.isStateView ? 
                    `/api/state-measure-data/${encodeURIComponent(this.currentHealthMeasure)}` :
                    `/api/measure-data/${encodeURIComponent(this.currentHealthMeasure)}`),
                fetch(`/api/sdoh-measure-data/${encodeURIComponent(this.currentSDOHMeasure)}`)
            ]);
            
            if (!healthResponse.ok) {
                throw new Error(`HTTP error loading health data! status: ${healthResponse.status}`);
            }
            if (!sdohResponse.ok) {
                throw new Error(`HTTP error loading SDOH data! status: ${sdohResponse.status}`);
            }
            
            this.overlayHealthData = await healthResponse.json();
            this.overlaySDOHData = await sdohResponse.json();
            
            console.log('Loaded health data for overlay:', this.overlayHealthData.length, 'records');
            console.log('Loaded SDOH data for overlay:', this.overlaySDOHData.length, 'records');
            console.log('Sample health data:', this.overlayHealthData.slice(0, 2));
            console.log('Sample SDOH data:', this.overlaySDOHData.slice(0, 2));
            
            // Create combined dataset for rendering (use health data as primary)
            this.currentData = this.overlayHealthData;
            this.currentMeasure = this.currentHealthMeasure; // Set current measure for rendering
            
            if (this.currentData.length === 0) {
                this.showError('No data available for the selected measures in overlay mode.');
                return;
            }
            
            // Check if we should render markers based on view mode and zoom level
            const currentZoom = this.map.getZoom();
            const shouldShowMarkers = this.isStateView || currentZoom >= this.minZoomForMarkers;
            
            if (shouldShowMarkers) {
                console.log('Rendering overlay markers...');
                this.renderMap();
            } else {
                console.log('Zoom level too low for county markers, not rendering');
                this.markersVisible = false;
            }
            
            this.updateStatsPanel();
            this.updateLegendContent();
            
        } catch (error) {
            console.error('Error loading overlay data:', error);
            this.showError('Failed to load overlay data for the selected measures.');
        } finally {
            this.showLoading(false);
        }
    }
    
    handleZoomChange() {
        const currentZoom = this.map.getZoom();
        
        // State view is always visible, county view respects zoom level
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
            // County view - check zoom level
        const currentZoom = this.map.getZoom();
        if (currentZoom < this.minZoomForMarkers) {
                console.log('Zoom level too low for county markers');
            this.markersVisible = false;
                this.showZoomMessage();
            return;
            }
            console.log('Rendering county markers');
            this.renderCountyMarkers();
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
    
    renderCountyMarkers() {
        console.log('Rendering county-level markers');
        
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
        
        console.log('Created', markersCreated, 'county markers');
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
        
        if (this.showOverlay) {
            // Overlay mode: aggregate both health and SDOH data
            this.currentData.forEach(location => {
                const state = location.StateDesc;
                if (!stateGroups[state]) {
                    stateGroups[state] = {
                        locations: [],
                        totalPopulation: 0,
                        healthValues: [],
                        sdohValues: []
                    };
                }
                
                stateGroups[state].locations.push(location);
                stateGroups[state].totalPopulation += location.TotalPopulation || 0;
                stateGroups[state].healthValues.push(location.Data_Value);
                
                // Find matching SDOH data
                const matchingSDOH = this.findMatchingData(this.overlayHealthData, this.overlaySDOHData, location);
                if (matchingSDOH && matchingSDOH.Data_Value !== null && matchingSDOH.Data_Value !== undefined) {
                    stateGroups[state].sdohValues.push(matchingSDOH.Data_Value);
                }
            });
        } else {
            // Regular mode: aggregate single dataset
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
        }
        
        // Calculate aggregated values for each state
        const stateData = [];
        
        Object.keys(stateGroups).forEach(stateName => {
            const group = stateGroups[stateName];
            
            if (this.showOverlay) {
                // Overlay mode: calculate both health and SDOH averages
                const validHealthValues = group.healthValues.filter(v => !isNaN(v));
                const validSdohValues = group.sdohValues.filter(v => !isNaN(v));
                
                if (validHealthValues.length === 0) return;
                
                // Calculate weighted averages for both datasets
                let healthAvgValue, sdohAvgValue;
                
                if (group.totalPopulation > 0) {
                    // Health data weighted average
                    let healthWeightedSum = 0;
                    let healthTotalWeight = 0;
                    
                    group.locations.forEach((location, index) => {
                        if (!isNaN(location.Data_Value)) {
                            const weight = location.TotalPopulation || 1;
                            healthWeightedSum += location.Data_Value * weight;
                            healthTotalWeight += weight;
                        }
                    });
                    
                    healthAvgValue = healthTotalWeight > 0 ? healthWeightedSum / healthTotalWeight : validHealthValues.reduce((a, b) => a + b, 0) / validHealthValues.length;
                    
                    // SDOH data weighted average
                    if (validSdohValues.length > 0) {
                        let sdohWeightedSum = 0;
                        let sdohTotalWeight = 0;
                        
                        group.locations.forEach((location, index) => {
                            if (index < group.sdohValues.length && !isNaN(group.sdohValues[index])) {
                                const weight = location.TotalPopulation || 1;
                                sdohWeightedSum += group.sdohValues[index] * weight;
                                sdohTotalWeight += weight;
                            }
                        });
                        
                        sdohAvgValue = sdohTotalWeight > 0 ? sdohWeightedSum / sdohTotalWeight : validSdohValues.reduce((a, b) => a + b, 0) / validSdohValues.length;
                    } else {
                        sdohAvgValue = null;
                    }
                } else {
                    // Simple averages
                    healthAvgValue = validHealthValues.reduce((a, b) => a + b, 0) / validHealthValues.length;
                    sdohAvgValue = validSdohValues.length > 0 ? validSdohValues.reduce((a, b) => a + b, 0) / validSdohValues.length : null;
                }
                
                // Calculate state center coordinates
                const avgLat = group.locations.reduce((sum, loc) => sum + loc.lat, 0) / group.locations.length;
                const avgLng = group.locations.reduce((sum, loc) => sum + loc.lng, 0) / group.locations.length;
                
                stateData.push({
                    stateName: stateName,
                    avgValue: healthAvgValue, // Use health as primary for compatibility
                    sdohAvgValue: sdohAvgValue,
                    totalPopulation: group.totalPopulation,
                    locationCount: group.locations.length,
                    lat: avgLat,
                    lng: avgLng,
                    minValue: Math.min(...validHealthValues),
                    maxValue: Math.max(...validHealthValues),
                    isOverlay: true
                });
            } else {
                // Regular mode: calculate single dataset average
                const validValues = group.values.filter(v => !isNaN(v));
                
                if (validValues.length === 0) return;
                
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
                
                // Calculate state center coordinates
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
                    maxValue: Math.max(...validValues),
                    isOverlay: false
                });
            }
        });
        
        return stateData;
    }
    
    createStateMarker(state, quartiles, measureName) {
        const value = state.avgValue;
        const radius = this.getStateMarkerRadius(state.totalPopulation);
        
        let marker;
        
        if (this.showOverlay && state.isOverlay && state.sdohAvgValue !== null) {
            // Overlay mode: create split state marker
            const healthValues = this.overlayHealthData.map(d => d.Data_Value).filter(v => !isNaN(v));
            const sdohValues = this.overlaySDOHData.map(d => d.Data_Value).filter(v => !isNaN(v));
            
            const healthQuartiles = this.calculateQuartiles(healthValues);
            const sdohQuartiles = this.calculateQuartiles(sdohValues);
            
            marker = this.createSplitMarker(state, healthQuartiles, sdohQuartiles, value, state.sdohAvgValue, radius);
        } else {
            // Regular mode: create normal state marker
            const color = this.getDataColor(value, quartiles, measureName, state);
            marker = L.circleMarker([state.lat, state.lng], {
                radius: radius,
                fillColor: color,
                color: 'white',
                weight: 3,
                opacity: 1,
                fillOpacity: 0.8
            });
        }
        
        // Create popup content for state
        const valueClassification = this.getValueClassification(value, quartiles);
        
        let popupContent;
        
        if (this.showOverlay && state.isOverlay && state.sdohAvgValue !== null) {
            // Overlay mode: show both health and SDOH data
            const sdohValues = this.overlaySDOHData.map(d => d.Data_Value).filter(v => !isNaN(v));
            const sdohQuartiles = this.calculateQuartiles(sdohValues);
            const sdohClassification = this.getValueClassification(state.sdohAvgValue, sdohQuartiles);
            
            popupContent = `
                <div style="min-width: 200px;">
                    <h4>${state.stateName}</h4>
                    <div style="display: flex; align-items: center; margin-bottom: 0.5rem;">
                        <div style="width: 20px; height: 20px; border-radius: 50%; position: relative; border: 2px solid white; margin-right: 10px; overflow: hidden;">
                            <div style="position: absolute; left: 0; top: 0; width: 50%; height: 100%; background-color: ${this.calculateHealthColor(value, quartiles)};"></div>
                            <div style="position: absolute; right: 0; top: 0; width: 50%; height: 100%; background-color: ${this.calculateSDOHColor(state.sdohAvgValue, sdohQuartiles)};"></div>
                        </div>
                        <span style="font-size: 0.9rem; color: #666;">Split marker: Health (left) | SDOH (right)</span>
                    </div>
                    <p><strong>Health Average:</strong> ${value.toFixed(1)}% <span style="color: ${this.getClassificationColor(valueClassification)}; font-weight: bold;">(${valueClassification})</span></p>
                    <p><strong>SDOH Average:</strong> ${state.sdohAvgValue.toFixed(1)}% <span style="color: ${this.getClassificationColor(sdohClassification)}; font-weight: bold;">(${sdohClassification})</span></p>
                    <p><strong>Total Population:</strong> ${state.totalPopulation.toLocaleString()}</p>
                    <p><strong>Locations:</strong> ${state.locationCount}</p>
                    <p><strong>Health Range:</strong> ${state.minValue.toFixed(1)}% - ${state.maxValue.toFixed(1)}%</p>
                    <hr style="margin: 0.5rem 0;">
                    <p style="font-size: 0.8rem; color: #666; margin: 0;">
                        <em>State-level aggregation (overlay)</em>
                    </p>
                </div>
            `;
        } else {
            // Regular mode: show single dataset
            popupContent = `
                <div style="min-width: 200px;">
                    <h4>${state.stateName}</h4>
                    <p><strong>Average Value:</strong> ${value.toFixed(1)}% <span style="color: ${this.getClassificationColor(valueClassification)}; font-weight: bold;">(${valueClassification})</span></p>
                    <p><strong>Total Population:</strong> ${state.totalPopulation.toLocaleString()}</p>
                    <p><strong>Locations:</strong> ${state.locationCount}</p>
                    <p><strong>Range:</strong> ${state.minValue.toFixed(1)}% - ${state.maxValue.toFixed(1)}%</p>
                    <hr style="margin: 0.5rem 0;">
                    <p style="font-size: 0.8rem; color: #666; margin: 0;">
                        <em>State-level aggregation</em>
                    </p>
                </div>
            `;
        }
        
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
        
        let marker;
        
        if (this.showOverlay) {
            // Overlay mode: use population-based radius for size, split colors for data values
            const radius = this.getMarkerRadius(location.TotalPopulation || 15);
            
            const matchingSDOH = this.findMatchingData(this.overlayHealthData, this.overlaySDOHData, location);
            
            if (matchingSDOH && matchingSDOH.Data_Value !== null && matchingSDOH.Data_Value !== undefined) {
                // Calculate quartiles for both datasets
                const healthValues = this.overlayHealthData.map(d => d.Data_Value).filter(v => !isNaN(v));
                const sdohValues = this.overlaySDOHData.map(d => d.Data_Value).filter(v => !isNaN(v));
                
                const healthQuartiles = this.calculateQuartiles(healthValues);
                const sdohQuartiles = this.calculateQuartiles(sdohValues);
                
                marker = this.createSplitMarker(location, healthQuartiles, sdohQuartiles, value, matchingSDOH.Data_Value, radius);
            } else {
                // Fallback to regular marker if no SDOH data
                const color = this.getDataColor(value, quartiles, measureName, location);
                marker = L.circleMarker([location.lat, location.lng], {
                    radius: radius,
                    fillColor: color,
                    color: 'white',
                    weight: 2,
                    opacity: 1,
                    fillOpacity: 0.8,
                    className: 'health-marker'
                });
            }
        } else {
            // Regular mode: use population-based radius
            const radius = this.getMarkerRadius(location.TotalPopulation || 15);
            const color = this.getDataColor(value, quartiles, measureName, location);
            marker = L.circleMarker([location.lat, location.lng], {
                radius: radius,
                fillColor: color,
                color: 'white',
                weight: 2,
                opacity: 1,
                fillOpacity: 0.8,
                className: 'health-marker'
            });
        }
        
        // Create popup content
        let valueDisplay = `${value.toFixed(1)}${location.Data_Value_Unit || ''}`;
        
        // Add confidence interval as plus-minus if available
        if (location.Low_Confidence_Limit && location.High_Confidence_Limit) {
            const margin = ((location.High_Confidence_Limit - location.Low_Confidence_Limit) / 2).toFixed(1);
            valueDisplay += ` ± ${margin}`;
        }
        
        let popupContent;
        const valueClassification = this.getValueClassification(location.Data_Value, quartiles);
        
        if (this.showOverlay) {
            // Overlay mode: show both health and SDOH data
            const matchingSDOH = this.findMatchingData(this.overlayHealthData, this.overlaySDOHData, location);
            
            // Calculate SDOH quartiles for proper color calculation
            const sdohValues = this.overlaySDOHData.map(d => d.Data_Value).filter(v => !isNaN(v));
            const sdohQuartiles = this.calculateQuartiles(sdohValues);
            
            const sdohClassification = matchingSDOH ? this.getValueClassification(matchingSDOH.Data_Value, sdohQuartiles) : 'Unknown';
            
            popupContent = `
                <div class="popup-content">
                    <h4>${location.LocationName || 'Unknown Location'}</h4>
                    <p><strong>State:</strong> ${location.StateDesc || 'N/A'}</p>
                    <hr style="margin: 0.5rem 0;">
                    <div style="display: flex; align-items: center; margin-bottom: 0.5rem;">
                        <div style="width: 20px; height: 20px; border-radius: 50%; position: relative; border: 2px solid white; margin-right: 10px; overflow: hidden;">
                            <div style="position: absolute; left: 0; top: 0; width: 50%; height: 100%; background-color: ${this.calculateHealthColor(value, quartiles)};"></div>
                            <div style="position: absolute; right: 0; top: 0; width: 50%; height: 100%; background-color: ${matchingSDOH ? this.calculateSDOHColor(matchingSDOH.Data_Value, sdohQuartiles) : '#ccc'};"></div>
                        </div>
                        <span style="font-size: 0.9rem; color: #666;">Split marker: Health (left) | SDOH (right)</span>
                    </div>
                    <h5>Health Data (${this.currentHealthMeasure}):</h5>
                    <p><strong>Value:</strong> ${valueDisplay} <span style="color: ${this.getClassificationColor(valueClassification)}; font-weight: bold;">(${valueClassification})</span></p>
                    ${matchingSDOH ? `
                        <hr style="margin: 0.5rem 0;">
                        <h5>SDOH Data (${this.currentSDOHMeasure}):</h5>
                        <p><strong>Value:</strong> ${matchingSDOH.Data_Value ? matchingSDOH.Data_Value.toFixed(1) + (matchingSDOH.Data_Value_Unit || '') : 'N/A'} <span style="color: ${this.getClassificationColor(sdohClassification)}; font-weight: bold;">(${sdohClassification})</span></p>
                    ` : `
                        <p style="color: #666; font-style: italic;">No matching SDOH data available</p>
                    `}
                    <hr style="margin: 0.5rem 0;">
                    <p><strong>Population:</strong> ${location.TotalPopulation ? location.TotalPopulation.toLocaleString() : 'N/A'}</p>
                </div>
            `;
        } else {
            // Regular mode: show single data value
            popupContent = `
                <div class="popup-content">
                    <h4>${location.LocationName || 'Unknown Location'}</h4>
                    <p><strong>State:</strong> ${location.StateDesc || 'N/A'}</p>
                    <p><strong>Value:</strong> ${valueDisplay} <span style="color: ${this.getClassificationColor(valueClassification)}; font-weight: bold;">(${valueClassification})</span></p>
                    <p><strong>Population:</strong> ${location.TotalPopulation ? location.TotalPopulation.toLocaleString() : 'N/A'}</p>
                </div>
            `;
        }
        
        marker.bindPopup(popupContent);
        
        // Add click handler
        marker.on('click', () => this.updateCountyStatsPanel(location, measureName, quartiles));
        
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
    

    getValueClassification(value, quartiles) {
        if (value === null || value === undefined || isNaN(value)) return 'Unknown';
        
        if (value >= quartiles.q3) return 'High';
        if (value >= quartiles.q2) return 'Medium-High';
        if (value >= quartiles.q1) return 'Medium-Low';
        return 'Low';
    }

    getClassificationColor(classification) {
        switch(classification) {
            case 'High': return '#dc3545'; // Red
            case 'Medium-High': return '#fd7e14'; // Orange
            case 'Medium-Low': return '#ffc107'; // Yellow
            case 'Low': return '#28a745'; // Green
            default: return '#6c757d'; // Gray
        }
    }

    createSplitMarker(location, healthQuartiles, sdohQuartiles, healthValue, sdohValue, radius) {
        // Calculate colors for each half
        const healthColor = this.calculateHealthColor(healthValue, healthQuartiles);
        const sdohColor = this.calculateSDOHColor(sdohValue, sdohQuartiles);
        
        // Create HTML for split circle using CSS
        const html = `
            <div style="
                width: ${radius * 2}px; 
                height: ${radius * 2}px; 
                border-radius: 50%; 
                position: relative;
                border: 2px solid white;
                overflow: hidden;
            ">
                <div style="
                    position: absolute;
                    left: 0;
                    top: 0;
                    width: 50%;
                    height: 100%;
                    background-color: ${healthColor};
                "></div>
                <div style="
                    position: absolute;
                    right: 0;
                    top: 0;
                    width: 50%;
                    height: 100%;
                    background-color: ${sdohColor};
                "></div>
            </div>
        `;
        
        // Create custom icon
        const icon = L.divIcon({
            html: html,
            className: 'split-marker',
            iconSize: [radius * 2, radius * 2],
            iconAnchor: [radius, radius]
        });
        
        return L.marker([location.lat, location.lng], { icon: icon });
    }

    getDataColor(value, quartiles, measureName = null, location = null) {
        if (value === null || value === undefined || isNaN(value)) return '#95a5a6';

        const q1 = quartiles.q1;
        const q3 = quartiles.q3;
        const iqr = q3 - q1;

        // Calculate outlier bounds using 1.5 IQR rule
        const lowerBound = q1 - 1.5 * iqr;
        const upperBound = q3 + 1.5 * iqr;

        // Clamp value to outlier bounds
        const clampedValue = Math.max(lowerBound, Math.min(upperBound, value));

        // Normalize clamped value to 0-1 range within the outlier bounds
        const normalized = (clampedValue - lowerBound) / (upperBound - lowerBound);

        // Use different color schemes based on data type
        if (this.showOverlay) {
            // Overlay mode: blend health and SDOH colors
            return this.getOverlayBlendedColor(value, quartiles, location);
        } else if (this.showSDOH) {
            // SDOH data: white (low) to blue (high)
            return this.getGradientColor(normalized, '#ffffff', '#0066cc');
        } else {
            // Health data: white (low) to dark red (high)
            return this.getGradientColor(normalized, '#ffffff', '#8B0000');
        }
    }
    
    getOverlayBlendedColor(value, quartiles, location = null) {
        try {
            // For overlay mode, we need to find the matching SDOH data for this location
            // and calculate colors for both health and SDOH values, then blend them
            
            if (!location) {
                console.warn('No location provided for overlay color calculation');
                return '#95a5a6';
            }
            
            // Check if overlay data is available
            if (!this.overlayHealthData || !this.overlaySDOHData) {
                console.warn('Overlay data not available for color calculation');
                return '#95a5a6';
            }
            
            // Find matching SDOH data for this location
            const matchingSDOH = this.findMatchingData(this.overlayHealthData, this.overlaySDOHData, location);
            
            if (!matchingSDOH) {
                console.warn('No matching SDOH data found for location:', location.LocationName);
                return '#95a5a6';
            }
            
            // Calculate quartiles for both datasets
            const healthValues = this.overlayHealthData.map(d => d.Data_Value).filter(v => !isNaN(v));
            const sdohValues = this.overlaySDOHData.map(d => d.Data_Value).filter(v => !isNaN(v));
            
            if (healthValues.length === 0 || sdohValues.length === 0) {
                console.warn('No valid values found in overlay data');
                return '#95a5a6';
            }
            
            const healthQuartiles = this.calculateQuartiles(healthValues);
            const sdohQuartiles = this.calculateQuartiles(sdohValues);
            
            // Calculate individual colors using the same logic as individual modes
            const healthColor = this.calculateHealthColor(value, healthQuartiles);
            const sdohColor = this.calculateSDOHColor(matchingSDOH.Data_Value, sdohQuartiles);
            
            // Blend the colors (average RGB values)
            return this.blendColors(healthColor, sdohColor);
        } catch (error) {
            console.error('Error in getOverlayBlendedColor:', error);
            return '#95a5a6';
        }
    }
    
    calculateHealthColor(value, quartiles) {
        const q1 = quartiles.q1;
        const q3 = quartiles.q3;
        const iqr = q3 - q1;
        
        // Calculate outlier bounds using 1.5 IQR rule
        const lowerBound = q1 - 1.5 * iqr;
        const upperBound = q3 + 1.5 * iqr;
        
        // Clamp value to outlier bounds
        const clampedValue = Math.max(lowerBound, Math.min(upperBound, value));
        
        // Normalize clamped value to 0-1 range within the outlier bounds
        const normalized = (clampedValue - lowerBound) / (upperBound - lowerBound);
        
        // Health data: white (low) to dark red (high)
        return this.getGradientColor(normalized, '#ffffff', '#8B0000');
    }
    
    calculateSDOHColor(value, quartiles) {
        const q1 = quartiles.q1;
        const q3 = quartiles.q3;
        const iqr = q3 - q1;
        
        // Calculate outlier bounds using 1.5 IQR rule
        const lowerBound = q1 - 1.5 * iqr;
        const upperBound = q3 + 1.5 * iqr;
        
        // Clamp value to outlier bounds
        const clampedValue = Math.max(lowerBound, Math.min(upperBound, value));
        
        // Normalize clamped value to 0-1 range within the outlier bounds
        const normalized = (clampedValue - lowerBound) / (upperBound - lowerBound);
        
        // SDOH data: white (low) to blue (high)
        return this.getGradientColor(normalized, '#ffffff', '#0066cc');
    }
    
    
    normalizeValue(value, quartiles) {
        const q1 = quartiles.q1;
        const q3 = quartiles.q3;
        const iqr = q3 - q1;
        
        // Calculate outlier bounds using 1.5 IQR rule
        const lowerBound = q1 - 1.5 * iqr;
        const upperBound = q3 + 1.5 * iqr;
        
        // Clamp value to outlier bounds
        const clampedValue = Math.max(lowerBound, Math.min(upperBound, value));
        
        // Normalize clamped value to 0-1 range within the outlier bounds
        return (clampedValue - lowerBound) / (upperBound - lowerBound);
    }
    
    blendColors(color1, color2) {
        // Parse both colors
        const rgb1 = this.hexToRgb(color1);
        const rgb2 = this.hexToRgb(color2);
        
        // Average the RGB values
        const r = Math.round((rgb1.r + rgb2.r) / 2);
        const g = Math.round((rgb1.g + rgb2.g) / 2);
        const b = Math.round((rgb1.b + rgb2.b) / 2);
        
        return `rgb(${r}, ${g}, ${b})`;
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
        
        // Format value with confidence interval as plus-minus if available
        let valueDisplay = `${value.toFixed(1)}${location.Data_Value_Unit || ''}`;
        if (location.Low_Confidence_Limit && location.High_Confidence_Limit) {
            const margin = ((location.High_Confidence_Limit - location.Low_Confidence_Limit) / 2).toFixed(1);
            valueDisplay += ` ± ${margin}`;
        }
        
        statsContent.innerHTML = `
            <h4>${location.LocationName || 'Unknown Location'}</h4>
            <p><strong>State:</strong> ${location.StateDesc || 'N/A'}</p>
            <p><strong>Value:</strong> ${valueDisplay}</p>
            <p><strong>Population:</strong> ${location.TotalPopulation ? location.TotalPopulation.toLocaleString() : 'N/A'}</p>
            <p><strong>Coordinates:</strong> ${location.lat ? location.lat.toFixed(4) : 'N/A'}, ${location.lng ? location.lng.toFixed(4) : 'N/A'}</p>
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
        const totalPopulation = this.currentData.reduce((sum, d) => sum + (d.TotalPopulation || 0), 0);
        
        // Calculate quartiles
        const quartiles = this.calculateQuartiles(values);
        
        // Calculate outlier-adjusted range using 1.5 IQR rule
        const q1 = quartiles.q1;
        const q3 = quartiles.q3;
        const iqr = q3 - q1;
        const lowerBound = q1 - 1.5 * iqr;
        const upperBound = q3 + 1.5 * iqr;
        
        // Use outlier-adjusted bounds for display
        const minValue = lowerBound;
        const maxValue = upperBound;
        
        // Determine if this is a positive or negative measure
        
        statsContent.innerHTML = `
            <h4>Summary Statistics</h4>
            <p><strong>Selected Measure:</strong> ${this.currentMeasure.length > 60 ? this.currentMeasure.substring(0, 60) + '...' : this.currentMeasure}</p>
            <p><strong>Total Locations:</strong> ${this.currentData.length}</p>
            <p><strong>Average Value:</strong> ${avgValue.toFixed(1)}</p>
            <p><strong>Range:</strong> ${minValue.toFixed(1)} - ${maxValue.toFixed(1)}</p>
            <p><strong>Total Population:</strong> ${totalPopulation.toLocaleString()}</p>
            
            
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
            <div style="color: #8B0000; background: #fdf2f2; padding: 1rem; border-radius: 4px; border-left: 4px solid #8B0000;">
                <strong>Error:</strong> ${message}
            </div>
        `;
    }
    
    showZoomMessage() {
        // Only show zoom message for county view
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
            zoomBar.textContent = 'Zoom in to see county data points';
            
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
