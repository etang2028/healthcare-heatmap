from flask import Flask, render_template, jsonify, request
import pandas as pd
import numpy as np
import json
import os
import glob

app = Flask(__name__)

# Global variables for caching
locations_data = None
measures_data = None

def load_locations_data():
    """Load preprocessed locations data"""
    global locations_data
    if locations_data is None:
        try:
            locations_data = pd.read_csv('data/locations_summary.csv')
            # Ensure TotalPopulation is numeric (handle comma-separated values)
            locations_data['TotalPopulation'] = locations_data['TotalPopulation'].astype(str).str.replace(',', '').astype(float)
            print(f"Loaded {len(locations_data)} locations from cache")
        except FileNotFoundError:
            print("Locations summary not found, creating from raw data...")
            create_locations_summary()
            locations_data = pd.read_csv('data/locations_summary.csv')
            # Ensure TotalPopulation is numeric (handle comma-separated values)
            locations_data['TotalPopulation'] = locations_data['TotalPopulation'].astype(str).str.replace(',', '').astype(float)
    return locations_data

def load_measures_data():
    """Load available measures"""
    global measures_data
    if measures_data is None:
        try:
            measures_data = pd.read_csv('data/available_measures.csv')
            print(f"Loaded {len(measures_data)} measures from cache")
        except FileNotFoundError:
            print("Measures data not found, creating from raw data...")
            create_measures_list()
            measures_data = pd.read_csv('data/available_measures.csv')
    return measures_data

def create_locations_summary():
    """Create locations summary from raw data (one-time setup)"""
    print("Creating locations summary from raw data...")
    
    # Load the full dataset
    df = pd.read_csv('data/PLACES__Local_Data_for_Better_Health,_Place_Data_2020_release_20250913.csv')
    
    # Clean data
    df = df.dropna(subset=['Data_Value', 'Geolocation'])
    df['Data_Value'] = pd.to_numeric(df['Data_Value'], errors='coerce')
    df = df.dropna(subset=['Data_Value'])
    
    # Extract coordinates
    df['lat'] = df['Geolocation'].str.extract(r'POINT \(([^ ]+) ([^)]+)\)')[1].astype(float)
    df['lng'] = df['Geolocation'].str.extract(r'POINT \(([^ ]+) ([^)]+)\)')[0].astype(float)
    df = df.dropna(subset=['lat', 'lng'])
    
    # Create locations summary
    locations = df.groupby(['LocationName', 'lat', 'lng', 'StateDesc', 'TotalPopulation']).size().reset_index(name='measure_count')
    
    # Save to file
    os.makedirs('data', exist_ok=True)
    locations.to_csv('data/locations_summary.csv', index=False)
    print(f"Created locations summary with {len(locations)} locations")

def create_measures_list():
    """Create measures list from raw data (one-time setup)"""
    print("Creating measures list from raw data...")
    
    # Load the full dataset to get all measures
    df = pd.read_csv('data/PLACES__Local_Data_for_Better_Health,_Place_Data_2020_release_20250913.csv')
    
    # Get unique measures and create short names
    measures = df['Measure'].unique()
    measures_data = []
    
    for measure in measures:
        short_name = create_short_measure_name(measure)
        measures_data.append({
            'Measure_Clean': measure,
            'Measure_Short': short_name
        })
    
    measures_df = pd.DataFrame(measures_data)
    
    # Save to file
    os.makedirs('data', exist_ok=True)
    measures_df.to_csv('data/available_measures.csv', index=False)
    print(f"Created measures list with {len(measures_df)} measures")

def create_short_measure_name(measure):
    """Create a shorter, more readable measure name"""
    # Extract key terms from the measure name
    key_terms = []
    
    # Common health conditions
    conditions = ['asthma', 'diabetes', 'cancer', 'heart disease', 'high blood pressure', 
                 'high cholesterol', 'obesity', 'smoking', 'drinking', 'arthritis', 'copd']
    
    # Common actions
    actions = ['screening', 'checkup', 'visit', 'control', 'medication', 'vaccination']
    
    measure_lower = measure.lower()
    
    # Find conditions
    for condition in conditions:
        if condition in measure_lower:
            key_terms.append(condition.title())
    
    # Find actions
    for action in actions:
        if action in measure_lower:
            key_terms.append(action.title())
    
    # If no key terms found, use first few words
    if not key_terms:
        words = measure.split()[:4]
        key_terms = [word.title() for word in words if len(word) > 2]
    
    return ' - '.join(key_terms[:3]) if key_terms else measure[:50]

