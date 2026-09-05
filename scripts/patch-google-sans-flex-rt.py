#!/usr/bin/env python3
"""
Add an rt ligature for the Outport title only.

Builds a crossbar-level join: r shoulder becomes a flat horizontal stroke that
meets t's crossbar (reference ligature style), not a baseline foot weld.

Writes public/fonts/google-sans-flex-outport.woff2 (liga feature).
Restores public/fonts/google-sans-flex-latin.woff2 from the pristine source.

Requires: pip install fonttools brotli skia-pathops
"""

from __future__ import annotations

import shutil
import sys
from pathlib import Path
from typing import Any

import pathops
from fontTools.pens.recordingPen import RecordingPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont
from fontTools.ttLib.tables import otTables as ot

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public/fonts/google-sans-flex-latin.source.woff2"
MAIN = ROOT / "public/fonts/google-sans-flex-latin.woff2"
OUTPORT = ROOT / "public/fonts/google-sans-flex-outport.woff2"

LIGATURE_GLYPH = "rt.liga"
INSTANCE = {"opsz": 80, "wght": 500}
OR_EXTRA_LSB = 0

# r stem right edge + gap to t stem ≈ cap stem width.
STEM_RIGHT = 315
STEM_GAP = 53
T_STEM_LEFT = 192


def recording_to_path(recording: list[tuple[str, tuple[Any, ...]]]) -> pathops.Path:
	path = pathops.Path()
	pen = path.getPen()
	for op, args in recording:
		if op == "moveTo":
			pen.moveTo(args[0])
		elif op == "lineTo":
			pen.lineTo(args[0])
		elif op == "curveTo":
			pen.curveTo(*args)
		elif op == "qCurveTo":
			pen.qCurveTo(*args)
		elif op == "closePath":
			pen.closePath()
	return path


def t_crossbar_metrics(t_glyph) -> tuple[float, float]:
	"""Return (crossbar_y, half_thickness) from cap crossbar band."""
	pen = TTGlyphPen(None)
	t_glyph.draw(pen)
	glyph = pen.glyph()
	coords = [(glyph.coordinates[i][0], glyph.coordinates[i][1]) for i in range(len(glyph.coordinates))]
	band = [y for x, y in coords if y <= 250 and x >= 330]
	if not band:
		return 167.0, 14.0
	return (min(band) + max(band)) / 2, (max(band) - min(band)) / 2


def reshape_r_point(x: float, y: float, crossbar_y: float, bar_half: float) -> tuple[float, float]:
	"""Drop r foot; keep stem + upper shoulder flattened to crossbar height."""
	if x <= STEM_RIGHT + 2:
		return (x, y)

	bar_lo = crossbar_y - bar_half
	bar_hi = crossbar_y + bar_half
	if bar_lo <= y <= bar_hi:
		return (x, y)
	if y < bar_lo:
		return (STEM_RIGHT, y)
	return (max(STEM_RIGHT, min(x, STEM_RIGHT + 80)), crossbar_y)


def reshape_r_recording(
	recording: list[tuple[str, tuple[Any, ...]]], crossbar_y: float, bar_half: float
) -> list[tuple[str, tuple[Any, ...]]]:
	out: list[tuple[str, tuple[Any, ...]]] = []
	for op, args in recording:
		if op in ("moveTo", "lineTo"):
			out.append((op, (reshape_r_point(args[0][0], args[0][1], crossbar_y, bar_half),)))
		elif op == "curveTo":
			out.append((op, tuple(reshape_r_point(p[0], p[1], crossbar_y, bar_half) for p in args)))
		elif op == "qCurveTo":
			out.append(
				(
					op,
					tuple(
						reshape_r_point(p[0], p[1], crossbar_y, bar_half) if p is not None else None
						for p in args
					),
				)
			)
		else:
			out.append((op, args))
	return out


def connector_bar_path(x0: float, x1: float, crossbar_y: float, bar_half: float) -> pathops.Path:
	path = pathops.Path()
	pen = path.getPen()
	y0 = crossbar_y - bar_half
	y1 = crossbar_y + bar_half
	pen.moveTo((x0, y0))
	pen.lineTo((x1, y0))
	pen.lineTo((x1, y1))
	pen.lineTo((x0, y1))
	pen.closePath()
	return path


def union_paths(*paths: pathops.Path) -> pathops.Path:
	builder = pathops.OpBuilder()
	for path in paths:
		builder.add(path, pathops.PathOp.UNION)
	return builder.resolve()


def path_to_glyph(path: pathops.Path):
	pen = TTGlyphPen(None)
	path.draw(pen)
	return pen.glyph()


