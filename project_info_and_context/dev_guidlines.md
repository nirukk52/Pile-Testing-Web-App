
1
Developer Guidelines for Automated Pile Load Test
Report Generation
Target Audience and Input Constraints
These guidelines are intended for a developer or coding agent responsible for programmatically generating
pile load test reports from image-based data inputs. The agent will be extracting structured data from
screenshots or scanned images (e.g. tables of test results, graphs of load vs displacement) rather than
parsing PDFs or PPT files directly. Therefore, the focus is on robust OCR-based data extraction and
interpretation of visual content. The goal is to produce a well-structured, comprehensive report in a
consistent format, given the challenges of imperfect OCR and image inputs. The coding agent should be
prepared to apply domain knowledge and use AI assistance where needed to interpret the data (especially
graphs or unclear text), as detailed below.
Test Types Covered
The system must handle report generation for the following pile load test types, each with distinct
procedures and acceptance criteria:
Initial Vertical Pile Load Test (IVPLT): An intensive vertical load test on a test pile (often non-
working pile) to 2.5× the design load . It evaluates ultimate capacity with stricter settlement
criteria (typically 12 mm limit).
Routine Vertical Pile Load Test (RVPLT): A routine proof test on a working pile to 1.5× the design
load . It confirms working load capacity with a slightly higher settlement tolerance (typically
18 mm limit).
Lateral Load Test: A horizontal load test (often initial) to check lateral capacity. Often conducted to
2.5× the design lateral load (if initial), usually under a 5 mm lateral deflection acceptance
criterion. It uses a reaction frame or pile to apply sideways load.
Uplift/Pullout Test: A vertical uplift (tension) test (usually initial) to 2.5× the design uplift load. It
checks anchorage capacity; acceptance often based on a 12 mm upward movement limit or a yield
point in the load-displacement curve.
Each test type will follow the general report structure outlined below, with some differences in content
details, criteria, and phrasing as noted.
Report Structure and Mandatory Sections
Each generated report must contain the following primary sections (in this order) to mirror industry-
standard pile test reports :
1.0 General: Introduction describing the test’s context and purpose.
•
1
•
2
•
•
3 4
•
1
2.0 Scope of Work: Details of the pile tested and test parameters.
3.0 Methodology: Description of how the test was conducted, referencing standards.
4.0 Results: Key findings, including acceptance criteria and whether they were met.
5.0 Readings and Graphs: Presentation of detailed field readings (tables) and plotted load vs.
displacement graphs.
(Optional) Field Readings / Data: Raw data tables (if not included in section 5.0) and any
observations during testing.
(Optional) Calibration Certificate: If available, a section appending calibration certificates for
instruments.
Below, we detail the content and language expected in each section for each test type.
Initial Vertical Load Test (IVPLT)
General: State the project and purpose. For example: “Clients decided to carry out a static vertical pile load test
on a 600 mm diameter pile to estimate its load carrying capacity and settlement. M/s <Agency> was entrusted
to perform this initial test.” Mention relevant codes (e.g. IS 2911 (Part 4):2013 for load tests ).
Scope of Work: Summarize pile details in a table or text: location, pile ID, diameter, depth, concrete grade,
etc. Include design load and the required test load. For an initial test, confirm that test load = 2.5 × design
load (e.g. design load 147 T, tested to 367.5 T ). This section often explicitly states the test load
requirement: “The pile is required to be tested to a load of 367.5 T.” Include a subsection “Pile details for Initial
Pile” with these parameters.
Methodology: Describe the test setup and procedure, referring to IS codes. Note that for initial tests,
loading is done in increments (typically ~20% of design load per step ) up to 2.5× design load. Mention
the use of hydraulic jacks, reaction systems, dial gauges, and the load application procedure. For example:
“The initial load test was carried out as per IS:2911 (Part 4). The pile was loaded in increments of 20% of the
design load, up to the test load, and then unloaded as per the prescribed sequence . A hydraulic jack of
adequate capacity (with calibrated pressure gauge) applied the load, reacting against a sturdy reaction frame.
Four dial gauges (0.01 mm least count) were fixed on the pile head to record settlements . Each load
increment was held for 1 hour, and readings were taken at 1, 5, 10, 15, 30, and 60 minute intervals.” Also
mention if a 24-hour hold was done at max load (common in initial tests for creep observation). Calibration
verification should be noted: e.g. “Calibration charts for the jack and gauges were checked before testing.”
Results: Begin by stating the Acceptance Criteria for vertical load as per IS:2911. For initial tests, explicitly
list the criteria (usually provided in bullet form in reports): for example: “The Safe Capacity of the pile is
considered as the lesser of: (a) two-thirds of the load at 12 mm total settlement (or 2% of pile diameter, 12 mm in
this case) ; (b) 50% of the load at 10% of pile diameter settlement (60 mm) .” Next, present the actual test
outcomes against these criteria. Include the maximum settlement observed at peak load, the elastic
rebound upon unloading, and the net settlement. For example: “Maximum settlement at 382.65 T (after
24 hrs) = 9.88 mm; Total rebound = 2.36 mm; Net settlement = 7.52 mm .” State whether this meets the
criteria (in this example, 7.52 mm net < 12 mm allowable). Conclude with a clear statement of capacity: a
suggested wording pattern is: “As per the test data and graph, the test pile has shown greater load-
carrying capacity than the design load of X T. Therefore, X T is adopted as the safe vertical load for
the working piles.” In our example: “...the test pile has shown more load carrying capacity than the design load
of 147 T . So, 147 T can be adopted as the safe vertical load for the working piles .” This active-voice
•
•
•
•
•
•
5
6
1
7
7
8 9
10 11
12
13 14
2
conclusion (“So, X T can be adopted...”) should be included for all passed tests. If the criteria were not met
(e.g. excessive settlement), use a different phrasing (see Edge Cases below).
Readings and Graphs: Provide the load-settlement data and graph. This typically includes:
Tables of Load vs Settlement: One table for the loading cycle (incremental load and corresponding
settlements at time intervals), and sometimes a second for the unloading cycle. The table columns
usually include Time, Pressure (kg/cm²), Calculated Load (T), and multiple dial gauge readings with
an average settlement . Ensure the table clearly distinguishes loading and unloading phases (you
may separate them or include a “Remarks” column indicating “Loading”/“Unloading”). Also include a
summary row for residual settlement after unloading if available.
Graph: A plot of Load (on the y-axis) versus Settlement (on the x-axis) for the pile. Label the axes
with units (e.g., “Settlement (mm)” and “Load (T)”), and indicate important points such as the
design load and the defined safe load on the graph (e.g., horizontal/vertical lines or annotations).
The graph should show the pile’s load-displacement curve; if unloading data is available, a loop curve
can be included, but a primary loading curve is essential. Mark any defined failure point or
allowable limit on the graph (e.g., a dashed line at 12 mm settlement). Note: If graph data must be
derived from the table, ensure smoothing is done as needed and consider using an LLM to identify
any “break point” in the curve (for uplift tests) as discussed later. The agent should output or
reference the graph image in the report JSON (if the frontend will render it from data).
(The Calibration Certificate section, if present, would follow, but since it is standard for all tests, it is described
under Edge Cases and additional notes.)
Routine Vertical Load Test (RVPLT)
General: Similar to IVPLT, but clarify this is a routine test on a working pile. E.g., “This report covers a
routine vertical pile load test on a 1200 mm dia working pile to verify its safe load capacity .” Mention the
project context and that it’s done according to IS:2911 as well.
Scope of Work: List pile details as for IVPLT. For routine tests, ensure test load = 1.5 × design load (e.g.
design 550 T, test to 825 T ). State the pile ID/location, diameter, depth, concrete grade, etc. and the
safe capacity/design load values. For example: “Safe capacity (design load) = 550 T; Test Load = 825 T; Pile
diameter = 1200 mm; Depth = 36 m...” . If applicable, note this test was performed at working pile cutoff
level.
Methodology: The procedure is largely the same as IVPLT, with possibly shorter hold times since it’s a
smaller multiple of load. Describe loading in 20% design load increments , use of one or more jacks,
reaction system, etc. A routine test might not require a 24-hour hold at max load (often each load is held for
1 hour, including the maximum load, unless creep is suspected). State that “The routine test was carried out to
1.5 times the design load as per IS:2911 . Each increment (≈20% of design load) was maintained for at least 1
hour. Settlements were recorded using dial gauges (0.01 mm LC) at four locations on the pile head.” Emphasize
any differences: e.g., if only one jack or one gauge is used (though typically 2–4 gauges are used even in
routine tests for accuracy).
•
15
•
16
17 18
17
7
2
3
Results: State acceptance criteria for routine vertical tests. This is similar to initial tests but with a larger
settlement limit: “Safe load is the lesser of: (a) two-thirds of the load at 18 mm total settlement (or 2% of
diameter, 24 mm for 1200 mm dia, whichever is less) ; (b) 50% of load at 10% diameter settlement (120 mm).”
(Note: IS:2911 allows 12 mm for initial tests and 18 mm for routine, hence the difference). Present the test
results: “Maximum settlement at 825 T = 5.79 mm, rebound = 1.92 mm, net settlement = 3.87 mm .” Clearly,
this is well below 18 mm, so criteria are satisfied. Conclude with a similar line in active voice: “Thus, the pile
showed more capacity than the 550 T design load, and 550 T is adopted as the safe vertical load for this pile .”
If the test data includes a 24-hour reading (less likely for routine), include it in the max settlement if
provided.
Readings and Graphs: Provide the load-settlement table and graph as in IVPLT. The format is the same:
time, pressure, load, multiple dial readings, etc. Because the test load is lower (e.g. 825 T in the example)
and settlement small, ensure the graph’s scale is appropriate to show the curve (you may mark the 18 mm
criterion on the graph even if not reached, for context). The graph for routine tests often looks almost linear
since working loads don’t reach failure – that is normal. Still, label axes and annotate design load and safe
load. If any creep or 24-h hold data was recorded (sometimes a 24-h unload rebound check is done), include
that in the table/graph or note it.
Lateral Load Test
General: State that a lateral (horizontal) load test was conducted, including context (free-head or fixed-head
condition, usually free-head for field test). For example: “Clients decided to carry out a lateral pile load test on
a 600 mm dia pile to estimate its lateral load capacity and deflection . This initial lateral load test was
performed as per IS:2911 (Part 4) – 2013 on a free-head pile.” Identify it as initial or routine if applicable (often
lateral tests are done as initial tests on test piles, but it can be routine if required by the project).
Scope of Work: Tabulate details: pile ID and location, pile diameter and depth, design lateral load, and
target test load. For initial lateral tests, target is typically 2.5× design lateral load. E.g., “Design lateral load =
3.5 T, Test load = 8.75 T (2.5 × design) .” Include pile concrete grade and any specific conditions (e.g.,
ground level, whether the test is at cutoff level or requires a certain embedment for reaction). If it’s a
routine lateral test (less common), the target might be 1.5× design.
Methodology: Describe the lateral load setup. For example: “The test was conducted with a hydraulic jack of
50 T capacity reacting against a reaction pile/structure . The jack was placed horizontally and push load was
applied to the test pile (free-head condition). Two dial gauges (0.01 mm LC) were positioned on the test pile, 180°
apart, to measure lateral deflection, and similarly on the reaction point to account for any movement of the
reaction system . The gauges were set to zero at the start.” Explain that load increments ~20% of
estimated safe load were applied and held until rate of displacement was very slow (e.g., <0.1 mm per
30 min) . Often, each load is held for 5–15 minutes or until displacement stabilizes, with a longer
hold at the maximum load (e.g., 30–60 min) . Note that the loading and unloading sequence
should be described: “Loading was done in increments of ~0.7 T (approximately 20% of 3.5 T design load) up to
8.75 T . Because the pressure gauge least count is 5 kg/cm², the actual increments were rounded to the
nearest achievable load . Each increment was maintained for at least 30 min, and the final load was held for
60 min before unloading. The pile’s lateral displacement was monitored throughout.” Mention that
unloading was done similarly in steps, and residual deflection (permanent set) was noted if any. Calibration
of jack and gauge should also be mentioned (usually done beforehand).
19
20
21
22
23 24
25
26 27
28 29
30 31
32 33
34
30
4
Results: State the acceptance criterion for lateral tests. Commonly, the safe lateral load is defined as the
load at 5 mm lateral deflection for initial tests (or another specified deflection per project criteria). In the
example documents, it is given as: “Final load at which total displacement corresponds to 5 mm” . This
essentially means the pile should not reach 5 mm deflection at the safe (design) load. Report the actual
performance: list the maximum deflection observed at the test load, the rebound on unloading, and net
permanent deflection. For example: “Maximum lateral displacement at 8.90 T = 2.84 mm; Total rebound =
1.08 mm; Net deflection = 1.76 mm .” Since 2.84 mm < 5 mm, the criteria are satisfied in this case. Use a
conclusion phrasing such as: “From the load–deflection data and graph, the pile did not reach 5 mm deflection
even at the full test load of 8.75 T. The pile has shown more lateral load carrying capacity than the design load of
3.5 T, with deflections within permissible limits up to the test load . Therefore, 3.5 T can be adopted as the safe
lateral load for the working piles .” This communicates that the design lateral capacity is confirmed. If the
test had reached 5 mm at some lower load, that load would be used to determine safe capacity (e.g., two-
thirds of that load if required by local practice, or simply that load as safe load).
Readings and Graphs: Include a table of lateral load test readings and a load–deflection graph:
Table: The lateral test table should capture time or hold duration, pressure, load, and deflections of
both the test pile and reaction point. Typically columns might be: Time (min), Pressure (kg/cm²),
Calculated Load (T), Dial Gauge Readings at test pile (maybe two gauges) and at reaction (two
gauges), and then the average deflection of the test pile and reaction pile . Often, the report
computes net deflection by subtracting reaction movement from test pile movement. Ensure the
agent averages the multiple readings correctly and computes net deflection = (avg. test pile
deflection) – (avg. reaction deflection). Present data for each load increment and unload step, clearly
indicating the sequence.
Graph: Plot Load (T) vs Lateral Deflection (mm). Typically, deflection is on the x-axis (mm) and load
on the y-axis (T) for easy reading of “load at 5 mm deflection.” Label axes and mark the 5 mm
deflection line. Show the curve of load up to max test load. If the pile didn’t reach 5 mm, the curve
will end before that vertical line, indicating additional capacity. If any permanent set (residual
deflection) occurred, it can be indicated by an offset on the x-axis upon unloading (optional).
Annotate the design load and perhaps the target 5 mm criterion on the graph.
(No separate calibration section is usually needed beyond noting that gauges were calibrated, unless a certificate
is appended.)
Uplift/Pullout Load Test
General: Outline that an uplift (tension) test was performed on a pile, including purpose and standards.
E.g., “An initial uplift (pullout) pile load test was conducted on a 600 mm dia pile to determine its uplift capacity
. This test was carried out as per IS:2911 (Part 4):2013 for tension load on piles.” Highlight that it’s an uplift
test (behavior is somewhat different from compression).
Scope of Work: Provide pile details similar to vertical tests: pile ID, location, diameter, depth, concrete
grade, design uplift (safe) load, and target test load. For initial uplift tests, target is typically 2.5× the safe
uplift load. For example: “Safe (design) uplift capacity = 79 T; Test Load = 197.5 T (2.5 × 79 T) .” Ensure
these values align (197.5 is 2.5× 79 in this case). If multiple piles or multiple tests, specify which pile (e.g.,
“Initial test pile TP-03”).
35
36
37
37
•
38 27
•
39
40 41
5
Methodology: Describe the tension load setup. Uplift tests require a reaction frame or beams anchored
(often with kentledge or adjacent piles) to pull the test pile upward. For instance: “The uplift load was applied
using a 500 T capacity hydraulic jack reacting against a frame of girders anchored to the ground . The pile
reinforcement was welded to a steel plate or box that the jack pushed against to pull the pile upward . Four
dial gauges (0.01 mm LC) were positioned at 90° intervals on the pile head to measure uplift movement , with
bases on independent references 1.5 m away from the pile . The jack and gauges were calibrated (certificates
provided).” Explain the loading sequence: increments of ~20% design load, similar to compression. “The pile
was lifted in increments of about 20% of the design load, up to the full test load of 197.5 T, and then unloaded
. Each load increment was held for a fixed period (e.g., 5–15 min), and the maximum load was held longer
(often 10–60 min or until no further upward movement). Readings of uplift and elastic rebound were taken at each
stage.” Note any specific behavior: e.g., “Uplift movement was recorded immediately after each load application
and after unloading to measure elastic rebound.” If the test protocol requires a 24-hour hold at max load (less
common in uplift, but possibly done to check for creep), mention it accordingly.
Results: State acceptance criteria for uplift tests. These often mirror compression criteria: “The safe uplift
capacity is taken as the lesser of: (a) 2/3 of the load at 12 mm upward movement (or 2% of diameter, 12 mm here)
; (b) half the load at which the load-displacement curve shows a clear break (signifying failure) .” The
second criterion is specific to uplift (and sometimes lateral), where a break in the load vs displacement
graph indicates pullout failure – identifying this point may require judgment (and is flagged for LLM
assistance). Present the test results similar to compression: “Maximum uplift at 211.8 T = 9.34 mm, which is
less than 12 mm . Total elastic rebound = 3.51 mm; Net uplift (residual displacement) = 5.83 mm .” If a
clear break in the load vs uplift curve was observed, note the load at which it occurred. For example, if the
graph showed a yield point at, say, 150 T, you would note that “the load-displacement curve exhibited a break
at approximately 150 T, indicating a failure point, so criterion (b) governs in this case.” In our sample, no such
break occurred up to 197.5 T, so criterion (a) governs. Conclude with a statement about capacity: “Thus, as
per the test data and graph, the pile has shown more uplift capacity than the design load of 79 T . The
maximum uplift at full load was within the 12 mm limit, with no failure point reached. 79 T is adopted as the safe
uplift (tension) capacity for this pile.” This conclusion follows the pattern of other tests. (If the test failed by
reaching a graph break or excessive movement, see Edge Cases below for phrasing.)
Readings and Graphs: Provide the uplift test data and graph:
Table: Similar format to vertical load test. Columns: Time, Pressure (kg/cm²), Load (T), Dial Gauge
readings (1–4), and average uplift. Data will show incremental loading (0, 20%, 40%, etc. of design
load) and then unloading steps. After unloading fully, an additional row may show “24 hr rebound” if
measured. The agent should compute load from pressure (using jack ram area) if only pressure is
given. Also compute net uplift (max minus rebound) if not directly given. Make sure to distinguish
uplift direction (movement upward is typically positive in these readings). If the image includes a
separate unloading table or notes about rebound after a hold period, include those appropriately
(possibly as part of the same table or a short second table).
Graph: Plot Load (T) vs Upward Displacement (mm). Conventionally, upward movement can be
plotted on the x-axis and load on y-axis (similar to the compression curve). Clearly label axes (e.g.,
“Uplift (mm)” and “Load (T)”). Indicate the 12 mm displacement criterion line and any observed
failure/yield point. The graph might show a non-linear curve approaching a plateau if failure occurs.
If the test did not reach failure, the curve will end at the maximum load with a displacement below
12 mm. Mark the safe load (usually equal to design load if criteria met) on the graph for clarity. Since
42 43
43
44
45
46
47 48
49 50
51
•
•
6
identifying the “break” in the curve (if it exists) may be subjective, consider using the LLM to analyze
the curve data for a significant slope change (see AI Assistance section). Annotate accordingly (e.g., a
point on the graph labeled “yield point”).
(Calibration certificate images often accompany uplift tests; handle these as described next if provided.)
Common Terminology and Standard Phrases
When generating the narrative portions of the report, use consistent technical terminology as found in real
reports. Here are some frequently used terms and phrases, with their meanings and usage:
Design Load / Safe Load Capacity: The working load the pile is designed for. Often, the term “Safe
load capacity” is used interchangeably with design load in reports. For example: “Maximum vertical
safe capacity of pile = 147 T” or “Safe capacity of pile = 550 MT” . In conclusions, refer to this
value: “...safe vertical load for working piles”.
Test Load: The maximum load applied during the test, usually a multiple of the design load. E.g.,
“The pile was tested to a load of 367.5 T” (which is 2.5 × 147 T) . Always cross-check this ratio: 2.5×
for initial tests, 1.5× for routine tests, etc., as a validation step.
Settlement / Displacement / Deflection: Use “settlement” for vertical compression movement,
“uplift” or “uplift displacement” for upward movement, and “deflection” for lateral movement. Always
include units (mm). For example, “total settlement”, “net settlement”, “lateral deflection”, “upward
displacement”.
Elastic Rebound: The amount the pile rebounds (recovers) after unloading. This is measured as the
difference between maximum displacement under load and the residual displacement after
unloading. Reports often list “Total Rebound” . Use this term when presenting results: e.g., “Total
rebound = 2.36 mm”.
Net Settlement/Deflection: The permanent residual movement after unloading. Calculated as Net
Settlement = Maximum Settlement – Elastic Rebound (similarly for uplift or lateral). For
instance: “Net Deflection = 1.76 mm” (2.84 mm max minus 1.08 mm rebound) . This term is
commonly used in result summaries.
Permissible Limit: The allowable movement per criteria (e.g., 12 mm or 18 mm for settlement,
5 mm for lateral). Use phrasing like: “within permissible limits” or “did not exceed the permissible
deflection of 5 mm.” In conclusions, it’s common to note: “...and the deflection was in permissible limits
till test load” .
Working Pile vs. Initial Test Pile: Working piles are those that remain part of the foundation
(routine tests), whereas initial test piles may be sacrificial. In reports, initial tests might just call it
“test pile” and routine tests sometimes explicitly call it “working pile.” You may say “this initial test pile”
or “the working pile” appropriately.
Load Application and Reaction: Phrasing like “load was applied by means of a hydraulic jack of X
capacity reacting against a reaction frame” is standard . Also mention “pressure gauge and pump” if
relevant. Ensure to specify if multiple jacks or reaction piles were used.
Dial Gauge: Always mention their sensitivity (usually 0.01 mm LC) and placement (3× pile
diameter away or on independent frame). E.g., “Dial gauges (least count 0.01 mm) were fixed on a
datum bar 1.5 m away from the pile to measure settlement.”
Observation Timing: Use the typical time intervals phrasing: “Readings were taken at 1, 5, 10, 15, 30,
and 60 minutes for each load increment” (modify as per actual intervals used, which might be 1, 10, 20,
30 for lateral , etc.). If the data shows these intervals, list them.
•
52 17
•
1
•
•
53
•
12
36
•
37
•
•
54
• 55
•
56
7
Codes and Standards: Always refer to IS:2911 (Part 4) in methodology since all these tests use it .
If IS:14593 (for rock-socket piles) is mentioned in the source material , include it if relevant to
project context. For consistency: “conducted as per IS:2911 (Part 4) – 2013” is a safe inclusion in all
tests.
Safe Load Determination Phrase: The conclusion should use a standard confident tone, e.g., “can
be adopted as the safe load”. We see this exact phrase in examples . Use active voice (“we can
say that...”) as needed: e.g., “we can say that the pile has shown more load capacity than design... So, X T
can be adopted as safe load.” Avoid passive constructions like “it was determined that X T may be
taken...”.
Edge-case Terminology: If a test fails or doesn’t meet criteria, do not use the “can be adopted as
safe load” phrase. Instead, mention the failure: e.g., “the pile did not meet the acceptance criteria, as
settlement of 15 mm exceeded the 12 mm limit at only 80% of the target load. The safe load is therefore
lower than the design load, and the pile is not acceptable at the design capacity.” Use factual language to
describe the outcome. If a calibration certificate is missing, explicitly note: “Calibration certificates
for the pressure gauge/jack were not available for this test, which may affect the accuracy of load
measurements.” This alerts the reader to a data reliability issue. These situations are rare in standard
phrasing, but honesty and clarity are paramount in the report.
Using these standardized terms and phrases will ensure the generated reports read naturally and
professionally, closely mirroring the style of the provided examples.
Formulas and Calculations
When extracting data and computing results, apply the standard formulas used in pile load testing. The
agent should perform these calculations to fill in report tables and results, marking any interpretation-
heavy steps for AI assistance. Key formulas include:
Load Calculation from Pressure: Hydraulic jack readings in the field are often pressure values.
Convert to force using:
Load (kgf) = Pressure (kg/cm²) × Effective Ram Area (cm²).
To express in metric tons (T), divide by 1000 (assuming 1 T = 1000 kgf). Thus: Load (T) = Pressure ×
Area / 1000. For example, with a ram area of 2251 cm², 1 kg/cm² on the gauge equals 2.251 T of
load. The agent should retrieve the ram area from the test data (often given in the report header,
e.g. “Ram Area = 2251 cm²” or listed in methodology) and use it for conversion. This is a
straightforward calculation. Ensure consistent units (some reports list load directly in metric tons, so
conversion may not be needed in those cases).
Average Settlement/Deflection: If multiple dial gauges are used (commonly 2 or 4), compute the
average: Average = (sum of readings) / (number of gauges). This smooths out uneven readings.
For example, four gauges reading 3.32, 3.99, 3.90, 3.95 mm give an average of ~3.79 mm .
Include these averages in the table under an “Average Settlement” column. This calculation is direct
arithmetic.
Net Settlement / Net Uplift: After unloading, calculate net settlement (or uplift) as:
Net Settlement = Max Settlement – Elastic Rebound (for compression tests), or
Net Uplift = Max Uplift – Elastic Rebound (for pullout tests).
For instance, if max settlement = 9.88 mm and rebound = 2.36 mm, then net settlement = 7.52 mm
• 57
58
•
14 21
•
•
59
•
60
•
8
. The agent should compute this once the max and rebound values are determined from the
data. This formula is straightforward subtraction. It’s important for assessing permanent
deformation.
Safety Criteria Evaluations: These involve comparing test results to criteria and sometimes require
interpolation:
Settlement-based capacity: Identify the load at which the specified settlement limit occurs. Often, the
pile does not reach 12 mm or 18 mm exactly, so if the max settlement is below the limit, the criterion
(a) isn’t controlling (the safe load is then the design load or more). If the limit is exceeded, find the
load corresponding to that settlement (linear interpolation between data points if needed) – this
step may be complex if data is noisy (flag such interpolation for [LLM] if uncertainty is high).
Typically, though, if the test is properly done, the limit isn’t exceeded for a safe pile.
Percentage of diameter criterion: 2% of diameter is usually similar to the fixed mm values (e.g., 2% of
600 mm = 12 mm). The agent can calculate 2% of pile diameter to double-check the threshold.
10% diameter ultimate load criterion: This is a failure definition (pile is failing if 10% diam settlement
reached). Safe load is half of the load at that point. Often not reached in tests, but the code definition
is there. If not reached, this criterion isn’t governing. If it is reached or exceeded, it implies failure
load is around that point. Calculating “half the load at 10% diam settlement” can be done if that
point is reached: e.g., 10% of 600 mm = 60 mm; if by extrapolation the pile would carry 300 T at
60 mm, half is 150 T. This is theoretical unless failure actually happened. The agent can note the
value but typically criterion (a) will govern safe load in serviceability.
Lateral 5 mm criterion: If the data shows the 5 mm deflection at a certain load, that load is essentially
the “failure” load for lateral (serviceability failure). Often, the design load is set to be that failure load
divided by a factor (like 2/3 or so), but in our context, we simply check that the design load did not
produce >5 mm. If it did, then the safe load would need to be reduced (likely to the load at 5 mm
deflection). The agent should find if any reading crosses 5 mm; if none, safe load is just the design
load.
Uplift break point: The graph “break” load is where the load-displacement curve flattens, indicating
pullout failure. Identifying this precisely might require expert judgment or an AI model to analyze
the curve shape. Mark this step as [LLM] – i.e., “determine if a clear yield point is present in the load–
uplift curve and the load at that point”. If found, safe uplift load = half of that load . If not found up
to max load, then no failure occurred within test range.
Interpretation of Graphs (Break Points): Any calculation that involves interpreting a graph shape
or trend (rather than direct numeric operations) should be flagged for possible AI assistance. For
example, determining the exact load at which a curvature change happens (for uplift or lateral) is not
a simple formula. The agent should mark such steps with [LLM] in the code or workflow to
indicate human/AI review. Specifically, “Half the load at which the load-displacement curve shows a clear
break” is a criterion that the agent might handle by asking an LLM to analyze the curve data
points.
In summary, the agent will handle basic arithmetic (loads, averages, net values) directly, but for any subtle
interpretation (e.g., curve yield point, unusual data outliers) it should defer to an AI with a [LLM] tag. All
calculated values used in the report (like net settlements or safe load recommendations) should be
internally cross-checked against criteria to ensure consistency and correctness before being output.
12
•
•
•
•
•
•
48
•
48
9
Data Extraction from Images
To build the report, the agent must reliably extract data from the provided images of tables and graphs.
Here’s how to approach this extraction:
OCR for Tabulated Results: Use OCR (Optical Character Recognition) to read text from images
containing test data tables (e.g., “Record of Pile Load Test” sheets). These tables typically have
printed headers and neatly arranged columns, but image quality or scan rotation can be issues. The
agent should implement post-processing on OCR output:
Identify header rows by keywords like “LOAD”, “SETTLEMENT”, “DEFLECTION”, “PRESSURE”, “TIME”,
“Reading 1 2 3 4”, etc. . These indicate the structure (e.g., multiple dial gauge readings).
Normalize header text (OCR might misread “0” vs “O”, etc. – correct obvious ones, possibly using an
LLM to guess corrections in header labels if needed [LLM]).
Once columns are determined, parse each subsequent row. Ignore any OCR artifacts like
misrecognized lines or combined cells. Heuristics: numeric columns should parse as numbers
(possibly with decimals), time might be in hh:mm or mm:ss or minutes.
Row grouping: Ensure that multi-line entries (if any) are consolidated. Often each load step’s data
might span multiple lines in print (as seen in some PDFs where readings at different minutes are
stacked). In the provided examples, readings at 1, 5, 10, etc., minutes were in separate lines below
the load step line. The agent should associate these with the correct load step. One approach: use
the timestamp or repeated load value to group them. Another approach: some reports list readings
in a single row separated by commas or in one cell – handle accordingly.
Locate Key Data Points: The agent should specifically look for:
Initial Zero Readings: Usually a row with 0 pressure, 0 load, and zero readings at time 0 (or start)
. This confirms the initial state – it can be recorded or skipped in output tables (it’s often okay to
skip the all-zero row in the final report, as it’s just the baseline).
Maximum Load Row: Find the row where the load is highest (should equal the test load). This row is
critical for noting max displacement. Also find if there’s a 24-hour reading after that (some tables list
a reading after many minutes or next day for rebound).
Unloading Data: After the max load, the table will show decreasing loads. The agent should
separate the unloading portion. It might be indicated by a time reset or by notes in “Remarks”
column like “unload”. If not explicitly marked, detect when the load values start decreasing. Create a
separate array for unloading readings for clarity. Also capture final zero load rebound reading.
Rebound/Recovery Measurements: Sometimes the final unload includes a hold and rebound
measure after some time (e.g., measure settlement 5, 10 min after unload). If present, note it as the
total rebound.
Units and Conversions: Verify units from the table/headers. Pressure is likely in kg/cm², load in T or
kN (the examples show “Load in MT” meaning metric tons) . Settlements in mm. If any values are
obviously off (e.g., an OCR mis-read “153.06” as “153.06” – which might be correct – but ensure no
mix-up like misplacing decimals or reading ‘,’ as ‘.’). The agent should correct or flag outliers. For
instance, if one gauge reading is wildly different from others (could be an OCR error or actual
outlier), consider ignoring or marking it for review.
Graph Data Extraction: If graphs are provided as images, full data digitization is complex. Instead,
rely on the corresponding tables for precise numeric values. However, for reporting purposes, the
agent might need to extract some info from graphs such as:
Axis labels and units (to ensure correct labeling in output graph).
Noted points (sometimes graphs mark safe load or allowable displacement lines with text). OCR the
graph image for any text like “12mm” or arrows indicating failure load.
If no table is available (unlikely in our context, since images of graphs accompany tables), one could
attempt to sample points from the graph image, but this is error-prone and beyond typical scope. It’s
better to use the table values to regenerate the graph.
The agent can use an LLM to interpret a graph image if needed, e.g., asking it to estimate where a
curve flattens [LLM], but only if absolutely necessary. Usually, stick to numeric table data for
conclusions.
Heuristics for Table Parsing: Implement checks like:
Each row should have the same number of columns as header (if not, OCR might have merged cells
incorrectly).
Pressure and load should generally increase then decrease (monotonic in each phase). If you detect
out-of-order values, re-check OCR or assume that marks the transition to unloading.
Settlement readings generally increase with load (during loading) and decrease on unloading. If a
“settlement” value suddenly drops significantly during loading, that could be an OCR error or a note.
Verify such anomalies.
Time stamps normally reset or start new sequence at unload. E.g., in one report, time continued
sequentially even during unloading, but in others it might reset to 0 or note a date change. Use
context (often the test date might change if overnight). Pay attention to any “Date” column or
repeated date entries – that indicates multiple days or a long hold.
Unit Conversions: If the report needs output in different units than given, convert accordingly. The
examples stay in metric (T, mm). If the frontend JSON requires a specific unit (say kN), convert T to kN
(1 T = 9.81 kN, or often approximated as 10 kN for simplicity if allowed). The guideline here is to
maintain consistency: since all sample phrasing uses tons (T) and mm, we will output those by
default. Just document clearly in JSON what unit each value is in, or include units in keys (e.g.,
"designLoad_T": 147 ).
Handling Low-Quality Images: In case of blurry text or scanned handwriting (e.g., sometimes field
data might be handwritten or stamped), the OCR might fail on some numbers. If the agent
encounters uncertain values:
It should flag them for [LLM] or manual review.
The LLM can sometimes infer the correct number from context (for example, if the sequence of loads
is known to be 0, 76.53, 114.39, 153.06... and one OCR reading is “153.0G”, the LLM can guess it
should be 153.06). Mark these instances and have the LLM attempt a correction, but also ensure to
log a warning.
•
•
•
•
•
•
•
•
•
•
•
•
•
•
11
Use the redundancy in multiple gauge readings to catch errors: e.g., if three out of four gauges show
~2.50 mm and one shows 25.0 mm, it’s likely a misplaced decimal OCR error. The agent should
correct 25.0 to 2.50 or drop that gauge from averaging (with a note).
Image Metadata: Some images may contain metadata or captions (e.g., a title “Figure 4: Load-
Settlement Curve”). Capture such captions if present and associate them with the graph output (for
example, as a description). This is less critical, but can enrich the report.
By meticulously extracting the numerical data and relevant text from images, the agent sets the foundation
for an accurate report. Any data extraction step that isn’t 100% reliable (due to image quality or OCR limits)
should be marked for LLM assistance or manual verification.
Validation Rules and Cross-Checks
Before finalizing a report, the agent should perform several validation checks to ensure the results are
consistent and meet expected standards:
Design vs Test Load Ratio: Verify the test was conducted to the correct multiple of the design load.
For initial tests, the maximum load should be about 2.5 times the design load ; for routine tests,
about 1.5 times . If the ratio deviates significantly (e.g., test went only to 2.0× or 2.2× for an initial
test), note it in the report (maybe the client stopped early or equipment limit). Similarly, if it overshot
(e.g., 2.6×), mention that the pile was tested slightly beyond requirement. This acts as a sanity check
on input data.
Correct Diameter and Settlement Limits: Ensure the permissible settlement/deflection used in
criteria matches the pile diameter and test type:
For vertical initial tests: 12 mm or 2% of diameter, whichever is smaller . Typically 12 mm governs
up to 600 mm dia (since 2% of 600 mm is 12 mm). For larger diameters, 2% might be larger (e.g., 2%
of 1200 mm = 24 mm, but code still often uses 12 mm for initial – however, some projects might use
2% rule strictly, in which case initial test on 1200 mm could allow 24 mm; clarify according to IS code:
IS 2911-2010 suggests 12 mm for initial regardless of diameter). Our examples used 12 mm for
initial 600 mm .
For vertical routine tests: 18 mm or 2% of diameter, whichever is less . In the 1200 mm example,
2% is 24 mm, which is greater, so 18 mm governs. If diameter was smaller, 2% might be less than 18
(for ≤900 mm, 2% is ≤18, so 2% would govern).
For lateral tests: 5 mm lateral deflection is the usual criterion (for both initial and routine lateral,
unless specified otherwise). Check if any project-specific criterion is given (some specs might say
12 mm for lateral as ultimate, but 5 mm is common for serviceability). Our example explicitly uses
5 mm .
For uplift tests: 12 mm uplift or 2% diameter (same value in our cases) . 2% of 600 mm = 12 mm,
so it matches. If a different diameter, compute 2%. Use the smaller of 12 mm or 2% of dia (some
codes don’t differentiate initial vs routine for uplift – usually only initial uplifts are done). Also ensure
to check if a break in curve was observed before 12 mm; if yes, that might govern safe load.
•
•
•
1
2
•
• 10
10
• 19
•
35
• 47
12
Data Consistency: Cross-check that the reported net settlements/deflections are indeed max minus
rebound. The agent should already compute this, but this is to catch any data entry errors. Also
verify that the conclusion drawn (pile has more capacity than design load, or not) is consistent with
the numbers. For example, if net settlement is slightly above 12 mm at design load, the conclusion
should not say “more capacity than design” without clarification. In such a case, the conclusion might
need to say the pile did not satisfy criteria fully. Ensure no contradiction between “permissible limit”
statements and actual values.
Graph vs Table Alignment: If the graph image (if provided) shows a different behavior than the
table (e.g., maybe the table has a max settlement of 9.8 mm but the graph might visually show
~10 mm, or a note on the graph says “failure at X T”), reconcile that. Possibly the graph is drawn
smoothly and might indicate a yield beyond the raw data – use the data primarily, but mention any
graph-indicated values if they add context. For instance, “the graph suggests a subtle break in slope at
~160 T, though the displacement at that load was under the allowable; no clear failure point was reached.”
This kind of note is only if needed to explain differences.
Calibration Certificates Validity: If a calibration certificate section is present in input, confirm the
dates and that the certificate was valid at time of test (usually certificates have a validity period). If
the test date is outside the validity or no certificate is given, flag it. In the report, under either Results
or an Appendix note, you might include: “Note: Calibration certificate for the jack pressure gauge is
dated [date]. Ensure it was valid during testing.” Usually, the sample documents include a statement
“The calibration results reported are valid at the time of measurement” – the agent can reuse such
phrasing to assure validity if provided.
Creep Criteria (if any): Some specs require that the final 24-hour settlement (creep) under max load
does not exceed a certain value (like 0.1 mm/min in last 30 min). If the data includes 24-hour
readings, see if any statement is needed. In many reports, the fact that net settlement is within limits
implicitly covers this, but if an explicit creep test was done (24-hour hold), mention something like:
“No significant creep was observed during the 24-hour hold at maximum load (settlement rate < 0.1 mm/
hour).” This is an additional validation if applicable.
Conformance to IS Code Requirements: Ensure the process described meets IS:2911 guidelines:
Number of loading cycles (usually just one cycle of loading and unloading, which we have).
Duration of each load step (1 hour is per code for routine; initial can be 2.5 hrs at max load for creep,
etc.). If any discrepancy (say the data shows shorter holds), mention it neutrally (could be as per
client requirement).
Unloading sequence being same steps as loading – check table to ensure unload increments roughly
match load increments, as required .
Any deviations found by these validations should be explicitly noted in the report output (probably in the
Results commentary or a special “Note” section) to maintain transparency. For example, if a test was
terminated early, write “The test was stopped at 80% of the target load due to jack capacity limitations; hence
safe load extrapolation is tentative.” Such honesty is crucial in engineering reports.
•
•
•
62
•
•
•
•
•
63
13
Analysis Tasks Requiring LLM Assistance
Certain parts of the report generation involve interpretation or summarization that goes beyond
straightforward rules. We designate these tasks with [LLM] to indicate that a Large Language Model (AI)
should assist. The developer should build hooks for these tasks:
Graph Trendline Identification [LLM]: Determining qualitative features from the load vs
displacement graph, such as the “clear break” or yield point in a curve (especially for uplift tests) or
confirming that no such break occurred. An LLM can analyze the sequence of load-displacement
points to judge if and where the stiffness markedly decreases. For example, it can answer: “Does the
load-settlement curve show a distinct plateau or inflection? If so, at approximately what load?” Use this
for applying criterion like “half the load at break” . The LLM’s finding would be used to decide
which criterion governs the safe load. If the LLM finds no obvious break, the agent assumes criterion
(a) (displacement limit) governs.
Summarization of Conclusions [LLM]: While the guidelines provide standard phrasing, an LLM can
help tailor the final text based on specific results. For instance, if the pile marginally passed the
criteria, the LLM can help phrase that nuance: “the pile marginally met the criteria with a net settlement
of 11.9 mm (just under 12 mm).” Or if it failed: “the pile did not satisfy the acceptance criteria, as excessive
settlement was observed.” The agent can feed the raw outcomes (e.g., design load, net settlement,
allowable) to the LLM and ask for an appropriate concluding sentence in active voice, matching the
tone of examples. This ensures the conclusion section is coherent and context-aware beyond
template insertion.
Aggregating Multi-Source Readings [LLM]: In cases where the table parsing is tricky (say OCR
splits a row across lines, or readings need correlation), an LLM can assist in restructuring the data.
For example, given a chunk of OCR text from a table, the LLM could be prompted to output it as
structured JSON or a clean table. This is useful if our algorithmic parsing struggles. Also, for lateral
tests, calculating net deflection by subtracting reaction pile movement could be double-checked by
the LLM if the approach is unclear (the LLM can be given the raw readings and asked to compute net
deflections). Essentially, the LLM can act as a flexible parser/checker for the tabular data.
OCR Text Cleanup [LLM]: Low-quality OCR outputs (e.g., “8.9O mm” instead of “8.90 mm”) can be
fixed by context. An LLM, when shown the raw OCR line and perhaps the previous/following lines,
can infer and correct errors. This is particularly helpful for misrecognized characters or missing
values. The developer can implement a pipeline where after initial OCR, any uncertain tokens (non-
numeric where numeric expected, etc.) are sent to an LLM with context for clarification. The
corrected output then feeds into the data tables.
Natural Language Sections [LLM]: Sections like Methodology or General can largely follow
templates, but if the agent is unsure about phrasing or needs to integrate project-specific info, an
LLM can help draft those paragraphs in a coherent way, using the info from input (project name,
companies involved, etc.). For example, filling in the client/contractor names in a sentence pulled
from the document: “M/s ZedGeo Systems Pvt Ltd was entrusted with the work of static pile load
test...” can be automated, but an LLM could adjust it for grammar if needed.
•
48
•
•
•
•
64
14
Whenever using the LLM, the agent should verify the output for technical accuracy (the LLM might
introduce an incorrect value if not carefully constrained). Use LLM suggestions to complement the
deterministic calculations, not to replace them, except for interpretive judgments. Mark all such interactions
or decision points clearly in code (with comments or tags) for maintainability.
By leveraging AI for these tasks, the agent can handle ambiguous or complex parts of the report generation
that are difficult to hard-code, while still following engineering logic and the styles given.
Output Format: Structured JSON
The final report generated for each test will be serialized as a JSON object. This structured output can then
be used by a frontend to render the report in a human-readable format (web page, app screen, etc.). The
JSON should be organized logically by sections and data, making it easy to format the report. Below is a
recommended JSON schema with an example “stub” for each test type, demonstrating the expected
structure and some sample content:
Common Structure:
Regardless of test type, each JSON will include fields for the major sections (general, scope, methodology,
results, etc.), as well as nested fields for tables and graphs data. Keys should be consistently named
(lowerCamelCase or snake_case, choose one and stick to it). It’s helpful to include the test type as a field too.
For instance: "testType": "IVPLT" .
1. Initial Vertical Load Test (IVPLT) JSON Stub:
{
"testType": "IVPLT",
"general":
"Clients decided to carry out a static vertical pile load test on a 600 mm
diameter pile to estimate load carrying capacity in vertical direction. M/s
ZedGeo Systems Pvt. Ltd., Mumbai was entrusted with this work.",
"scopeOfWork": {
"pileDetails": {
"location": "AGARTAKLI 97 MLD STP",
"pileDiameter_mm": 600,
"pileDepth_m": 7.5,
"concreteGrade": "M25",
"designLoad_T": 147,
"testLoad_T": 367.5
},
"remarks": "Initial test pile to 2.5× design load as per client
requirement."
},
"methodology": "The load testing on piles was conducted as per IS: 2911 (Part
4) – 2013. The pile was loaded in increments of ~20% of the design load up to
367.5 T and then unloaded. Load was applied via a 1500 T hydraulic jack reacting
against a steel frame. Four dial gauges (0.01 mm LC) recorded settlements at
15
each load increment (held for 1 hour each). A 24-hour hold at max load was
conducted to check for creep.",
"results": {
"acceptanceCriteria": [
"Two-thirds of load at 12 mm total settlement or 2% diameter (whichever is
less)",
"50% of load at 10% pile diameter (settlement = 60 mm)"
],
"maxSettlement_mm": 9.88,
"elasticRebound_mm": 2.36,
"netSettlement_mm": 7.52,
"safeLoadAdopted_T": 147,
"conclusion": "As per the test data and graph, the test pile showed higher
capacity than the 147 T design load. Therefore, 147 T is adopted as the safe
vertical load for the working piles."
},
"readingsAndGraphs": {
"loadSettlementTable": [
{ "time": "18:45", "pressure_kg_cm2": 15, "load_T": 38.3,
"settlement_readings_mm": [0.36, 0.37, 0.38, 0.35], "avgSettlement_mm": 0.37 },
{ "time": "19:46", "pressure_kg_cm2": 30, "load_T": 76.5,
"settlement_readings_mm": [0.62, 0.81, 0.70, 0.71], "avgSettlement_mm": 0.71 },
"... additional load increments ...": "...",
{ "time": "23:46", "pressure_kg_cm2": 105, "load_T": 267.9,
"settlement_readings_mm": [??], "avgSettlement_mm": 9.88 }
],
"unloadingTable": [
{ "time": "00:15 (next day)", "pressure_kg_cm2": 0, "load_T": 0,
"settlement_readings_mm": [7.52, 7.50, 7.55, 7.50], "avgSettlement_mm": 7.52,
"remark": "after rebound" }
],
"graph": {
"title": "Load vs Settlement Curve",
"xAxis": "Settlement (mm)",
"yAxis": "Load (T)",
"dataPoints": [ [0,0], [0.37,38.3], [0.71,76.5], "...", [9.88,382.7] ],
"safeLoadLine_T": 147,
"permissibleSettlementLine_mm": 12
}
},
"calibrationCertificate": "Attached (Calibration of jack and gauges dated 01-
Oct-2025)"
}
Explanation: This JSON contains nested objects for clarity. scopeOfWork.pileDetails holds specifics of
the pile and loads. The results section includes criteria and outcomes (note we used numeric fields for
16
values like settlement for potential usage in calculations, and a human-readable conclusion string as well).
The readingsAndGraphs has a detailed table for load vs settlement (truncated with "..." here for brevity)
and an unloading table. The graph is described by its axes and key points; a frontend could use
dataPoints to plot or ignore it if an image is provided instead. The example also shows how to include a
calibration note.
2. Routine Vertical Load Test (RVPLT) JSON Stub:
{
"testType": "RVPLT",
"general": "A routine vertical pile load test was conducted on a 1200 mm dia
working pile to verify its load capacity and settlement under 1.5× design
load.",
"scopeOfWork": {
"pileDetails": {
"location": "COOVAM (Chennai Metro EV-03)",
"pileDiameter_mm": 1200,
"pileDepth_m": 36.0,
"concreteGrade": "M35",
"designLoad_T": 550,
"testLoad_T": 825
},
"remarks": "Routine test pile P357/2 as per IS 2911 to 1.5× design load."
},
"methodology": "Load test conducted per IS:2911 (Part 4) – 2013. The pile was
incrementally loaded (≈20% of 550 T each step) up to 825 T using a 1500 T jack.
Each load step was held for 1 hour. Settlement was measured with four dial
gauges (0.01 mm LC). No 24-hr hold was required for this routine test; maximum
load held for 1 hour before unloading.",
"results": {
"acceptanceCriteria": [
"Two-thirds of load at 18 mm settlement or 2% diameter (whichever is less, here
18 mm limit)",
"50% of load at 10% pile diameter (settlement = 120 mm)"
],
"maxSettlement_mm": 5.79,
"elasticRebound_mm": 1.92,
"netSettlement_mm": 3.87,
"safeLoadAdopted_T": 550,
"conclusion": "The test pile exhibited only 3.87 mm net settlement at 825 T
(well within the 18 mm limit). It has more capacity than the 550 T design load;
hence, 550 T is adopted as the safe vertical load."
},
"readingsAndGraphs": {
"loadSettlementTable": [
17
{ "load_T": 102.0, "settlement_avg_mm": 0.46, "holdDuration_min": 60 },
{ "load_T": 204.1, "settlement_avg_mm": 0.90, "holdDuration_min": 60 },
"...": "...",
{ "load_T": 841.8, "settlement_avg_mm": 5.05, "holdDuration_min": 60 }
],
"unloadingTable": [
{ "load_T": 0, "rebound_avg_mm": 1.92, "timeAfterUnload_min": 10 }
],
"graph": {
"title": "Routine Test Load-Settlement",
"xAxis": "Settlement (mm)",
"yAxis": "Load (T)",
"dataPoints": [ [0,0], [0.46,102], [0.90,204], "...", [5.05,842] ],
"safeLoadLine_T": 550,
"permissibleSettlementLine_mm": 18
}
},
"calibrationCertificate": "Attached (Jack & pressure gauge calibrated, valid
through Nov-2025)"
}
Note: In this stub, for brevity, the table is not fully expanded. The structure is similar to IVPLT. We included
holdDuration_min to explicitly record how long each load was held (optional detail). The results
highlight the different settlement limit (18 mm). The conclusion mentions how small the settlement was
relative to the limit, which is a nice clarification style.
3. Lateral Load Test JSON Stub:
{
"testType": "LateralLoadTest",
"general": "An initial lateral load test was conducted on a 600 mm dia pile
(free-head condition) to determine its safe lateral load capacity with respect
to 5 mm deflection criterion.",
"scopeOfWork": {
"pileDetails": {
"pileID": "TP-05",
"location": "AGARTAKLI 79 MLD STP",
"pileDiameter_mm": 600,
"pileDepth_m": 10.31,
"concreteGrade": "M35",
"designLateralLoad_T": 3.5,
"testLateralLoad_T": 8.75
},
"remarks": "Initial lateral test to 2.5× design lateral load as per client
requirement."
},
18
