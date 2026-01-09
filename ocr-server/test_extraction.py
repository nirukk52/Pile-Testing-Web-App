#!/usr/bin/env python3
"""
Test script for LLM-based extraction.
Why: Validates the extraction pipeline with actual PDF/images and checks API key configuration.
"""

import os
import sys
import json
from pathlib import Path

def check_api_keys():
    """Check if required API keys are configured."""
    from dotenv import load_dotenv
    load_dotenv()
    
    keys = {
        "ANTHROPIC_API_KEY": os.environ.get("ANTHROPIC_API_KEY"),
        "OPENAI_API_KEY": os.environ.get("OPENAI_API_KEY"),
        "GOOGLE_API_KEY": os.environ.get("GOOGLE_API_KEY"),
    }
    
    print("\n=== API Key Status ===")
    any_key_set = False
    for name, value in keys.items():
        if value:
            # Mask the key for security
            masked = value[:8] + "..." + value[-4:] if len(value) > 12 else "***"
            print(f"✅ {name}: {masked}")
            any_key_set = True
        else:
            print(f"❌ {name}: NOT SET")
    
    if not any_key_set:
        print("\n⚠️  No API keys found!")
        print("Please create a .env file in the ocr-server directory with:")
        print("   ANTHROPIC_API_KEY=sk-ant-...")
        print("   OPENAI_API_KEY=sk-...")
        print("   GOOGLE_API_KEY=AIza...")
        return False
    
    return True


def test_extraction(file_path: str):
    """Test extraction on a PDF or image file."""
    from pdf2image import convert_from_path
    from PIL import Image
    from llm_extractor import extract_with_fallback
    
    path = Path(file_path)
    if not path.exists():
        print(f"❌ File not found: {file_path}")
        return None
    
    print(f"\n=== Processing: {path.name} ===")
    
    # Convert to images
    if path.suffix.lower() == ".pdf":
        print("Converting PDF to images...")
        images = convert_from_path(str(path), dpi=200)
        print(f"Converted {len(images)} page(s)")
    else:
        print("Loading image...")
        images = [Image.open(str(path))]
    
    # Run extraction
    print("\nRunning LLM extraction (this may take 15-30 seconds)...")
    result = extract_with_fallback(images)
    
    return result


def print_result(result: dict):
    """Pretty print the extraction result."""
    print("\n" + "="*60)
    print("EXTRACTION RESULT")
    print("="*60)
    
    # Check for error
    if "_error" in result:
        print(f"❌ Error: {result['_error']}")
        return
    
    # Print model used
    if "_model_used" in result:
        print(f"✅ Model used: {result['_model_used']}")
    
    # Print warnings
    warnings = result.get("_warnings", [])
    if warnings:
        print(f"\n⚠️  {len(warnings)} validation warning(s):")
        for w in warnings[:5]:  # Show first 5
            print(f"   - {w}")
        if len(warnings) > 5:
            print(f"   ... and {len(warnings) - 5} more")
    
    # Print summary
    print(f"\n📊 Summary:")
    print(f"   Pages processed: {result.get('page_count', 0)}")
    print(f"   Readings extracted: {result.get('total_readings', 0)}")
    
    # Print project info
    project_info = result.get("project_info", {})
    print(f"\n📋 Project Info:")
    for key, val in project_info.items():
        if val and val.get("value"):
            conf = val.get("confidence", 0)
            conf_indicator = "🔴" if conf < 0.75 else "🟡" if conf < 0.85 else "🟢"
            print(f"   {conf_indicator} {key}: {val['value']} ({conf:.0%})")
    
    # Print first few readings
    readings = result.get("readings", [])
    if readings:
        print(f"\n📈 First 5 Readings:")
        for r in readings[:5]:
            time_val = r.get("time", {}).get("value", "??:??")
            pressure_val = r.get("pressure", {}).get("value", 0)
            g1 = r.get("gauge1", {}).get("value", "-")
            g2 = r.get("gauge2", {}).get("value", "-")
            g3 = r.get("gauge3", {}).get("value", "-")
            g4 = r.get("gauge4", {}).get("value", "-")
            print(f"   {time_val} | P: {pressure_val} | G: {g1}, {g2}, {g3}, {g4}")


def main():
    """Main entry point."""
    print("🔧 PileTest OCR - LLM Extraction Test")
    print("="*60)
    
    # Check API keys first
    if not check_api_keys():
        sys.exit(1)
    
    # Determine test file
    if len(sys.argv) > 1:
        test_file = sys.argv[1]
    else:
        # Default test file
        test_file = "../project_info_and_context/all-hand-readings.pdf"
    
    # Run extraction
    result = test_extraction(test_file)
    
    if result:
        print_result(result)
        
        # Also save to JSON for inspection
        output_file = "test_output.json"
        with open(output_file, "w") as f:
            # Remove internal fields for clean output
            clean_result = {k: v for k, v in result.items() if not k.startswith("_")}
            json.dump(clean_result, f, indent=2, default=str)
        print(f"\n💾 Full result saved to: {output_file}")


if __name__ == "__main__":
    main()








