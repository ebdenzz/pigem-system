import re

import threading

from difflib import SequenceMatcher

import cv2

import numpy as np

try:

    from paddleocr import PaddleOCR

    _PADDLE_IMPORTED = True

except Exception:

    PaddleOCR = None

    _PADDLE_IMPORTED = False

class BaseTextMatcher:

    _NON_ALNUM_REGEX = re.compile(r"[^A-Z0-9 ]")

    _COMPACT_ID_REGEX = re.compile(r"[^A-Z0-9]")

    _ISO_DATE_REGEX = re.compile(r"\b(19\d{2}|20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b")

    _MDY_DATE_REGEX = re.compile(r"\b(\d{1,2})[-/.](\d{1,2})[-/.](19\d{2}|20\d{2})\b")

    _WORD_DATE_1_REGEX = re.compile(r"\b([A-Z]{3,9})\s+(\d{1,2}),?\s+(19\d{2}|20\d{2})\b")

    _WORD_DATE_2_REGEX = re.compile(r"\b(\d{1,2})\s+([A-Z]{3,9}),?\s+(19\d{2}|20\d{2})\b")

    _MONTHS = {

        "JAN": 1, "JANUARY": 1, "FEB": 2, "FEBRUARY": 2, "MAR": 3, "MARCH": 3,

        "APR": 4, "APRIL": 4, "MAY": 5, "JUN": 6, "JUNE": 6, "JUL": 7, "JULY": 7,

        "AUG": 8, "AUGUST": 8, "SEP": 9, "SEPT": 9, "SEPTEMBER": 9,

        "OCT": 10, "OCTOBER": 10, "NOV": 11, "NOVEMBER": 11, "DEC": 12, "DECEMBER": 12,

    }

    def compare(self, entered: dict, lines: list) -> list:

        raise NotImplementedError("Subclasses must implement compare().")

    def _normalize_words(self, text: str) -> str:

        cleaned = self._NON_ALNUM_REGEX.sub(" ", str(text or "").upper())

        return re.sub(r"\s+", " ", cleaned).strip()

    def _normalize_id_code(self, text: str) -> str:

        return self._COMPACT_ID_REGEX.sub("", str(text or "").upper())

    def _extract_dates(self, text: str) -> set:

        found = set()

        upper = str(text or "").upper()

        def add_valid(year_str, month_val, day_str):

            year_num = int(year_str)

            month_num = int(month_val)

            day_num = int(day_str)

            if 1 <= month_num <= 12:

                if 1 <= day_num <= 31:

                    found.add(f"{year_num:04d}-{month_num:02d}-{day_num:02d}")

        for yr, mo, dy in self._ISO_DATE_REGEX.findall(upper):

            add_valid(yr, mo, dy)

        for first_n, second_n, yr in self._MDY_DATE_REGEX.findall(upper):

            add_valid(yr, first_n, second_n)

            add_valid(yr, second_n, first_n)

        for mon_word, dy, yr in self._WORD_DATE_1_REGEX.findall(upper):

            if mon_word in self._MONTHS:

                add_valid(yr, self._MONTHS[mon_word], dy)

        for dy, mon_word, yr in self._WORD_DATE_2_REGEX.findall(upper):

            if mon_word in self._MONTHS:

                add_valid(yr, self._MONTHS[mon_word], dy)

        return found

