export const SCREEN_CONFIGS = {
  '10': {
    id: '10',
    label: '10"',
    subtitle: 'Compact',
    // Layout
    leftPanelWidth:    240,
    dockHeight:         48,
    // Panels
    overlayPanelWidth: 272,
    configuratorWidth: 248,
    // Cluster
    speedometerSize:   148,
    rpmGaugeSize:       88,   // unused in compact mode
    showTripComputer:  false,
    showAdasCluster:   false,
    showAlerts:        false,
    compactCluster:    true,  // switches DriverCluster to bar-gauge layout
    // Dock
    dockCompact:       true,
  },
  '12.3': {
    id: '12.3',
    label: '12.3"',
    subtitle: 'Standard',
    leftPanelWidth:    380,
    dockHeight:         64,
    overlayPanelWidth: 320,
    configuratorWidth: 288,
    speedometerSize:   220,
    rpmGaugeSize:      120,
    showTripComputer:  true,
    showAdasCluster:   true,
    showAlerts:        true,
    compactCluster:    false,
    dockCompact:       false,
  },
  '15.6': {
    id: '15.6',
    label: '15.6"',
    subtitle: 'Widescreen',
    leftPanelWidth:    480,
    dockHeight:         80,
    overlayPanelWidth: 384,
    configuratorWidth: 340,
    speedometerSize:   270,
    rpmGaugeSize:      150,
    showTripComputer:  true,
    showAdasCluster:   true,
    showAlerts:        true,
    compactCluster:    false,
    dockCompact:       false,
  },
}
