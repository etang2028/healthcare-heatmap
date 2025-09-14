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
    """Preprocess SDOH county data"""
    print("\nLoading SDOH county data...")
    try:
        df = pd.read_csv('data/SDOH_2020_COUNTY_1_0_data.csv')
        print(f"SDOH data shape: {df.shape}")
        
        # Clean the data - remove rows with missing COUNTYFIPS
        df = df.dropna(subset=['COUNTYFIPS'])
        
        # Ensure COUNTYFIPS is 5 digits with leading zeros
        df['COUNTYFIPS'] = df['COUNTYFIPS'].astype(str).str.zfill(5)
        
        # Select key SDOH indicators for mapping
        key_indicators = {
            'ACS_MEDIAN_HH_INC': 'Median Household Income',
            'SAIPE_PCT_POV': 'Poverty Rate',
            'ACS_PCT_UNINSURED': 'Uninsured Rate',
            'ACS_PCT_LT_HS': 'Less than High School Education',
            'ACS_PCT_BACHELOR_DGR': 'Bachelor Degree or Higher',
            'ACS_PCT_EMPLOYED': 'Employment Rate',
            'ACS_PCT_UNEMPLOY': 'Unemployment Rate',
            'ACS_PCT_DISABLE': 'Disability Rate',
            'ACS_PCT_FOREIGN_BORN': 'Foreign Born Population',
            'ACS_PCT_HISPANIC': 'Hispanic Population',
            'ACS_PCT_BLACK': 'Black Population',
            'ACS_PCT_WHITE': 'White Population',
            'ACS_PCT_ASIAN': 'Asian Population',
            'ACS_PCT_AIAN': 'American Indian/Alaska Native Population',
            'ACS_PCT_OWNER_HU': 'Homeownership Rate',
            'ACS_PCT_RENTER_HU_COST_30PCT': 'Rent Burden (30%+ income)',
            'ACS_PCT_HH_INTERNET': 'Internet Access Rate',
            'ACS_PCT_HH_BROADBAND': 'Broadband Access Rate',
            'ACS_PCT_DRIVE_2WORK': 'Drive to Work Rate',
            'ACS_PCT_PUBL_TRANSIT': 'Public Transit to Work Rate',
            'ACS_PCT_WALK_2WORK': 'Walk to Work Rate',
            'ACS_PCT_MEDICAID_ANY': 'Medicaid Coverage Rate',
            'ACS_PCT_PRIVATE_ANY': 'Private Insurance Rate',
            'ACS_PCT_UNINSURED_BELOW64': 'Uninsured Under 65 Rate',
            'ACS_PCT_HH_FOOD_STMP': 'Food Stamp/SNAP Usage Rate',
            'ACS_PCT_HH_PUB_ASSIST': 'Public Assistance Rate',
            'ACS_GINI_INDEX': 'Income Inequality (Gini Index)',
            'ACS_PER_CAPITA_INC': 'Per Capita Income',
            'ACS_MEDIAN_AGE': 'Median Age',
            'ACS_PCT_AGE_ABOVE65': 'Population 65+ Rate',
            'ACS_PCT_AGE_0_17': 'Population Under 18 Rate',
            'CEN_POPDENSITY_COUNTY': 'Population Density',
            'AHRF_UNEMPLOYED_RATE': 'Unemployment Rate (AHRF)',
            'AHRF_DAYS_AIR_QLT': 'Air Quality Days',
            'AHRF_PCT_GOOD_AQ': 'Good Air Quality Days',
            'AHRF_HPSA_PRIM': 'Primary Care HPSA',
            'AHRF_HPSA_DENTIST': 'Dental HPSA',
            'AHRF_HPSA_MENTAL': 'Mental Health HPSA'
        }
        
        # Create a subset with key indicators
        sdoh_subset = df[['COUNTYFIPS', 'STATE', 'COUNTY'] + list(key_indicators.keys())].copy()
        
        # Rename columns for better readability
        column_mapping = {'COUNTYFIPS': 'CountyFIPS', 'STATE': 'State', 'COUNTY': 'County'}
        column_mapping.update(key_indicators)
        sdoh_subset = sdoh_subset.rename(columns=column_mapping)
        
        # Save cleaned SDOH data
        sdoh_subset.to_csv('data/sdoh_county_cleaned.csv', index=False)
        print(f"Saved {len(sdoh_subset)} SDOH county records")
        
        # Create SDOH measures list
        sdoh_measures = []
        for col, name in key_indicators.items():
            if col in sdoh_subset.columns:
                sdoh_measures.append({
                    'Measure_Clean': name,
                    'Measure_Short': name.split('(')[0].strip(),
                    'SDOH_Column': col,
                    'Data_Type': 'SDOH'
                })
        
        sdoh_measures_df = pd.DataFrame(sdoh_measures)
        sdoh_measures_df.to_csv('data/sdoh_measures.csv', index=False)
        print(f"Saved {len(sdoh_measures)} SDOH measures")
        
        return len(sdoh_subset)
    except Exception as e:
        print(f"Error processing SDOH data: {e}")
        import traceback
        traceback.print_exc()
        return 0