class PaddleOcrService(BaseTextMatcher):

    def __init__(self) -> None:

        self._engine = None

        self._lock = threading.Lock()

    def is_available(self) -> bool:

        return _PADDLE_IMPORTED

    def _get_engine(self):

        if not _PADDLE_IMPORTED:

            return None

        if self._engine is None:

            self._engine = PaddleOCR(use_angle_cls=True, lang="en", show_log=False)

        return self._engine

    def _extract_lines(self, image_matrix) -> list:

        with self._lock:

            engine = self._get_engine()

            if engine is None:

                return []

            raw_result = engine.ocr(image_matrix, cls=True) or []

        lines = []

        for block in raw_result:

            if block:

                for item in block:

                    if item and len(item) >= 2:

                        text_val, conf = item[1]

                        if conf >= 0.45 and str(text_val).strip():

                            lines.append(str(text_val).strip())

        return lines

    def read_raw_bytes(self, image_bytes: bytes) -> dict:

        if not _PADDLE_IMPORTED or not image_bytes:

            return {"available": False, "lines": []}

        try:

            arr = np.frombuffer(image_bytes, dtype=np.uint8)

            img = cv2.imdecode(arr, cv2.IMREAD_COLOR)

            if img is None:

                return {"available": False, "lines": []}

            h, w = img.shape[:2]

            if max(h, w) > 1280:

                scale = 1280.0 / float(max(h, w))

                img = cv2.resize(img, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)

            lines = self._extract_lines(img)

            return {"available": True, "lines": lines}

        except Exception as err:

            return {"available": False, "note": str(err), "lines": []}

    def read_text(self, working_copy) -> dict:

        if working_copy is None:

            return {"available": False, "note": "No image to read.", "lines": []}

        if not _PADDLE_IMPORTED:

            return {"available": False, "note": "Text reader is not installed.", "lines": []}

        try:

            lines = self._extract_lines(working_copy)

            return {"available": True, "lines": lines}

        except Exception as err:

            return {"available": False, "note": "Could not read ID text: " + str(err), "lines": []}

    def compare(self, entered: dict, lines: list) -> list:

        labels = {"full_name": "Full name", "birth_date": "Birth date", "id_number": "ID number"}

        keys_map = {"full_name": "name", "birth_date": "birth_date", "id_number": "id_number"}

        if not lines:

            empty_results = []

            for field_key, val in entered.items():

                empty_results.append({

                    "key": keys_map.get(field_key, field_key),

                    "field": labels.get(field_key, field_key),

                    "entered": val,

                    "result": "not_checked",

                })

            return empty_results

        joined_text = " ".join(lines)

        ocr_words = self._normalize_words(joined_text).split()

        compact_ocr = self._normalize_id_code(joined_text)

        results = []

        raw_name_parts = self._normalize_words(entered.get("full_name", "")).split()

        name_parts = [part for part in raw_name_parts if len(part) > 1]

        if not name_parts:

            name_parts = raw_name_parts

        matched_tokens = 0

        for part in name_parts:

            token_found = False

            for word in ocr_words:

                if SequenceMatcher(None, part, word).ratio() >= 0.80:

                    token_found = True

                    break

            if token_found:

                matched_tokens += 1

        name_ratio = (matched_tokens / len(name_parts)) if name_parts else 0.0

        if name_ratio == 1.0:

            name_status = "match"

        elif name_ratio >= 0.5:

            name_status = "partial"

        else:

            name_status = "mismatch"

        results.append({

            "key": "name",

            "field": labels["full_name"],

            "entered": entered.get("full_name", ""),

            "result": name_status,

        })

        typed_date = str(entered.get("birth_date", "") or "").strip()

        found_dates = self._extract_dates(joined_text)

        if not typed_date:

            birth_status = "not_checked"

        elif typed_date in found_dates:

            birth_status = "match"

        elif len(found_dates) == 0:

            birth_status = "partial"

        else:

            birth_status = "mismatch"

        results.append({

            "key": "birth_date",

            "field": labels["birth_date"],

            "entered": typed_date,

            "result": birth_status,

        })

        typed_id = self._normalize_id_code(entered.get("id_number", ""))

        if not typed_id:

            id_status = "not_checked"

        elif typed_id in compact_ocr:

            id_status = "match"

        else:

            best_ratio = 0.0

            if len(compact_ocr) >= len(typed_id):

                window = len(typed_id)

                for idx in range(len(compact_ocr) - window + 1):

                    chunk = compact_ocr[idx : idx + window]

                    ratio = SequenceMatcher(None, typed_id, chunk).ratio()

                    if ratio > best_ratio:

                        best_ratio = ratio

            if best_ratio >= 0.85:

                id_status = "match"

            elif best_ratio >= 0.65:

                id_status = "partial"

            else:

                id_status = "mismatch"

        results.append({

            "key": "id_number",

            "field": labels["id_number"],

            "entered": entered.get("id_number", ""),

            "result": id_status,

        })

        return results

_ocr_service = PaddleOcrService()

def is_available() -> bool:

    return _ocr_service.is_available()

def read_raw_bytes(image_bytes: bytes) -> dict:

    return _ocr_service.read_raw_bytes(image_bytes)

def read_text(working_copy) -> dict:

    return _ocr_service.read_text(working_copy)

def compare(entered: dict, lines: list) -> list:

    return _ocr_service.compare(entered, lines)
