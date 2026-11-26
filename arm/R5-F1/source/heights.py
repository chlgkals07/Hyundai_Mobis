"""Nominal tabletop heights, mm. B5N straight nail, AA pinch with vertical parallel links."""

import json
import math
from pathlib import Path

root = Path(__file__).resolve().parents[3]
arm = json.loads((root / "params/arm/R5-F1.json").read_text())
hard = json.loads((root / "params/B5N.json").read_text())["hard"]
derived = json.loads((root / "calc/out/B5N.json").read_text())["derived"]
shoulder = (
    arm["base"]["feet_h"] + arm["base"]["h"] + arm["column"]["lower_pin_from_foot"]
)
underside_drop = (
    arm["wrist"]["flange_bottom_below_pin"]
    + arm["mount"]["h"]
    + arm["gripper"]["palm_t"]
)
for pitch in [3, 10, 18]:
    palm = shoulder + arm["fore"]["L"] * math.sin(math.radians(pitch)) - underside_drop
    nail_drop = hard["bracket_drop"] + hard["L"] + derived["hard_coupler_below_E"]
    print(
        f"{pitch:2}°  palm {palm:.2f}  AA nail {palm - nail_drop:.2f}  open nail {palm - nail_drop + hard['L'] * (1 - math.cos(math.radians(hard['psi_open_deg']))):.2f}"
    )
