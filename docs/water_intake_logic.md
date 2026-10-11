# Body-Weight-Based Daily Water Intake Logic

**Document type:** Product logic / implementation note  
**Primary input:** Body weight in kilograms  
**Intended use:** Preliminary hydration guidance in a consumer health-tracking application  
**Scope:** Healthy adults; not a medical fluid-prescription tool

---

## 1. Objective

Estimate a practical daily beverage-intake target using body weight, which is commonly available from onboarding or connected health data.

The output must be described as an **estimate**, not the exact physiological water requirement. Body weight is a useful proxy, but it does not measure hydration status or account for all fluid losses.

## 2. Key definitions

Keep these quantities distinct in the product and data model:

- **Plain-water intake:** Drinking water logged by the user.
- **Beverage intake:** Plain water plus other drinks, such as milk, tea, coffee, and other beverages.
- **Total water intake:** Water from beverages plus moisture in food.

The ICMR–NIN weight-based values below refer to **water from beverages**, not plain water alone and not total water from all food and drink. If the app only records plain water, its progress indicator is not measuring total beverage intake.

## 3. Evidence basis

### ICMR–NIN 2020

The ICMR–NIN *Nutrient Requirements for Indians: Recommended Dietary Allowances (RDA) and Estimated Average Requirements (EAR), 2020* describes the water requirement as being estimated using a factorial approach, drawing on existing fluid guidance and adjusting for body mass and energy requirement for the Indian context.

For healthy adults, the report gives the following beverage-water ranges across activity levels:

| Adult reference group | Sedentary reference | Heavy-activity reference |
|---|---:|---:|
| Men | 32 mL/kg/day | 58 mL/kg/day |
| Women | 27 mL/kg/day | 52 mL/kg/day |

These values are reference points tied to activity categories. Do not invent an official moderate-activity coefficient by interpolating between the endpoints.

### ICMR–NIN 2024

The *Dietary Guidelines for Indians* (2024) state that a normal healthy person needs approximately 2 litres of water **including beverages** per day, and that requirements can increase in very hot weather and during vigorous physical activity.

These recommendations serve different purposes: the 2024 figure is a broad population-level guideline, while the 2020 values provide weight- and activity-related reference points. Neither is an exact individual prescription.

## 4. Recommended MVP logic when body weight is the only reliable input

When sex and activity information are not available, do not pretend to know a precise individual requirement.

### 4.1 Calculate a sedentary reference range

Use the sedentary adult reference values to calculate a range:

```text
lower_reference_ml = weight_kg * 27
upper_reference_ml = weight_kg * 32
```

This range represents the two sex-specific sedentary reference coefficients in the ICMR–NIN 2020 report. It is not a complete range for all activity levels.

### 4.2 If the product requires one number, use an explicitly labelled fallback

For a single, easy-to-understand app goal, use this operational fallback:

```text
initial_target_ml = weight_kg * 30
```

**Important:** `30 mL/kg/day` is a product-design heuristic selected within the sedentary reference range. It is **not** an official ICMR–NIN coefficient and must not be labelled as the user's exact or clinically determined requirement.

Round the displayed target to a practical increment (for example, the nearest 50 or 100 mL) while retaining the unrounded value for calculations if needed.

### 4.3 Interpretation

Example for a 70 kg adult:

```text
Sedentary reference range: 70 * 27 to 70 * 32
                          = 1,890 to 2,240 mL/day

Single-number fallback:   70 * 30
                          = 2,100 mL/day
```

Label the result as an **estimated daily beverage goal**. Do not call it a minimum, maximum, guaranteed requirement, or mandatory amount of plain water.

## 5. Pseudocode

```text
INPUT: latest_valid_body_weight_kg

1. Validate that weight is numeric, finite, and greater than zero.
2. Confirm the user is within the supported adult population.
3. Check whether the user has a known medical fluid restriction or a relevant
   condition that requires individual clinical advice.
4. If a safety exclusion is present:
       do not generate a generic personalised target;
       show a message to follow their clinician's fluid guidance.
5. Otherwise:
       lower_reference_ml = weight_kg * 27
       upper_reference_ml = weight_kg * 32
       initial_target_ml = weight_kg * 30
6. Round the display values to a practical increment.
7. Label the result as an estimate of beverage intake, not plain water alone.
8. Explain that heat, activity, illness, and other individual factors can change
   fluid needs.

OUTPUT:
    initial_target_ml
    lower_reference_ml
    upper_reference_ml
    estimate disclaimer
```

## 6. Python reference implementation

