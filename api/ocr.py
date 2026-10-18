"""
Text reading (PaddleOCR) and comparison with what the customer typed.

MAJOR: OCR output is only a hint. A mismatch can be a bad photo, so a human Agent decides.
"""
import re
from datetime import date
from difflib import SequenceMatcher

try:
    import cv2
    from paddleocr import PaddleOCR
    OCR_OK = True
except ImportError:  # MINOR: PaddleOCR is not installed yet
    OCR_OK = False

_engine = None  # MINOR: the OCR engine is slow to start, so we load it once


def is_available() -> bool:
    return OCR_OK


def _get_engine():
    global _engine
    if _engine is None:
        try:
            _engine = PaddleOCR(use_textline_orientation=True, lang="en")  # newer PaddleOCR
        except Exception:
            _engine = PaddleOCR(use_angle_cls=True, lang="en")  # older PaddleOCR
    return _engine


def _lines_from(result):
    """MINOR: PaddleOCR versions return different shapes, so collect plain text lines from both."""
    lines = []
    for page in result or []:
        if isinstance(page, dict) and "rec_texts" in page:
            lines += list(page["rec_texts"])
        elif isinstance(page, list):
            for item in page:
                lines.append(item[1][0])
    return [str(line) for line in lines if str(line).strip()]


def read_text(working_copy):
    """MAJOR: Run OCR on the working copy made by quality.py."""
    if not OCR_OK:
        return {"available": False, "note": "PaddleOCR is not installed.", "lines": []}
    if working_copy is None:
        return {"available": False, "note": "No readable image to scan.", "lines": []}
    try:
        color = cv2.cvtColor(working_copy, cv2.COLOR_GRAY2BGR)  # MINOR: OCR wants 3 colour channels
        lines = _lines_from(_get_engine().ocr(color))
        return {"available": True, "lines": lines}
    except Exception as error:
        return {"available": False, "note": "OCR failed: " + str(error), "lines": []}


# ---------------------------------------------------------------- comparison

def _clean(text):
    """MINOR: uppercase and keep only letters, numbers and spaces."""
    return re.sub(r"[^A-Z0-9 ]", " ", str(text).upper())


def _find_dates(text):
    """MINOR: find dates written in common ways and return them as YYYY-MM-DD."""
    months = {m: i + 1 for i, m in enumerate(
        ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"])}
    found = set()

    def add(year, month, day):
        try:
            found.add(date(int(year), int(month), int(day)).isoformat())
        except ValueError:
            pass  # not a real date

    upper = text.upper()
    for y, m, d in re.findall(r"(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})", upper):
        add(y, m, d)
    for a, b, y in re.findall(r"(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})", upper):
        add(y, a, b)  # month first
        add(y, b, a)  # day first
    for m, d, y in re.findall(r"([A-Z]{3})[A-Z]*\.?\s+(\d{1,2}),?\s+(\d{4})", upper):
        if m in months:
            add(y, months[m], d)
    for d, m, y in re.findall(r"(\d{1,2})\s+([A-Z]{3})[A-Z]*\.?,?\s+(\d{4})", upper):
        if m in months:
            add(y, months[m], d)
    return found


def compare(entered, lines):
    """MAJOR: Compare name, birth date and ID number with the OCR text."""
    labels = {"full_name": "Full name", "birth_date": "Birth date", "id_number": "ID number"}
    if not lines:
        return [{"field": labels[k], "entered": v, "result": "not_checked"} for k, v in entered.items()]

    text = " ".join(lines)
    words = _clean(text).split()
    compact_text = _clean(text).replace(" ", "")
    results = []

    # MINOR: name - how many typed name parts appear in the OCR words (small typos allowed)
    parts = _clean(entered.get("full_name", "")).split()
    hits = sum(1 for p in parts if any(SequenceMatcher(None, p, w).ratio() >= 0.8 for w in words))
    share = hits / len(parts) if parts else 0
    results.append({"field": labels["full_name"], "entered": entered.get("full_name", ""),
                    "result": "match" if share == 1 else "partial" if share >= 0.5 else "mismatch"})

    # MINOR: birth date - the typed date must be one of the dates found
    typed_date = entered.get("birth_date", "")
    results.append({"field": labels["birth_date"], "entered": typed_date,
                    "result": "match" if typed_date in _find_dates(text) else "mismatch"})

    # MINOR: ID number - look for it with spaces and dashes removed
    typed_id = _clean(entered.get("id_number", "")).replace(" ", "")
    if typed_id and typed_id in compact_text:
        outcome = "match"
    else:
        best = max((SequenceMatcher(None, typed_id, _clean(l).replace(" ", "")).find_longest_match().size
                    for l in lines), default=0)
        outcome = "partial" if typed_id and best / len(typed_id) >= 0.7 else "mismatch"
    results.append({"field": labels["id_number"], "entered": entered.get("id_number", ""), "result": outcome})
    return results