def preprocess_county_data():
    """Preprocess county data into smaller, cleaned files"""
    print("Loading county data...")
    
    # Load the county dataset
    df = pd.read_csv('data/PLACES__County_Data_(GIS_Friendly_Format),_2020_release_20250914.csv')
    
    print(f"Original county data shape: {df.shape}")
    print(f"Total counties: {len(df)}")
    print(f"Total states: {df['StateDesc'].nunique()}")
    
    # Clean the data
    print("\nCleaning county data...")
    initial_count = len(df)
    
    # Convert TotalPopulation to numeric, handling comma-separated values
    df['TotalPopulation'] = df['TotalPopulation'].astype(str).str.replace(',', '').astype(float)
    
    # Extract coordinates from Geolocation column
    print("Extracting coordinates...")
    coord_pattern = r'POINT \(([^ ]+) ([^)]+)\)'
    coord_matches = df['Geolocation'].str.extract(coord_pattern)
    df['lat'] = coord_matches[1]
    df['lng'] = coord_matches[0]
    
    # Convert to numeric
    df['lat'] = pd.to_numeric(df['lat'], errors='coerce')
    df['lng'] = pd.to_numeric(df['lng'], errors='coerce')
    
    # Only keep rows with valid coordinates
    valid_coords = df.dropna(subset=['lat', 'lng'])
    print(f"After coordinate extraction: {len(valid_coords)} (removed {len(df) - len(valid_coords)})")
    
    # Check coordinate validity (should be within US bounds roughly)
    valid_coords = valid_coords[
        (valid_coords['lat'] >= 24) & (valid_coords['lat'] <= 72) &  # Latitude bounds for US
        (valid_coords['lng'] >= -180) & (valid_coords['lng'] <= -65)  # Longitude bounds for US
    ]
    print(f"After coordinate validation: {len(valid_coords)} (removed {len(df) - len(valid_coords)})")
    
    df = valid_coords
    
    print(f"Final cleaned county data shape: {df.shape}")
    
    # Create county summary
    print("\nCreating county summary...")
    counties = df[['CountyName', 'lat', 'lng', 'StateDesc', 'TotalPopulation', 'CountyFIPS']].copy()
    
    # Ensure CountyFIPS is treated as string to preserve leading zeros
    counties['CountyFIPS'] = counties['CountyFIPS'].astype(str).str.zfill(5)
    
    counties['measure_count'] = 28  # All counties have all 28 measures
    counties['location_type'] = 'County'
    
    # Save county summary
    counties.to_csv('data/county_locations_summary.csv', index=False)
    print(f"Saved {len(counties)} counties to county_locations_summary.csv")
    
    # Show county counts by state
    print("\nCounty counts by state:")
    state_counts = counties['StateDesc'].value_counts()
    for state, count in state_counts.head(10).items():
        print(f"  {state}: {count} counties")
    
    # Create measure mapping from county columns to measure names
    measure_mapping = {
        'ACCESS2_AdjPrev': 'Current lack of health insurance among adults aged 18-64 years',
        'ARTHRITIS_AdjPrev': 'Arthritis among adults aged >=18 years',
        'BINGE_AdjPrev': 'Binge drinking among adults aged >=18 years',
        'BPHIGH_AdjPrev': 'High blood pressure among adults aged >=18 years',
        'BPMED_AdjPrev': 'Taking medicine for high blood pressure control among adults aged >=18 years with high blood pressure',
        'CANCER_AdjPrev': 'Cancer (excluding skin cancer) among adults aged >=18 years',
        'CASTHMA_AdjPrev': 'Current asthma among adults aged >=18 years',
        'CERVICAL_AdjPrev': 'Cervical cancer screening among adult women aged 21-65 years',
        'CHD_AdjPrev': 'Coronary heart disease among adults aged >=18 years',
        'CHECKUP_AdjPrev': 'Visits to doctor for routine checkup within the past year among adults aged >=18 years',
        'CHOLSCREEN_AdjPrev': 'Cholesterol screening among adults aged >=18 years',
        'COLON_SCREEN_AdjPrev': 'Fecal occult blood test, sigmoidoscopy, or colonoscopy among adults aged 50-75 years',
        'COPD_AdjPrev': 'Chronic obstructive pulmonary disease among adults aged >=18 years',
        'COREM_AdjPrev': 'Older adult men aged >=65 years who are up to date on a core set of clinical preventive services: Flu shot past year, PPV shot ever, Colorectal cancer screening',
        'COREW_AdjPrev': 'Older adult women aged >=65 years who are up to date on a core set of clinical preventive services: Flu shot past year, PPV shot ever, Colorectal cancer screening, and Mammogram past 2 years',
        'CSMOKING_AdjPrev': 'Current smoking among adults aged >=18 years',
        'DENTAL_AdjPrev': 'Visits to dentist or dental clinic among adults aged >=18 years',
        'DIABETES_AdjPrev': 'Diagnosed diabetes among adults aged >=18 years',
        'HIGHCHOL_AdjPrev': 'High cholesterol among adults aged >=18 years who have been screened in the past 5 years',
        'KIDNEY_AdjPrev': 'Chronic kidney disease among adults aged >=18 years',
        'LPA_AdjPrev': 'No leisure-time physical activity among adults aged >=18 years',
        'MAMMOUSE_AdjPrev': 'Mammography use among women aged 50-74 years',
        'MHLTH_AdjPrev': 'Mental health not good for >=14 days among adults aged >=18 years',
        'OBESITY_AdjPrev': 'Obesity among adults aged >=18 years',
        'PHLTH_AdjPrev': 'Physical health not good for >=14 days among adults aged >=18 years',
        'SLEEP_AdjPrev': 'Sleeping less than 7 hours among adults aged >=18 years',
        'STROKE_AdjPrev': 'Stroke among adults aged >=18 years',
        'TEETHLOST_AdjPrev': 'All teeth lost among adults aged >=65 years'
    }
    
    # Create individual county measure files
    print("\nCreating individual county measure files...")
    os.makedirs('data/county_measures', exist_ok=True)
    
    measure_count = 0
    for county_col, measure_name in measure_mapping.items():
        # Get the confidence interval column
        ci_col = county_col.replace('_AdjPrev', '_Adj95CI')
        
        # Create measure data
        measure_data = df[['CountyName', 'lat', 'lng', 'StateDesc', 'TotalPopulation', 'CountyFIPS', county_col, ci_col]].copy()
        measure_data.columns = ['LocationName', 'lat', 'lng', 'StateDesc', 'TotalPopulation', 'CountyFIPS', 'Data_Value', 'Confidence_Interval']
        
        # Ensure CountyFIPS is treated as string to preserve leading zeros
        measure_data['CountyFIPS'] = measure_data['CountyFIPS'].astype(str).str.zfill(5)
        
        # Parse confidence intervals to get low and high limits
        def parse_confidence_interval(ci_str):
            if pd.isna(ci_str) or ci_str == '':
                return np.nan, np.nan
            try:
                # Extract numbers from format like "(11.6, 16.3)"
                numbers = re.findall(r'[\d.]+', str(ci_str))
                if len(numbers) >= 2:
                    return float(numbers[0]), float(numbers[1])
                return np.nan, np.nan
            except:
                return np.nan, np.nan
        
        ci_parsed = measure_data['Confidence_Interval'].apply(parse_confidence_interval)
        measure_data['Low_Confidence_Limit'] = [x[0] for x in ci_parsed]
        measure_data['High_Confidence_Limit'] = [x[1] for x in ci_parsed]
        
        # Add other required columns
        measure_data['Data_Value_Unit'] = '%'
        measure_data['Data_Value_Type'] = 'Crude Prevalence'
        measure_data['Measure_Short'] = create_short_measure_name(measure_name)
        
        # Drop the raw confidence interval column
        measure_data = measure_data.drop('Confidence_Interval', axis=1)
        
        # Only keep rows with valid data values
        measure_data = measure_data.dropna(subset=['Data_Value'])
        
        # Create safe filename
        safe_filename = create_safe_filename(measure_name)
        measure_data.to_csv(f'data/county_measures/{safe_filename}', index=False)
        measure_count += 1
        
        if measure_count % 10 == 0:
            print(f"  Processed {measure_count} county measures...")
    
    print(f"Created {measure_count} individual county measure files")
    
    # Create state aggregate files for counties
    print("\nCreating state aggregate files for counties...")
    os.makedirs('data/county_state_measures', exist_ok=True)
    
    state_measure_count = 0
    for county_col, measure_name in measure_mapping.items():
        # Get the confidence interval column
        ci_col = county_col.replace('_AdjPrev', '_Adj95CI')
        
        # Create measure data
        measure_data = df[['CountyName', 'lat', 'lng', 'StateDesc', 'TotalPopulation', 'CountyFIPS', county_col, ci_col]].copy()
        measure_data.columns = ['LocationName', 'lat', 'lng', 'StateDesc', 'TotalPopulation', 'CountyFIPS', 'Data_Value', 'Confidence_Interval']
        
        # Ensure CountyFIPS is treated as string to preserve leading zeros
        measure_data['CountyFIPS'] = measure_data['CountyFIPS'].astype(str).str.zfill(5)
        
        # Parse confidence intervals
        def parse_confidence_interval(ci_str):
            if pd.isna(ci_str) or ci_str == '':
                return np.nan, np.nan
            try:
                numbers = re.findall(r'[\d.]+', str(ci_str))
                if len(numbers) >= 2:
                    return float(numbers[0]), float(numbers[1])
                return np.nan, np.nan
            except:
                return np.nan, np.nan
        
        ci_parsed = measure_data['Confidence_Interval'].apply(parse_confidence_interval)
        measure_data['Low_Confidence_Limit'] = [x[0] for x in ci_parsed]
        measure_data['High_Confidence_Limit'] = [x[1] for x in ci_parsed]
        
        # Add other required columns
        measure_data['Data_Value_Unit'] = '%'
        measure_data['Data_Value_Type'] = 'Crude Prevalence'
        measure_data['Measure_Short'] = create_short_measure_name(measure_name)
        
        # Drop the raw confidence interval column
        measure_data = measure_data.drop('Confidence_Interval', axis=1)
        
        # Only keep rows with valid data values
        measure_data = measure_data.dropna(subset=['Data_Value'])
        
        # Aggregate by state
        state_aggregated = aggregate_data_by_state(measure_data)
        
        # Create safe filename
        safe_filename = create_safe_filename(measure_name)
        state_aggregated.to_csv(f'data/county_state_measures/{safe_filename}', index=False)
        state_measure_count += 1
        
        if state_measure_count % 10 == 0:
            print(f"  Processed {state_measure_count} county state measures...")
    
    print(f"Created {state_measure_count} county state aggregate files")
    
    return measure_count, len(counties)

def main():
    """Main preprocessing function"""
    print("Starting data preprocessing...")
    print("=" * 60)
    
    # Create data directory
    os.makedirs('data', exist_ok=True)
    
    # Process county data
    county_measure_count, county_count = preprocess_county_data()
    
    # Process SDOH data
    sdoh_count = preprocess_sdoh_data()
    
    print("\n" + "=" * 60)
    print("PREPROCESSING COMPLETE!")
    print("=" * 60)
    print(f"County locations processed: {county_count}")
    print(f"County measures processed: {county_measure_count}")
    print(f"SDOH records: {sdoh_count}")
    print("\nFiles created:")
    print("- data/county_locations_summary.csv (county data)")
    print("- data/available_measures.csv")
    print("- data/county_measures/*.csv (individual county measure files)")
    print("- data/county_state_measures/*.csv (county state aggregate files)")
    print("- data/sdoh_cleaned.csv")
    print("\nYou can now use these smaller files for faster loading!")

if __name__ == "__main__":
    main()