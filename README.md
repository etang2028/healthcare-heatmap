# Health Equity Heatmap

A web application that visualizes health disparities across different geographic locations using interactive maps and data visualization.

## Overview

The Health Equity Heatmap aggregates and visualizes health data from multiple sources to help public health officials and hospital systems identify neighborhoods with the greatest health disparities and needs. The application combines patient data with public data on income, education, race, and ethnicity to create comprehensive health equity visualizations.

## Features

- **Interactive Map**: Visualize health data on an interactive map with color-coded markers
- **Health Score Calculation**: Composite health score based on multiple health indicators
- **Data Filtering**: Filter by specific health metrics (asthma, diabetes, blood pressure, etc.)
- **Detailed Statistics**: View individual health measure values and confidence intervals
- **Population-based Visualization**: Marker sizes reflect population density
- **Responsive Design**: Works on desktop and mobile devices

## Health Score Methodology

The Health Score is a composite measure (0-100%) that combines multiple health indicators:

### Positive Indicators (Higher values improve score):
- Cancer screening rates
- Routine checkup visits
- Dental visits
- Blood pressure control
- Cholesterol screening

### Negative Indicators (Higher values decrease score):
- Asthma prevalence
- Diabetes prevalence
- High blood pressure
- High cholesterol
- Smoking rates
- Binge drinking
- Obesity rates
- Coronary heart disease
- COPD
- Arthritis

## Technology Stack

- **Backend**: Python Flask
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Mapping**: Leaflet.js
- **Data Processing**: Pandas, NumPy
- **Data Sources**: CDC PLACES data, Social Determinants of Health (SDOH) data

## Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/healthcare-heatmap.git
   cd healthcare-heatmap
   ```

2. **Install Python dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Run the application**:
   ```bash
   python app.py
   ```

4. **Open your browser** to `http://localhost:5000`

## Data Sources

- **PLACES Data**: CDC's Local Data for Better Health, Place Data 2020
- **SDOH Data**: Social Determinants of Health 2020 ZIP Code data

## Project Structure

```
healthcare-heatmap/
├── data/                          # Data files (CSV, Excel)
├── static/                        # Frontend assets
│   ├── style.css                 # CSS styles
│   └── app.js                    # JavaScript application
├── templates/                     # HTML templates
│   └── index.html                # Main page template
├── app.py                        # Flask backend application
├── requirements.txt              # Python dependencies
├── test_setup.py                 # Setup verification script
└── README.md                     # This file
```

## Usage

1. **View the Map**: The main map shows health data as colored markers
2. **Filter Data**: Use the dropdown to filter by specific health metrics
3. **Click Markers**: Click on any marker to see detailed health statistics
4. **View Statistics**: The sidebar shows summary statistics and health score distribution

## Color Legend

- **Green (80%+)**: Excellent health outcomes
- **Orange (60-79%)**: Good health outcomes  
- **Dark Orange (40-59%)**: Fair health outcomes
- **Red (<40%)**: Poor health outcomes

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- CDC PLACES data for health indicators
- Leaflet.js for interactive mapping
- Flask community for web framework