@app.route('/')
def index():
    """Serve the main page"""
    return render_template('index.html')

@app.route('/api/locations')
def get_locations():
    """API endpoint to get locations data"""
    try:
        locations_df = load_locations_data()
        result = locations_df.to_dict('records')
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/measures')
def get_measures():
    """API endpoint to get available measures"""
    try:
        measures_df = load_measures_data()
        result = measures_df.to_dict('records')
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/measure-data/<measure_name>')
def get_measure_data(measure_name):
    """API endpoint to get data for a specific measure"""
    try:
        # Check if we have a preprocessed file for this measure
        safe_filename = create_safe_filename(measure_name)
        measure_file = f'data/measures/{safe_filename}'
        
        if os.path.exists(measure_file):
            # Load from preprocessed file
            measure_data = pd.read_csv(measure_file)
            # Ensure TotalPopulation is numeric (handle comma-separated values)
            measure_data['TotalPopulation'] = measure_data['TotalPopulation'].astype(str).str.replace(',', '').astype(float)
            print(f"Loaded {len(measure_data)} records from preprocessed file: {measure_file}")
        else:
            # Load from raw data and filter for specific measure
            print(f"Loading from raw data for measure: {measure_name}")
            df = pd.read_csv('data/PLACES__Local_Data_for_Better_Health,_Place_Data_2020_release_20250913.csv')
            
            # Filter for the specific measure
            measure_data = df[df['Measure'] == measure_name].copy()
            
            if measure_data.empty:
                return jsonify({"error": "Measure not found"}), 404
            
            # Clean data
            measure_data = measure_data.dropna(subset=['Data_Value', 'Geolocation'])
            measure_data['Data_Value'] = pd.to_numeric(measure_data['Data_Value'], errors='coerce')
            measure_data = measure_data.dropna(subset=['Data_Value'])
            
            # Convert TotalPopulation to numeric, handling comma-separated values
            measure_data['TotalPopulation'] = measure_data['TotalPopulation'].astype(str).str.replace(',', '').astype(float)
            
            # Extract coordinates
            measure_data['lat'] = measure_data['Geolocation'].str.extract(r'POINT \(([^ ]+) ([^)]+)\)')[1].astype(float)
            measure_data['lng'] = measure_data['Geolocation'].str.extract(r'POINT \(([^ ]+) ([^)]+)\)')[0].astype(float)
            measure_data = measure_data.dropna(subset=['lat', 'lng'])
        
        # Prepare result
        result = measure_data[[
            'LocationName', 'lat', 'lng', 'StateDesc', 'TotalPopulation',
            'Data_Value', 'Data_Value_Unit', 'Data_Value_Type',
            'Low_Confidence_Limit', 'High_Confidence_Limit'
        ]].to_dict('records')
        
        print(f"Returning {len(result)} data points for measure: {measure_name}")
        return jsonify(result)
    except Exception as e:
        print(f"Error loading measure data: {e}")
        return jsonify({"error": str(e)}), 500

def create_safe_filename(measure):
    """Create a safe filename from measure name"""
    import re
    # Remove special characters and replace spaces with underscores
    safe_name = re.sub(r'[^\w\s-]', '', measure)
    safe_name = re.sub(r'[-\s]+', '_', safe_name)
    return safe_name[:50] + '.csv'

@app.route('/api/sdoh-data')
def get_sdoh_data():
    """API endpoint to get SDOH data"""
    try:
        # For now, return empty array since SDOH functionality is not fully implemented
        return jsonify([])
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    # Create templates directory if it doesn't exist
    os.makedirs('templates', exist_ok=True)
    os.makedirs('static', exist_ok=True)
    
    app.run(debug=True, host='0.0.0.0', port=5000)
