#!/usr/bin/env python3
"""
Data preprocessing script for Health Equity Heatmap
Creates smaller, cleaned CSV files for faster loading
Processes ALL locations and states from the PLACES dataset
"""

import pandas as pd
import numpy as np
import os
import re

def preprocess_places_data():
    """Preprocess PLACES data into smaller, cleaned files"""
    print("Loading PLACES data...")
    print("This may take a few minutes for the full dataset...")
    
    # Load the full dataset
    df = pd.read_csv('data/PLACES__Local_Data_for_Better_Health,_Place_Data_2020_release_20250913.csv')
    
    print(f"Original data shape: {df.shape}")
    print(f"Total states in dataset: {len(df['StateDesc'].unique())}")
    print(f"States: {sorted(df['StateDesc'].unique())}")
    
    # Clean the data - be more lenient with filtering
    print("\nCleaning data...")
    initial_count = len(df)
    
    # Only drop rows where both Data_Value and Geolocation are missing
    df = df.dropna(subset=['Data_Value', 'Geolocation'], how='all')
    print(f"After dropping rows with both Data_Value and Geolocation missing: {len(df)} (removed {initial_count - len(df)})")
    
    # Convert Data_Value to numeric, but keep rows that can't be converted
    df['Data_Value'] = pd.to_numeric(df['Data_Value'], errors='coerce')
    df = df.dropna(subset=['Data_Value'])
    print(f"After numeric conversion of Data_Value: {len(df)} (removed {initial_count - len(df) - (initial_count - len(df))})")
    
    # Extract coordinates with better error handling
    print("\nExtracting coordinates...")
    coord_pattern = r'POINT \(([^ ]+) ([^)]+)\)'
    
    # Extract coordinates
    coord_matches = df['Geolocation'].str.extract(coord_pattern)
    df['lat'] = coord_matches[1]
    df['lng'] = coord_matches[0]
    
    # Convert to numeric
    df['lat'] = pd.to_numeric(df['lat'], errors='coerce')
    df['lng'] = pd.to_numeric(df['lng'], errors='coerce')
    
    # Only drop rows where coordinates are invalid
    valid_coords = df.dropna(subset=['lat', 'lng'])
    print(f"After coordinate extraction: {len(valid_coords)} (removed {len(df) - len(valid_coords)})")
    
    # Check coordinate validity (should be within US bounds roughly)
    valid_coords = valid_coords[
        (valid_coords['lat'] >= 24) & (valid_coords['lat'] <= 72) &  # Latitude bounds for US
        (valid_coords['lng'] >= -180) & (valid_coords['lng'] <= -65)  # Longitude bounds for US
    ]
    print(f"After coordinate validation: {len(valid_coords)} (removed {len(df) - len(valid_coords)})")
    
    df = valid_coords
    
    print(f"Final cleaned data shape: {df.shape}")
    print(f"States after cleaning: {len(df['StateDesc'].unique())}")
    print(f"States: {sorted(df['StateDesc'].unique())}")
    
    # Clean measure names
    print("\nProcessing measure names...")
    df['Measure_Clean'] = df['Measure'].str.strip()
    
    # Use Short_Question_Text if available, otherwise create short names
    df['Measure_Short'] = df['Short_Question_Text'].fillna(df['Measure_Clean'].apply(create_short_measure_name))
    
    # Create location summary - include ALL locations
    print("\nCreating location summary...")
    
    # Convert TotalPopulation to numeric, handling comma-separated values
    print("Converting TotalPopulation to numeric...")
    df['TotalPopulation'] = df['TotalPopulation'].astype(str).str.replace(',', '').astype(float)
    
    locations = df.groupby(['LocationName', 'lat', 'lng', 'StateDesc', 'TotalPopulation']).size().reset_index(name='measure_count')
    
    # Save locations summary
    locations.to_csv('data/locations_summary.csv', index=False)
    print(f"Saved {len(locations)} locations to locations_summary.csv")
    
    # Show location counts by state
    print("\nLocation counts by state:")
    state_counts = locations['StateDesc'].value_counts()
    for state, count in state_counts.head(20).items():
        print(f"  {state}: {count} locations")
    
    if len(state_counts) > 20:
        print(f"  ... and {len(state_counts) - 20} more states")
    
    # Create measures list
    measures_df = df[['Measure_Clean', 'Measure_Short']].drop_duplicates().reset_index(drop=True)
    measures_df.to_csv('data/available_measures.csv', index=False)
    print(f"\nSaved {len(measures_df)} measures to available_measures.csv")
    
    # Show sample measures
    print("\nSample measures:")
    for i, row in measures_df.head(10).iterrows():
        print(f"  {row['Measure_Short']}")
    
    # Create individual measure files for faster loading
    print("\nCreating individual measure files...")
    os.makedirs('data/measures', exist_ok=True)
    
    measure_count = 0
    for measure in df['Measure_Clean'].unique():
        measure_data = df[df['Measure_Clean'] == measure][
            ['LocationName', 'lat', 'lng', 'StateDesc', 'TotalPopulation', 
             'Data_Value', 'Data_Value_Unit', 'Data_Value_Type',
             'Low_Confidence_Limit', 'High_Confidence_Limit', 'Measure_Short']
        ].copy()
        
        # Ensure TotalPopulation is numeric in measure files too
        measure_data['TotalPopulation'] = measure_data['TotalPopulation'].astype(str).str.replace(',', '').astype(float)
        
        # Create safe filename
        safe_filename = create_safe_filename(measure)
        measure_data.to_csv(f'data/measures/{safe_filename}', index=False)
        measure_count += 1
        
        if measure_count % 10 == 0:
            print(f"  Processed {measure_count} measures...")
    
    print(f"Created {measure_count} individual measure files")
    
    # Create state aggregate files
    print("\nCreating state aggregate files...")
    os.makedirs('data/state_measures', exist_ok=True)
    
    state_measure_count = 0
    for measure in df['Measure_Clean'].unique():
        measure_data = df[df['Measure_Clean'] == measure][
            ['LocationName', 'lat', 'lng', 'StateDesc', 'TotalPopulation', 
             'Data_Value', 'Data_Value_Unit', 'Data_Value_Type',
             'Low_Confidence_Limit', 'High_Confidence_Limit', 'Measure_Short']
        ].copy()
        
        # Ensure TotalPopulation is numeric
        measure_data['TotalPopulation'] = measure_data['TotalPopulation'].astype(str).str.replace(',', '').astype(float)
        
        # Aggregate by state
        state_aggregated = aggregate_data_by_state(measure_data)
        
        if len(state_aggregated) > 0:
            # Create safe filename
            safe_filename = create_safe_filename(measure)
            state_aggregated.to_csv(f'data/state_measures/{safe_filename}', index=False)
            state_measure_count += 1
            
            if state_measure_count % 10 == 0:
                print(f"  Processed {state_measure_count} state measures...")
    
    print(f"Created {state_measure_count} state aggregate files")
    
    return len(measures_df), len(locations)

