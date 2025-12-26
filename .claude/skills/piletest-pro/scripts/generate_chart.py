#!/usr/bin/env python3
"""
Load vs Settlement Chart Generator
Why: Generates chart images for pile load test reports using matplotlib.

Usage:
    python generate_chart.py readings.json output.png

This script can be used standalone or the logic can be adapted for
server-side chart generation.
"""

import json
import sys
from typing import List, Dict, Any

try:
    import matplotlib.pyplot as plt
    import matplotlib.patches as mpatches
except ImportError:
    print("Error: matplotlib required. Install with: pip install matplotlib")
    sys.exit(1)


# Chart configuration per IS 2911 report standards
CHART_CONFIG = {
    'figsize': (10, 6),
    'dpi': 150,
    'colors': {
        'LOADING': '#2563eb',    # Blue
        'HOLD': '#f59e0b',       # Amber  
        'UNLOADING': '#10b981',  # Green
        'limit_line': '#ef4444', # Red
        'grid': '#e2e8f0',       # Light gray
    },
    'markers': {
        'LOADING': 'o',
        'HOLD': 's',
        'UNLOADING': '^',
    },
    'line_width': 2,
    'marker_size': 6,
}


def generate_load_settlement_chart(
    readings: List[Dict[str, Any]],
    settlement_limit_mm: float = 12.0,
    test_load_t: float = None,
    output_path: str = 'chart.png',
    title: str = 'Load vs Settlement Curve'
) -> str:
    """
    Generate load vs settlement chart.
    
    Args:
        readings: List of reading dicts with loadT, avgSettlementMm, phase
        settlement_limit_mm: IS 2911 settlement limit (default 12mm)
        test_load_t: Test load for annotation
        output_path: Output file path
        title: Chart title
        
    Returns:
        Path to generated image
    """
    fig, ax = plt.subplots(figsize=CHART_CONFIG['figsize'])
    
    # Separate readings by phase
    phases = {'LOADING': [], 'HOLD': [], 'UNLOADING': []}
    for r in readings:
        phase = r.get('phase', 'LOADING').upper()
        if phase in phases:
            phases[phase].append(r)
    
    # Plot each phase
    for phase, phase_readings in phases.items():
        if not phase_readings:
            continue
            
        # Sort by load for proper curve
        sorted_readings = sorted(phase_readings, key=lambda r: r['loadT'])
        
        loads = [r['loadT'] for r in sorted_readings]
        settlements = [r['avgSettlementMm'] for r in sorted_readings]
        
        ax.plot(
            loads,
            settlements,
            color=CHART_CONFIG['colors'][phase],
            marker=CHART_CONFIG['markers'][phase],
            linewidth=CHART_CONFIG['line_width'],
            markersize=CHART_CONFIG['marker_size'],
            label=phase.capitalize()
        )
    
    # Add settlement limit line
    ax.axhline(
        y=settlement_limit_mm,
        color=CHART_CONFIG['colors']['limit_line'],
        linestyle='--',
        linewidth=1.5,
        label=f'Settlement Limit ({settlement_limit_mm}mm)'
    )
    
    # Configure axes
    ax.set_xlabel('Load (MT)', fontsize=12, fontweight='bold')
    ax.set_ylabel('Settlement (mm)', fontsize=12, fontweight='bold')
    ax.set_title(title, fontsize=14, fontweight='bold', pad=20)
    
    # Invert Y-axis (settlement increases downward)
    ax.invert_yaxis()
    
    # Grid
    ax.grid(True, linestyle='-', alpha=0.3, color=CHART_CONFIG['colors']['grid'])
    ax.set_axisbelow(True)
    
    # Legend
    ax.legend(loc='lower right', framealpha=0.9)
    
    # Set axis limits with padding
    all_loads = [r['loadT'] for r in readings]
    all_settlements = [r['avgSettlementMm'] for r in readings]
    
    if all_loads:
        ax.set_xlim(0, max(all_loads) * 1.1)
    if all_settlements:
        ax.set_ylim(max(all_settlements) * 1.1, -0.5)
    
    # Tight layout
    plt.tight_layout()
    
    # Save
    fig.savefig(output_path, dpi=CHART_CONFIG['dpi'], bbox_inches='tight')
    plt.close(fig)
    
    return output_path


def generate_chart_base64(readings: List[Dict[str, Any]], **kwargs) -> str:
    """
    Generate chart and return as base64 string for embedding in HTML.
    
    Returns:
        Base64 encoded PNG image as data URI
    """
    import base64
    from io import BytesIO
    
    fig, ax = plt.subplots(figsize=CHART_CONFIG['figsize'])
    
    # ... same plotting logic as above ...
    # (Simplified here - use generate_load_settlement_chart logic)
    
    # Save to buffer
    buffer = BytesIO()
    fig.savefig(buffer, format='png', dpi=CHART_CONFIG['dpi'], bbox_inches='tight')
    buffer.seek(0)
    
    # Encode to base64
    img_base64 = base64.b64encode(buffer.read()).decode('utf-8')
    plt.close(fig)
    
    return f'data:image/png;base64,{img_base64}'


def main():
    """Run chart generation from command line."""
    if len(sys.argv) < 3:
        print("Usage: python generate_chart.py <readings.json> <output.png>")
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2]
    
    try:
        with open(input_file, 'r') as f:
            data = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        print(f"Error reading file: {e}")
        sys.exit(1)
    
    readings = data.get('readings', [])
    settlement_limit = data.get('settlementLimitMm', 12.0)
    test_load = data.get('testLoadT')
    
    output_path = generate_load_settlement_chart(
        readings=readings,
        settlement_limit_mm=settlement_limit,
        test_load_t=test_load,
        output_path=output_file
    )
    
    print(f"✅ Chart generated: {output_path}")


if __name__ == '__main__':
    main()
