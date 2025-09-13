#!/usr/bin/env python3
"""
Test script to verify the Health Equity Heatmap setup
"""

import sys
import os

def test_imports():
    """Test if all required packages can be imported"""
    print("Testing package imports...")
    
    try:
        import flask
        print("✓ Flask imported successfully")
    except ImportError as e:
        print(f"✗ Flask import failed: {e}")
        return False
    
    try:
        import pandas
        print("✓ Pandas imported successfully")
    except ImportError as e:
        print(f"✗ Pandas import failed: {e}")
        return False
    
    try:
        import numpy
        print("✓ NumPy imported successfully")
    except ImportError as e:
        print(f"✗ NumPy import failed: {e}")
        return False
    
    try:
        import openpyxl
        print("✓ OpenPyXL imported successfully")
    except ImportError as e:
        print(f"✗ OpenPyXL import failed: {e}")
        return False
    
    return True

def test_data_files():
    """Test if data files exist and are readable"""
    print("\nTesting data files...")
    
    places_file = "data/PLACES__Local_Data_for_Better_Health,_Place_Data_2020_release_20250913.csv"
    sdoh_file = "data/SDOH_2020_ZIPCODE_1_0.xlsx"
    
    if os.path.exists(places_file):
        print(f"✓ PLACES data file found: {places_file}")
        file_size = os.path.getsize(places_file)
        print(f"  File size: {file_size / (1024*1024):.1f} MB")
    else:
        print(f"✗ PLACES data file not found: {places_file}")
        return False
    
    if os.path.exists(sdoh_file):
        print(f"✓ SDOH data file found: {sdoh_file}")
        file_size = os.path.getsize(sdoh_file)
        print(f"  File size: {file_size / (1024*1024):.1f} MB")
    else:
        print(f"✗ SDOH data file not found: {sdoh_file}")
        return False
    
    return True

def test_app_structure():
    """Test if application files exist"""
    print("\nTesting application structure...")
    
    required_files = [
        "app.py",
        "requirements.txt",
        "templates/index.html",
        "static/style.css",
        "static/app.js"
    ]
    
    all_exist = True
    for file_path in required_files:
        if os.path.exists(file_path):
            print(f"✓ {file_path} exists")
        else:
            print(f"✗ {file_path} missing")
            all_exist = False
    
    return all_exist

def test_data_processing():
    """Test data processing functions"""
    print("\nTesting data processing...")
    
    try:
        # Import the app module
        sys.path.append('.')
        from app import clean_places_data, clean_sdoh_data
        
        print("✓ Data processing functions imported successfully")
        
        # Test PLACES data cleaning (this might take a while due to large file)
        print("  Testing PLACES data cleaning...")
        places_df = clean_places_data()
        
        if not places_df.empty:
            print(f"✓ PLACES data cleaned successfully: {len(places_df)} records")
            print(f"  Columns: {list(places_df.columns)}")
        else:
            print("⚠ PLACES data cleaning returned empty DataFrame")
        
        # Test SDOH data cleaning
        print("  Testing SDOH data cleaning...")
        sdoh_df = clean_sdoh_data()
        
        if not sdoh_df.empty:
            print(f"✓ SDOH data cleaned successfully: {len(sdoh_df)} records")
        else:
            print("⚠ SDOH data cleaning returned empty DataFrame")
        
        return True
        
    except Exception as e:
        print(f"✗ Data processing test failed: {e}")
        return False

def main():
    """Run all tests"""
    print("Health Equity Heatmap - Setup Test")
    print("=" * 40)
    
    tests = [
        ("Package Imports", test_imports),
        ("Data Files", test_data_files),
        ("App Structure", test_app_structure),
        ("Data Processing", test_data_processing)
    ]
    
    results = []
    for test_name, test_func in tests:
        print(f"\n{test_name}:")
        print("-" * len(test_name))
        result = test_func()
        results.append((test_name, result))
    
    print("\n" + "=" * 40)
    print("SUMMARY:")
    print("=" * 40)
    
    all_passed = True
    for test_name, result in results:
        status = "PASS" if result else "FAIL"
        print(f"{test_name}: {status}")
        if not result:
            all_passed = False
    
    if all_passed:
        print("\n🎉 All tests passed! Your setup is ready.")
        print("\nTo run the application:")
        print("  python app.py")
        print("\nThen open your browser to: http://localhost:5000")
    else:
        print("\n❌ Some tests failed. Please check the errors above.")
    
    return all_passed

if __name__ == "__main__":
    main()
