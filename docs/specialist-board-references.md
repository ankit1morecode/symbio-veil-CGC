# CubeSat specialist board concepts

Each of the first six spacecraft retains the shared simulation bus and receives two distinct research-inspired board inventory entries. They are schematic concepts, not a claim that a particular flight-qualified commercial product is installed. Specialist boards have **no modeled independent health, measurements, fault behavior, additional power consumption, or mission outputs**. Existing synthetic core simulation and mission tasks continue separately.

| Spacecraft | Specialist board concepts | Research references |
|---|---|---|
| AURORA | Multispectral payload controller; image processing | [NASA CSDA Satlantis](https://science.nasa.gov/earth-science/csda/vendor-satlantis/); [JPL IPEX](https://superintelligence.jpl.nasa.gov/public/projects/ipex/) |
| ATLAS | AIS maritime receiver; AIS signal processing | [GomSpace QubeAIS datasheet](https://gomspace.com/UserFiles/Subsystems/datasheet/SLDS-AIS-14.pdf) |
| ORION | GNSS receiver; precision timing | [NASA SmallSat identification and tracking](https://www.nasa.gov/smallsat-institute/sst-soa/identification-and-tracking-systems/) |
| VEGA | Radiation dosimeter; particle detector readout | [NASA BioSentinel](https://www.nasa.gov/ames-engineering/spaceflight-division/biosentinel/); [NASA REAL instrument](https://science.nasa.gov/science-research/science-enabling-technology/technology-highlights/a-new-compact-instrument-enables-high-fidelity-measurements-of-energetic-particles-on-cubesats/) |
| NOVA | Reconfigurable FPGA processor; payload data memory | [NASA COVE FPGA payload](https://ntrs.nasa.gov/citations/20120015691); [NASA SmallSat avionics](https://www.nasa.gov/smallsat-institute/sst-soa/small-spacecraft-avionics/) |
| HELIOS | Relative-navigation imaging; laser-ranging interface | [NASA SmallSat guidance, navigation and control](https://www.nasa.gov/smallsat-institute/sst-soa/guidance-navigation-and-control/) |

Existing saved runs retain their previous component inventory; create a new six-spacecraft run to receive the updated configuration.
