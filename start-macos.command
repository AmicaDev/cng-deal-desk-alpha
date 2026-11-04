#!/usr/bin/env bash
# ==============================================================================
# CNG Deal Desk — macOS Desktop Launcher
# Launches the standalone desktop web app on macOS (Intel & Apple Silicon)
# ==============================================================================

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

PORT=8080
TARGET_DIR="dist"

echo "======================================================================"
echo "  CNG DEAL DESK — MACOS DESKTOP APPLICATION LAUNCHER"
echo "======================================================================"

if [ ! -d "$TARGET_DIR" ]; then
    echo "Error: '$TARGET_DIR' directory not found. Please run 'npm run build' first."
    read -p "Press Enter to exit..."
    exit 1
fi

echo "Starting local application server on http://127.0.0.1:$PORT..."

# Function to launch the browser
launch_browser() {
    sleep 1
    if command -v open >/dev/null 2>&1; then
        # Try opening in dedicated app mode with Chrome/Edge if installed, otherwise default Safari
        if [ -d "/Applications/Google Chrome.app" ]; then
            open -na "Google Chrome" --args --app="http://127.0.0.1:$PORT"
        elif [ -d "/Applications/Microsoft Edge.app" ]; then
            open -na "Microsoft Edge" --args --app="http://127.0.0.1:$PORT"
        else
            open "http://127.0.0.1:$PORT"
        fi
    fi
}

launch_browser &

# Start HTTP daemon using Python 3 or Node
if command -v python3 >/dev/null 2>&1; then
    cd "$TARGET_DIR" && python3 -m http.server $PORT --bind 127.0.0.1
elif command -v python >/dev/null 2>&1; then
    cd "$TARGET_DIR" && python -m SimpleHTTPServer $PORT
elif command -v node >/dev/null 2>&1; then
    npx --yes serve -s "$TARGET_DIR" -l $PORT
else
    echo "Error: Python or Node.js required to run the local server."
    read -p "Press Enter to exit..."
    exit 1
fi