def glyph_sidebearings(glyph) -> tuple[float, float]:
	rec = RecordingPen()
	glyph.draw(rec)
	xs: list[float] = []
	for op, args in rec.value:
		if op in ("moveTo", "lineTo"):
			xs.append(args[0][0])
		elif op == "qCurveTo":
			for point in args:
				if point is not None:
					xs.append(point[0])
	return min(xs), glyph.width - max(xs)


def build_rt_glyph(font: TTFont) -> tuple[object, int, int]:
	glyph_set = font.getGlyphSet(location=INSTANCE)
	r_glyph = glyph_set["r"]
	t_glyph = glyph_set["t"]
	r_lsb, _ = glyph_sidebearings(r_glyph)
	_, t_rsb = glyph_sidebearings(t_glyph)

	crossbar_y, bar_half = t_crossbar_metrics(t_glyph)
	t_x = STEM_RIGHT + STEM_GAP - T_STEM_LEFT
	t_stem_left = t_x + T_STEM_LEFT

	rec = RecordingPen()
	r_glyph.draw(rec)
	r_path = recording_to_path(reshape_r_recording(rec.value, crossbar_y, bar_half))
	bar_path = connector_bar_path(STEM_RIGHT, t_stem_left + bar_half, crossbar_y, bar_half)

	rec_t = RecordingPen()
	t_glyph.draw(TransformPen(rec_t, (1, 0, 0, 1, t_x, 0)))
	t_path = recording_to_path(rec_t.value)

	merged = union_paths(r_path, bar_path, t_path)
	glyph = path_to_glyph(merged)

	xs = [glyph.coordinates[i][0] for i in range(len(glyph.coordinates))]
	lsb = int(r_lsb + OR_EXTRA_LSB)
	width = int(max(xs) + t_rsb)
	return glyph, width, lsb


NO_VARIATION = 0xFFFFFFFF


def add_glyph(font: TTFont, name: str, glyph: object, width: int, lsb: int) -> None:
	order = font.getGlyphOrder()
	if name not in order:
		font.setGlyphOrder(order + [name])
	font["glyf"][name] = glyph
	font["hmtx"][name] = (width, lsb)
	font["maxp"].numGlyphs = len(font.getGlyphOrder())

	if "gvar" in font:
		font["gvar"].variations[name] = []

	if "HVAR" in font:
		hvar = font["HVAR"].table
		for map_name in ("AdvWidthMap", "LsbMap", "RsbMap"):
			var_map = getattr(hvar, map_name, None)
			if var_map is not None and hasattr(var_map, "mapping"):
				var_map.mapping[name] = NO_VARIATION


def add_rt_to_liga(font: TTFont) -> None:
	gsub = font["GSUB"].table

	for rec in gsub.FeatureList.FeatureRecord:
		if rec.FeatureTag != "liga":
			continue
		lookup = gsub.LookupList.Lookup[rec.Feature.LookupListIndex[0]]
		subtable = lookup.SubTable[0]
		for first, ligatures in subtable.ligatures.items():
			if first != "r":
				continue
			for lig in ligatures:
				if lig.Component == ["t"] and lig.LigGlyph == LIGATURE_GLYPH:
					return

		lig = ot.Ligature()
		lig.Component = ["t"]
		lig.LigGlyph = LIGATURE_GLYPH

		subtable.ligatures.setdefault("r", []).append(lig)
		return

	raise RuntimeError("liga feature not found in GSUB")


def rename_for_ofl(font: TTFont) -> None:
	family = "Google Sans Flex Outport"
	for record in font["name"].names:
		if record.nameID == 1:
			record.string = family
		elif record.nameID == 3:
			record.string = f"1.000;ADMS;{family}-Regular"
		elif record.nameID == 4:
			record.string = f"{family} Regular"
		elif record.nameID == 6:
			record.string = "GoogleSansFlexOutport-Regular"


def main() -> int:
	if not SOURCE.is_file():
		print(f"Missing source font: {SOURCE}", file=sys.stderr)
		return 1

	font = TTFont(SOURCE)
	glyph, width, lsb = build_rt_glyph(font)
	add_glyph(font, LIGATURE_GLYPH, glyph, width, lsb)
	add_rt_to_liga(font)
	rename_for_ofl(font)
	font.save(OUTPORT)

	shutil.copy2(SOURCE, MAIN)

	print(f"Wrote {OUTPORT} ({LIGATURE_GLYPH}, width {width}, lsb {lsb}, crossbar join, liga r+t)")
	print(f"Restored {MAIN} from source")
	return 0


if __name__ == "__main__":
	raise SystemExit(main())
