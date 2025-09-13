#!/usr/bin/env python3
"""
Data preprocessing script for Health Equity Heatmap
Creates smaller, cleaned CSV files for faster loading
"""

import pandas as pd
import numpy as np
import os
import re

def preprocess_places_data():
    """Preprocess PLACES data into smaller, cleaned files"""
    print("Loading PLACES data...")
    df = pd.read_csv('data/PLACES__Local_Data_for_Better_Health,_Place_Data_2020_release_20250913.csv')
    
    print(f"Original data shape: {df.shape}")
    
    # Clean the data
    print("Cleaning data...")
    df = df.dropna(subset=['Data_Value', 'Geolocation'])
    df['Data_Value'] = pd.to_numeric(df['Data_Value'], errors='coerce')
    df = df.dropna(subset=['Data_Value'])
    
    # Extract coordinates
    df['lat'] = df['Geolocation'].str.extract(r'POINT \(([^ ]+) ([^)]+)\)')[1].astype(float)
    df['lng'] = df['Geolocation'].str.extract(r'POINT \(([^ ]+) ([^)]+)\)')[0].astype(float)
    df = df.dropna(subset=['lat', 'lng'])
    
    # Clean measure names - keep original but create shorter versions for display
    df['Measure_Clean'] = df['Measure'].str.strip()
    df['Measure_Short'] = df['Measure'].apply(create_short_measure_name)
    
    print(f"Cleaned data shape: {df.shape}")
    
    # Create location summary
    locations = df.groupby(['LocationName', 'lat', 'lng', 'StateDesc', 'TotalPopulation']).size().reset_index(name='measure_count')
    
    # Save locations summary
    locations.to_csv('data/locations_summary.csv', index=False)
    print(f"Saved {len(locations)} locations to locations_summary.csv")
    
    # Create measures list with both full and short names
    measures_df = df[['Measure_Clean', 'Measure_Short']].drop_duplicates().reset_index(drop=True)
    measures_df.to_csv('data/available_measures.csv', index=False)
    print(f"Saved {len(measures_df)} measures to available_measures.csv")
    
    # Create individual measure files for faster loading
    print("Creating individual measure files...")
    os.makedirs('data/measures', exist_ok=True)
    
    for measure in df['Measure_Clean'].unique():
        measure_data = df[df['Measure_Clean'] == measure][
            ['LocationName', 'lat', 'lng', 'StateDesc', 'TotalPopulation', 
             'Data_Value', 'Data_Value_Unit', 'Data_Value_Type',
             'Low_Confidence_Limit', 'High_Confidence_Limit', 'Measure_Short']
        ].copy()
        
        # Create safe filename
        safe_filename = create_safe_filename(measure)
        measure_data.to_csv(f'data/measures/{safe_filename}', index=False)
        print(f"Saved {len(measure_data)} records for: {measure[:50]}...")
    
    return len(measures_df), len(locations)

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

def create_safe_filename(measure):
    """Create a safe filename from measure name"""
    # Remove special characters and replace spaces with underscores
    safe_name = re.sub(r'[^\w\s-]', '', measure)
    safe_name = re.sub(r'[-\s]+', '_', safe_name)
    return safe_name[:50] + '.csv'

def preprocess_sdoh_data():
    """Preprocess SDOH data"""
    print("Loading SDOH data...")
    try:
        df = pd.read_excel('data/SDOH_2020_ZIPCODE_1_0.xlsx')
        print(f"SDOH data shape: {df.shape}")
        
        # Basic cleaning
        df = df.dropna()
        df.to_csv('data/sdoh_cleaned.csv', index=False)
        print(f"Saved {len(df)} SDOH records")
        return len(df)
    except Exception as e:
        print(f"Error processing SDOH data: {e}")
        return 0

def main():
    """Main preprocessing function"""
    print("Starting data preprocessing...")
    
    # Create data directory
    os.makedirs('data', exist_ok=True)
    
    # Process PLACES data
    measure_count, location_count = preprocess_places_data()
    
    # Process SDOH data
    sdoh_count = preprocess_sdoh_data()
    
    print("\n" + "="*50)
    print("PREPROCESSING COMPLETE!")
    print("="*50)
    print(f"Locations processed: {location_count}")
    print(f"Measures processed: {measure_count}")
    print(f"SDOH records: {sdoh_count}")
    print("\nFiles created:")
    print("- data/locations_summary.csv")
    print("- data/available_measures.csv")
    print("- data/measures/*.csv (individual measure files)")
    print("- data/sdoh_cleaned.csv")
    print("\nYou can now use these smaller files for faster loading!")

if __name__ == "__main__":
    main()
