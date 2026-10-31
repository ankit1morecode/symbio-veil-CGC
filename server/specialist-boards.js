// Research-inspired hardware inventory. These are not simulated instruments:
// no synthetic science readings, extra electrical loads, or new flight services
// are implied until a corresponding model is implemented.
export const specialistBoards = [
  [
    ['imaging-control', 'Multispectral payload controller', 'Image sensor interface and acquisition control', 'https://science.nasa.gov/earth-science/csda/vendor-satlantis/'],
    ['imaging-process', 'Image processing board', 'Onboard processing of image data', 'https://superintelligence.jpl.nasa.gov/public/projects/ipex/'],
  ],
  [
    ['ais-receiver', 'AIS maritime receiver', 'Receives maritime identification signals', 'https://gomspace.com/UserFiles/Subsystems/datasheet/SLDS-AIS-14.pdf'],
    ['ais-signal', 'AIS signal-processing board', 'Digitizes and processes AIS radio signals', 'https://gomspace.com/UserFiles/Subsystems/datasheet/SLDS-AIS-14.pdf'],
  ],
  [
    ['gnss-receiver', 'GNSS receiver board', 'Satellite positioning and timing receiver', 'https://www.nasa.gov/smallsat-institute/sst-soa/identification-and-tracking-systems/'],
    ['precision-timing', 'Precision timing board', 'Timing reference for navigation measurements', 'https://www.nasa.gov/smallsat-institute/sst-soa/identification-and-tracking-systems/'],
  ],
  [
    ['dosimeter', 'Radiation dosimeter board', 'Measures ionizing radiation dose', 'https://www.nasa.gov/ames-engineering/spaceflight-division/biosentinel/'],
    ['particle-readout', 'Particle detector readout', 'Reads and digitizes particle sensor signals', 'https://science.nasa.gov/science-research/science-enabling-technology/technology-highlights/a-new-compact-instrument-enables-high-fidelity-measurements-of-energetic-particles-on-cubesats/'],
  ],
  [
    ['fpga', 'Reconfigurable FPGA payload board', 'Reconfigurable onboard payload processing', 'https://ntrs.nasa.gov/citations/20120015691'],
    ['payload-memory', 'Payload data memory board', 'Local storage for payload-processing data', 'https://www.nasa.gov/smallsat-institute/sst-soa/small-spacecraft-avionics/'],
  ],
  [
    ['relative-optics', 'Relative-navigation imaging board', 'Image-based proximity navigation', 'https://www.nasa.gov/smallsat-institute/sst-soa/guidance-navigation-and-control/'],
    ['range-interface', 'Laser-ranging interface board', 'Interfaces with a proximity rangefinder', 'https://www.nasa.gov/smallsat-institute/sst-soa/guidance-navigation-and-control/'],
  ],
];

export function makeSpecialistBoards(index, satId) {
  return (specialistBoards[index] || []).map(([key, name, purpose, sourceUrl], i) => ({
    id: `${satId}-${key}`,
    name,
    board: `Mission PCB ${i + 1} · ${name}`,
    targetClass: 'specialist',
    specialty: true,
    simulationStatus: 'CATALOG_ONLY',
    purpose,
    sourceUrl,
    health: 'UNKNOWN',
    observedHealth: 'UNKNOWN',
    faultClasses: [],
    temperatureK: null,
    powerW: null,
    dependencies: [],
    observedAt: null,
    confidence: null,
    faultability: false,
    incidents: [],
  }));
}
