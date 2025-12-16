# Test Type Configurations

Detailed specifications for each pile load test type.

## Table of Contents
1. [IVPLT](#ivplt---initial-vertical-pile-load-test)
2. [RVPLT](#rvplt---routine-vertical-pile-load-test)
3. [Lateral](#lateral---lateral-load-test)
4. [Uplift](#uplift---uplift-pullout-test)
5. [Comparison Table](#comparison-table)

---

## IVPLT - Initial Vertical Pile Load Test

### Purpose
First-time load testing of new piles to establish safe working load capacity and verify design assumptions.

### Specifications

| Parameter | Value |
|-----------|-------|
| Load Multiplier | 2.5× design load |
| Settlement Limit | 12mm (or 2% diameter) |
| Ultimate Limit | 10% of pile diameter |
| Hold Duration (max load) | 24 hours |
| Increment Size | 20% of design load |

### Use Cases
- New pile foundations
- First pile in a project
- When design needs verification
- After soil investigation

### Engine Class
```typescript
class IvpltEngine implements ITestEngine {
  readonly testType: TestType = 'IVPLT';
  readonly displayName = 'IVPLT';
  readonly fullName = 'Initial Vertical Pile Load Test';
  readonly testLoadMultiplier = 2.5;
  readonly settlementLimitMm = 12;
}
```

### Report Title Format
```
INITIAL STATIC VERTICAL PILE LOAD TEST ON {diameter}mm DIA PILE
```

---

## RVPLT - Routine Vertical Pile Load Test

### Purpose
Testing of production/working piles after initial test confirms design. Lower test load for efficiency.

### Specifications

| Parameter | Value |
|-----------|-------|
| Load Multiplier | 1.5× design load |
| Settlement Limit | 12mm (or 2% diameter) |
| Ultimate Limit | 10% of pile diameter |
| Hold Duration (max load) | 1 hour minimum |
| Increment Size | 25% of design load |

### Use Cases
- Production piles after IVPLT
- Quality control testing
- Sample testing (1 in 100 piles)

### Engine Class
```typescript
class RvpltEngine implements ITestEngine {
  readonly testType: TestType = 'RVPLT';
  readonly displayName = 'RVPLT';
  readonly fullName = 'Routine Vertical Pile Load Test';
  readonly testLoadMultiplier = 1.5;
  readonly settlementLimitMm = 12;
}
```

### Report Title Format
```
ROUTINE STATIC VERTICAL PILE LOAD TEST ON {diameter}mm DIA PILE
```

---

## LATERAL - Lateral Load Test

### Purpose
Testing horizontal/lateral resistance of pile for structures subject to wind, seismic, or earth pressure loads.

### Specifications

| Parameter | Value |
|-----------|-------|
| Load Multiplier | 2.5× design lateral load |
| Deflection Limit | Project-specific |
| Typical Limit | 5-12mm at ground level |
| Hold Duration | 1 hour per increment |

### Differences from Vertical Tests
- Load applied horizontally
- Measures **deflection** (not settlement)
- May use reaction pile(s)
- Dial gauges measure horizontal movement

### Measurement Points
- Test pile: 2 dial gauges (opposite sides)
- Reaction pile(s): 2 dial gauges each

### Engine Class
```typescript
class LateralEngine implements ITestEngine {
  readonly testType: TestType = 'LATERAL';
  readonly displayName = 'Lateral';
  readonly fullName = 'Lateral Load Test';
  readonly testLoadMultiplier = 2.5;
  // Deflection limit varies by project
}
```

### Report Title Format
```
INITIAL LATERAL PILE LOAD TEST ON {diameter}mm DIA PILE
```

---

## UPLIFT - Uplift / Pullout Test

### Purpose
Testing upward resistance capacity for tension piles, anchor piles, or foundations subject to uplift forces.

### Specifications

| Parameter | Value |
|-----------|-------|
| Load Multiplier | 2.5× design uplift load |
| Uplift Limit | Project-specific |
| Hold Duration | 24 hours (initial) |

### Differences from Vertical Tests
- Load applied **upward** (tension)
- Measures **uplift** (not settlement)
- Settlement values are negative (pile moves up)
- Different failure mechanism (skin friction governs)

### Special Considerations
- Requires anchoring system
- Pile reinforcement must handle tension
- Net uplift checked against allowable

### Engine Class
```typescript
class UpliftEngine implements ITestEngine {
  readonly testType: TestType = 'UPLIFT';
  readonly displayName = 'Uplift';
  readonly fullName = 'Uplift / Pullout Load Test';
  readonly testLoadMultiplier = 2.5;
  // Uplift limit varies by project
}
```

### Report Title Format
```
INITIAL PULLOUT / UPLIFT PILE LOAD TEST ON {diameter}mm DIA PILE
```

---

## Comparison Table

| Feature | IVPLT | RVPLT | Lateral | Uplift |
|---------|-------|-------|---------|--------|
| **Load Direction** | Down | Down | Horizontal | Up |
| **Multiplier** | 2.5× | 1.5× | 2.5× | 2.5× |
| **Settlement Limit** | 12mm | 12mm | - | - |
| **Deflection Limit** | - | - | 5-12mm | - |
| **Uplift Limit** | - | - | - | Varies |
| **Max Hold** | 24h | 1h | 1h | 24h |
| **IS 2911 Section** | Part 4 | Part 4 | Part 4 | Part 4 |

### When to Use Each

```
IF first_pile_in_project THEN
  IVPLT (2.5× load, 24h hold)
  
ELSE IF production_pile AND ivplt_passed THEN
  RVPLT (1.5× load, 1h hold)
  
ELSE IF horizontal_loads_expected THEN
  Lateral (measure deflection)
  
ELSE IF tension_loads_expected THEN
  Uplift (measure uplift movement)
```

---

## Implementation Status

| Test Type | Engine | Report Template | Chart | Status |
|-----------|--------|-----------------|-------|--------|
| IVPLT | ✅ | ✅ | ✅ | Complete |
| RVPLT | 🔲 | 🔲 | 🔲 | Planned |
| Lateral | 🔲 | 🔲 | 🔲 | Planned |
| Uplift | 🔲 | 🔲 | 🔲 | Planned |

### Adding New Test Type

1. Create engine in `src/engines/{type}-engine.ts`
2. Implement `ITestEngine` interface
3. Register in `src/engines/factory.ts`
4. Create report template in `src/lib/pdf/templates/`
5. Update this skill document
