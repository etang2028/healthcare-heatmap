#!/usr/bin/env python3
"""Analyze SDOH data structure"""

import pandas as pd

# Load SDOH data
df = pd.read_csv('data/SDOH_2020_COUNTY_1_0_data.csv')

print("SDOH Data Analysis")
print("=" * 50)
print(f"Shape: {df.shape}")
print(f"COUNTYFIPS sample: {df['COUNTYFIPS'].head().tolist()}")
print(f"COUNTYFIPS unique count: {df['COUNTYFIPS'].nunique()}")

# Find percentage columns
pct_cols = [col for col in df.columns if 'PCT' in col]
print(f"\nPercentage columns: {len(pct_cols)}")
print("Sample PCT columns:")
for i, col in enumerate(pct_cols[:10]):
    print(f"  {i+1}. {col}")

# Find income-related columns
income_cols = [col for col in df.columns if 'INC' in col]
print(f"\nIncome-related columns: {len(income_cols)}")
print("Sample income columns:")
for i, col in enumerate(income_cols[:5]):
    print(f"  {i+1}. {col}")

# Find poverty-related columns
pov_cols = [col for col in df.columns if 'POV' in col]
print(f"\nPoverty-related columns: {len(pov_cols)}")
print("Sample poverty columns:")
for i, col in enumerate(pov_cols[:5]):
    print(f"  {i+1}. {col}")

# Check if COUNTYFIPS needs zero-padding
print(f"\nCOUNTYFIPS format check:")
print(f"Sample values: {df['COUNTYFIPS'].head().tolist()}")
print(f"Length of first value: {len(str(df['COUNTYFIPS'].iloc[0]))}")

# Check for missing values
print(f"\nMissing values in key columns:")
print(f"COUNTYFIPS missing: {df['COUNTYFIPS'].isna().sum()}")
print(f"STATE missing: {df['STATE'].isna().sum()}")
print(f"COUNTY missing: {df['COUNTY'].isna().sum()}")