```python
from math import isfinite
from typing import Any


def estimate_daily_beverage_goal(weight_kg: float) -> dict[str, Any]:
    """Return a preliminary body-weight-based beverage goal for a healthy adult.

    This is consumer-app guidance, not a clinical prescription.
    The 27-32 mL/kg range represents sex-specific sedentary reference
    coefficients described by ICMR-NIN (2020). The 30 mL/kg point estimate
    is an application fallback, not an official ICMR-NIN coefficient.
    """
    if isinstance(weight_kg, bool) or not isinstance(weight_kg, (int, float)):
        raise TypeError("weight_kg must be a number")

    if not isfinite(float(weight_kg)) or weight_kg <= 0:
        raise ValueError("weight_kg must be finite and greater than zero")

    lower_ml = weight_kg * 27
    upper_ml = weight_kg * 32
    target_ml = weight_kg * 30

    # Round displayed values to the nearest 50 mL.
    def round_to_50(value: float) -> int:
        return int(50 * round(value / 50))

    return {
        "estimated_target_ml_per_day": round_to_50(target_ml),
        "sedentary_reference_low_ml_per_day": round_to_50(lower_ml),
        "sedentary_reference_high_ml_per_day": round_to_50(upper_ml),
        "unit": "mL/day",
        "measure": "beverage intake, not plain water alone",
        "status": "estimate",
        "target_basis": "30 mL/kg/day application fallback",
        "disclaimer": (
            "General estimate for a healthy adult. Requirements vary with "
            "activity, heat, illness, diet, and medical conditions. "
            "Follow clinician-prescribed fluid limits where applicable."
        ),
    }
```

## 7. Input and update rules

1. **Weight source:** Use the most recent valid measured weight. If many noisy readings arrive, a product may use a recent rolling median to avoid unnecessary day-to-day goal changes; this is a UX choice, not a clinical requirement.
2. **Units:** Convert pounds to kilograms before calculating: `kg = lb / 2.2046226218`.
3. **Missing weight:** Do not generate a weight-based estimate. Ask the user to enter weight or use a separately defined non-weight-based default.
4. **Changed weight:** Recalculate when a new valid weight is accepted. Avoid repeatedly changing the goal because of minor daily fluctuations.
5. **No height:** Body weight alone cannot distinguish lean mass from body fat or identify whether actual-weight scaling is appropriate for a particular user.
6. **No activity data:** Keep the target labelled as a sedentary-reference-based estimate. Do not claim it has been adjusted for exercise or hot weather.
7. **Other beverages untracked:** Explain that the progress display counts only the logged drinks and may not reflect total beverage intake.

## 8. Safety and exclusions

Do not use this generic formula as an unsupervised personalised prescription for:

- People with a clinician-prescribed fluid restriction.
- People with significant kidney, heart, or liver conditions where fluid advice may need individualisation.
- People who are pregnant or breastfeeding unless a suitable, separately reviewed pathway is implemented.
- Children and adolescents.
- People who are acutely ill or experiencing substantial vomiting or diarrhoea.
- Situations involving prolonged or intense exercise with substantial sweat loss, where a basic daily formula may be inadequate.

Do not encourage users to force fluids beyond thirst or to consume large volumes rapidly. Excessive water intake can cause dangerously low blood sodium. If a user reports symptoms or has a relevant diagnosis, direct them to appropriate medical advice rather than attempting to adjust the target algorithmically.

This list is not exhaustive. Product deployment should include clinical review and a documented supported-population definition.

## 9. Extension path when more inputs become available

| Available input | Recommended handling |
|---|---|
| Sex/reference category | Use an appropriately validated reference coefficient where supported. |
| Activity category | Use a source-backed activity-specific coefficient. Do not derive an unsupported coefficient by linear interpolation. |
| Height | Help detect cases where actual-weight scaling may be misleading; height does not directly measure hydration needs. |
| Hot weather or exercise session | Use a separately validated adjustment or guidance pathway; avoid arbitrary additions such as a fixed extra litre. |
| Illness or relevant medical condition | Route to an appropriate safety message or clinical pathway rather than applying a generic multiplier. |
| Logged drinks | Track plain water and other beverages separately where possible. |

## 10. Recommended UI language

**Suggested label:** Estimated daily beverage goal

**Suggested explanatory text:**

> This is a starting estimate based on your body weight. Your actual fluid needs can change with activity, hot weather, food, illness, and medical conditions. The goal includes beverages and is not a prescription for plain water alone. Follow any fluid limit given by your healthcare professional.

Avoid labels such as:

- “Exact water requirement”
- “Clinically calculated hydration need”
- “Minimum water you must drink”
- “Drink this amount of plain water in addition to other drinks”

## 11. Validation before production

Before presenting the calculation as personalised health guidance:

- Have a qualified clinician or nutrition professional review the supported population and coefficients.
- Validate edge cases, including very high body weights and relevant medical exclusions.
- Decide whether the product measures plain water, beverages, or total water and keep labels consistent.
- Test user understanding of the estimate disclaimer.
- Version the logic so that coefficient changes are auditable.
- Do not describe the formula as clinically validated without a documented validation study.

## 12. Sources

1. **ICMR–National Institute of Nutrition (2020).** *Nutrient Requirements for Indians: Recommended Dietary Allowances (RDA) and Estimated Average Requirements (EAR).* Official NIN downloads page: <https://www.nin.res.in/downloads/>. The page lists the RDA/EAR 2020 short report and full book.
2. **ICMR–National Institute of Nutrition (2024).** *Dietary Guidelines for Indians*, Guideline 14: “Drink adequate quantity of water.” Official PDF: <https://www.nin.res.in/dietaryguidelines/pdfjs/locale/DGI07052024P.pdf>.

---

**Implementation decision:** For a weight-only MVP, return the sedentary reference range (`27–32 mL/kg/day`) and, only if the product needs a single target, display `30 mL/kg/day` as a clearly labelled application fallback. Do not present either output as an exact individual requirement.