def create_short_measure_name(measure):
    """Create a shorter, more readable measure name"""
    # Extract key terms from the measure name
    key_terms = []
    
    # Common health conditions
    conditions = ['asthma', 'diabetes', 'cancer', 'heart disease', 'high blood pressure', 
                 'high cholesterol', 'obesity', 'smoking', 'drinking', 'arthritis', 'copd',
                 'stroke', 'kidney', 'mental health', 'depression', 'anxiety']
    
    # Common actions
    actions = ['screening', 'checkup', 'visit', 'control', 'medication', 'vaccination',
               'testing', 'monitoring', 'treatment']
    
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

def aggregate_data_by_state(measure_data):
    """Aggregate data by state, calculating weighted averages"""
    if len(measure_data) == 0:
        return pd.DataFrame()
    
    # Group by state and calculate weighted averages manually
    state_data = []
    
    for state_name, group in measure_data.groupby('StateDesc'):
        # Calculate basic aggregations
        avg_lat = group['lat'].mean()
        avg_lng = group['lng'].mean()
        total_pop = group['TotalPopulation'].sum()
        location_count = len(group)
        
        # Calculate weighted average for Data_Value
        valid_data = group.dropna(subset=['Data_Value', 'TotalPopulation'])
        if len(valid_data) > 0:
            weights = valid_data['TotalPopulation']
            values = valid_data['Data_Value']
            
            if weights.sum() > 0:
                weighted_avg = (values * weights).sum() / weights.sum()
            else:
                weighted_avg = values.mean()
        else:
            weighted_avg = np.nan
        
        # Get other fields from first row
        first_row = group.iloc[0]
        
        state_data.append({
            'StateDesc': state_name,
            'lat': avg_lat,
            'lng': avg_lng,
            'TotalPopulation': total_pop,
            'Data_Value': weighted_avg,
            'Data_Value_Unit': first_row['Data_Value_Unit'],
            'Data_Value_Type': first_row['Data_Value_Type'],
            'Low_Confidence_Limit': group['Low_Confidence_Limit'].mean(),
            'High_Confidence_Limit': group['High_Confidence_Limit'].mean(),
            'Measure_Short': first_row['Measure_Short'],
            'LocationCount': location_count,
            'LocationName': state_name
        })
    
    return pd.DataFrame(state_data)

def calculate_weighted_average(data, value_col, weight_col):
    """Calculate weighted average of values"""
    if len(data) == 0:
        return np.nan
    
    # Remove any NaN values
    valid_data = data.dropna(subset=[value_col, weight_col])
    if len(valid_data) == 0:
        return np.nan
    
    # Calculate weighted average
    weights = valid_data[weight_col]
    values = valid_data[value_col]
    
    if weights.sum() == 0:
        return values.mean()
    
    weighted_sum = (values * weights).sum()
    total_weight = weights.sum()
    
    if total_weight > 0:
        return weighted_sum / total_weight
    else:
        return values.mean()

def create_safe_filename(measure):
    """Create a safe filename from measure name"""
    # Remove special characters and replace spaces with underscores
    safe_name = re.sub(r'[^\w\s-]', '', measure)
    safe_name = re.sub(r'[-\s]+', '_', safe_name)
    return safe_name[:50] + '.csv'

def preprocess_sdoh_data():
    """Preprocess SDOH data"""
    print("\nLoading SDOH data...")
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
    print("=" * 60)
    
    # Create data directory
    os.makedirs('data', exist_ok=True)
    
    # Process PLACES data
    measure_count, location_count = preprocess_places_data()
    
    # Process SDOH data
    sdoh_count = preprocess_sdoh_data()
    
    print("\n" + "=" * 60)
    print("PREPROCESSING COMPLETE!")
    print("=" * 60)
    print(f"Locations processed: {location_count}")
    print(f"Measures processed: {measure_count}")
    print(f"SDOH records: {sdoh_count}")
    print("\nFiles created:")
    print("- data/locations_summary.csv")
    print("- data/available_measures.csv")
    print("- data/measures/*.csv (individual measure files)")
    print("- data/state_measures/*.csv (state aggregate files)")
    print("- data/sdoh_cleaned.csv")
    print("\nYou can now use these smaller files for faster loading!")

if __name__ == "__main__":
    main()