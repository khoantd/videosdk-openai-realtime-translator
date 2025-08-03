#!/usr/bin/env python3
"""
Log Viewer Utility for VideoSDK OpenAI Realtime Translator

This script helps view and export logs from both backend and frontend components.
"""

import json
import os
import sys
from datetime import datetime
from typing import List, Dict, Any
import argparse

def read_backend_logs(log_file: str = "backend.log") -> List[Dict[str, Any]]:
    """Read and parse backend logs from file."""
    logs = []
    if not os.path.exists(log_file):
        print(f"Backend log file not found: {log_file}")
        return logs
    
    try:
        with open(log_file, 'r') as f:
            for line in f:
                line = line.strip()
                if line:
                    # Parse log line format: timestamp - name - level - message
                    parts = line.split(' - ', 3)
                    if len(parts) >= 4:
                        timestamp, name, level, message = parts
                        logs.append({
                            'timestamp': timestamp,
                            'component': name,
                            'level': level,
                            'message': message,
                            'source': 'backend'
                        })
    except Exception as e:
        print(f"Error reading backend logs: {e}")
    
    return logs

def read_frontend_logs() -> List[Dict[str, Any]]:
    """Read frontend logs from localStorage (simulated by reading from a file)."""
    logs = []
    frontend_log_file = "frontend_logs.json"
    
    if os.path.exists(frontend_log_file):
        try:
            with open(frontend_log_file, 'r') as f:
                logs = json.load(f)
                for log in logs:
                    log['source'] = 'frontend'
        except Exception as e:
            print(f"Error reading frontend logs: {e}")
    else:
        print("Frontend log file not found. Run the frontend to generate logs.")
    
    return logs

def filter_logs(logs: List[Dict[str, Any]], 
                level: str = None, 
                component: str = None, 
                source: str = None,
                search: str = None) -> List[Dict[str, Any]]:
    """Filter logs based on criteria."""
    filtered = logs
    
    if level:
        filtered = [log for log in filtered if log.get('level', '').upper() == level.upper()]
    
    if component:
        filtered = [log for log in filtered if component.lower() in log.get('component', '').lower()]
    
    if source:
        filtered = [log for log in filtered if log.get('source') == source]
    
    if search:
        filtered = [log for log in filtered if search.lower() in log.get('message', '').lower()]
    
    return filtered

def display_logs(logs: List[Dict[str, Any]], limit: int = None):
    """Display logs in a formatted way."""
    if limit:
        logs = logs[-limit:]
    
    print(f"\n{'='*80}")
    print(f"Displaying {len(logs)} logs")
    print(f"{'='*80}\n")
    
    for log in logs:
        timestamp = log.get('timestamp', 'Unknown')
        level = log.get('level', 'UNKNOWN')
        component = log.get('component', 'Unknown')
        message = log.get('message', '')
        source = log.get('source', 'unknown')
        
        # Color coding for levels
        level_colors = {
            'ERROR': '\033[91m',    # Red
            'WARN': '\033[93m',     # Yellow
            'INFO': '\033[94m',     # Blue
            'DEBUG': '\033[90m',    # Gray
        }
        color = level_colors.get(level.upper(), '')
        reset = '\033[0m'
        
        print(f"{color}[{timestamp}] [{level}] [{component}] [{source}]{reset}")
        print(f"  {message}")
        if log.get('data'):
            print(f"  Data: {json.dumps(log['data'], indent=2)}")
        print()

def export_logs(logs: List[Dict[str, Any]], filename: str):
    """Export logs to JSON file."""
    try:
        with open(filename, 'w') as f:
            json.dump(logs, f, indent=2)
        print(f"Logs exported to: {filename}")
    except Exception as e:
        print(f"Error exporting logs: {e}")

def generate_summary(logs: List[Dict[str, Any]]):
    """Generate a summary of the logs."""
    if not logs:
        print("No logs to summarize")
        return
    
    # Count by level
    level_counts = {}
    component_counts = {}
    source_counts = {}
    
    for log in logs:
        level = log.get('level', 'UNKNOWN')
        component = log.get('component', 'Unknown')
        source = log.get('source', 'unknown')
        
        level_counts[level] = level_counts.get(level, 0) + 1
        component_counts[component] = component_counts.get(component, 0) + 1
        source_counts[source] = source_counts.get(source, 0) + 1
    
    print(f"\n{'='*50}")
    print("LOG SUMMARY")
    print(f"{'='*50}")
    print(f"Total logs: {len(logs)}")
    print(f"Time range: {logs[0].get('timestamp')} to {logs[-1].get('timestamp')}")
    
    print("\nBy Level:")
    for level, count in sorted(level_counts.items()):
        print(f"  {level}: {count}")
    
    print("\nBy Component:")
    for component, count in sorted(component_counts.items()):
        print(f"  {component}: {count}")
    
    print("\nBy Source:")
    for source, count in sorted(source_counts.items()):
        print(f"  {source}: {count}")

def main():
    parser = argparse.ArgumentParser(description="Log Viewer for VideoSDK Translator")
    parser.add_argument("--backend-log", default="backend.log", help="Backend log file path")
    parser.add_argument("--level", help="Filter by log level (ERROR, WARN, INFO, DEBUG)")
    parser.add_argument("--component", help="Filter by component name")
    parser.add_argument("--source", choices=['backend', 'frontend'], help="Filter by source")
    parser.add_argument("--search", help="Search in log messages")
    parser.add_argument("--limit", type=int, help="Limit number of logs to display")
    parser.add_argument("--export", help="Export logs to JSON file")
    parser.add_argument("--summary", action="store_true", help="Show log summary")
    parser.add_argument("--no-display", action="store_true", help="Don't display logs (useful with --export)")
    
    args = parser.parse_args()
    
    # Read logs
    backend_logs = read_backend_logs(args.backend_log)
    frontend_logs = read_frontend_logs()
    
    # Combine logs
    all_logs = backend_logs + frontend_logs
    
    # Sort by timestamp
    all_logs.sort(key=lambda x: x.get('timestamp', ''))
    
    if not all_logs:
        print("No logs found")
        return
    
    # Filter logs
    filtered_logs = filter_logs(
        all_logs, 
        level=args.level, 
        component=args.component, 
        source=args.source,
        search=args.search
    )
    
    # Show summary if requested
    if args.summary:
        generate_summary(filtered_logs)
    
    # Export if requested
    if args.export:
        export_logs(filtered_logs, args.export)
    
    # Display logs
    if not args.no_display:
        display_logs(filtered_logs, args.limit)

if __name__ == "__main__":
    main() 