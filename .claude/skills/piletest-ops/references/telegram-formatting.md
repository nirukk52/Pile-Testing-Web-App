# Telegram Formatting Patterns

Message formatting rules for the PileTest Telegram bot.

## General Rules

- Max message length: 4000 characters (Telegram limit)
- Split long messages at logical boundaries (after a section, not mid-sentence)
- No markdown tables — use bullet lists instead
- Use **bold** for field labels, plain text for values
- Send PDFs as document attachments (not as photos/media)
- All dates in DD/MM/YYYY format
- All loads in MT (metric tonnes)
- All settlements in mm

## Data Preview Pattern

After extraction, format the preview as:

```
📋 *Extracted Data Preview*

*Project*: ABC Infrastructure Pvt Ltd
*Client*: XYZ Corp
*Report No*: TP-01
*Test Date*: 15/03/2025
*Test Type*: IVPLT

*Pile No*: TP-1
*Pile Dia*: 600 mm
*Pile Depth*: 18.5 m
*Concrete Grade*: M25
*Design Load*: 120 MT
*Test Load*: 300 MT

*Readings*: 45 entries extracted
⚠️ Low confidence: consultantName (0.72)

Please confirm or correct any values.
```

## Validation Result Pattern

```
✅ *Test PASSED*

*Max Load*: 300.00 MT
*Max Settlement*: 8.45 mm
*Net Settlement*: 4.12 mm
*Elastic Rebound*: 4.33 mm
*Safe Load*: 135.67 MT
*Settlement Limit*: 12.00 mm

Criterion: Settlement at 12mm
```

Or for failure:

```
❌ *Test FAILED*

*Net Settlement*: 14.23 mm exceeds limit of 12.00 mm

Failures:
• Net settlement 14.23mm > 12.00mm limit
```

## Report Ready Pattern

```
📄 *Report Generated*

*Report*: IVPLT Report — TP-01
*Pages*: 8
*Result*: PASSED ✅

Sending PDF...
```

## Prompt Patterns

```
📸 Send site photos? (or say *skip*)
```

```
📜 Send calibration certificates? (or say *skip*)
```

```
⚠️ Missing required fields:
• *Report No* — please provide
• *Concrete Grade* — please provide
```

## Error Patterns

```
❌ Extraction failed. The file could not be read. Please re-send or enter readings manually.
```

```
⚠️ This doesn't appear to be a pile load test document. Please send a field sheet, observation sheet, or Excel with test data.
```

```
🔄 Verifier score: 78/100 — below publish threshold (90).
Diffs found:
• Net settlement: expected 4.12, got 4.15
• Safe load: expected 135.67, got 136.00

Retrying with corrections...
```
