# Biomet Live View

A real-time data visualization dashboard for biomet bicycle measurements using the Web Serial API.

## Features

### Core Functionality

- Real-time serial data acquisition from biomet devices
- Interactive data visualization with Chart.js
- Responsive Bootstrap UI
- Time series plotting with zoom and pan capabilities
- Live data updates in charts

### GPS & Mapping

- Interactive GPS route mapping with Leaflet
- Real-time GPS tracking with circular markers
- Color-coded markers (green for start, red for current, blue for intermediate points)
- Auto-follow toggle for map centering control
- Manual map navigation without forced recentering

### User Interface

- Clickable parameter headers to open time series charts
- Full-screen modals for charts and maps
- Test mode toggle for development and demonstration
- Production-ready configuration (test mode can be disabled)
- Responsive design optimized for various screen sizes

### Data Management

- Up to 1 hour of historical data storage (3600 data points)
- Real-time chart updates without performance degradation
- Comprehensive biomet parameter support (temperature, humidity, radiation, wind, GPS, etc.)
- Proper data formatting with configurable decimal precision

## Deployment

This project is deployed using GitHub Pages and can be accessed at: `https://rubclim.github.io/biomet-bike-live-view`

## Requirements

- Modern web browser with Web Serial API support (Chrome, Edge)
- Serial device connection capability
- For GPS mapping: Internet connection to load map tiles

## Configuration

### Production Deployment

To disable test mode for production, set `ENABLE_TEST_MODE = false` in `js/biomet-live-view.js`

### Data Storage

- Maximum 3600 data points (1 hour at 1-second intervals)
- Automatic data pruning to maintain performance

## Usage

### Getting Started

1. Open the application in a compatible browser
2. Click "Connect" to establish serial connection with the biomet bike
3. Select your biomet device from the serial port list
4. View real-time data on the dashboard cards

### Interactive Features

- **Charts**: Click on any parameter header to open a full-screen time series chart
- **Maps**: Click "View Map" to see GPS tracking with interactive route display
- **Test Mode**: Use "Test Mode" button for demonstration with simulated data (development only)
- **Auto Follow**: Toggle map auto-centering in the map modal

### Chart Controls

- Mouse wheel: Zoom in/out
- Click and drag: Pan through time series
- "Reset Zoom" button: Return to original view
- Real-time updates: Charts automatically update with new data

### Map Controls

- "Auto Follow: ON/OFF": Toggle automatic centering on new GPS points
- "Fit to Points": Manually center map on all GPS data
- Click markers: View detailed GPS coordinates and timestamps
- Pan and zoom: Standard map navigation when auto-follow is disabled

## Browser Compatibility

This application requires the Web Serial API, which is currently supported in:

- Chrome 89+
- Edge 89+
- Opera 75+

Note: Firefox and Safari do not currently support the Web Serial API.
