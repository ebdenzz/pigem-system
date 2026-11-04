import cv2

import numpy as np

class BaseImageProcessor:

    def __init__(self, blur_limit: float = 60.0, dark_limit: float = 70.0, glare_limit: float = 200.0) -> None:

        self._blur_limit = blur_limit

        self._dark_limit = dark_limit

        self._glare_limit = glare_limit

    def process(self, image_bytes: bytes):

        raise NotImplementedError("Subclasses must implement process().")

    def _decode_bytes(self, image_bytes: bytes):

        if not image_bytes:

            return None

        buffer = np.frombuffer(image_bytes, dtype=np.uint8)

        return cv2.imdecode(buffer, cv2.IMREAD_COLOR)

    def _order_points(self, pts: np.ndarray) -> np.ndarray:

        rect = np.zeros((4, 2), dtype="float32")

        sums = pts.sum(axis=1)

        rect[0] = pts[np.argmin(sums)]

        rect[2] = pts[np.argmax(sums)]

        diffs = np.diff(pts, axis=1)

        rect[1] = pts[np.argmin(diffs)]

        rect[3] = pts[np.argmax(diffs)]

        return rect

    def _four_point_transform(self, image: np.ndarray, pts: np.ndarray) -> np.ndarray:

        rect = self._order_points(pts)

        tl, tr, br, bl = rect

        width_a = float(np.sqrt(((br[0] - bl[0]) ** 2) + ((br[1] - bl[1]) ** 2)))

        width_b = float(np.sqrt(((tr[0] - tl[0]) ** 2) + ((tr[1] - tl[1]) ** 2)))

        max_width = max(int(width_a), int(width_b), 1)

        height_a = float(np.sqrt(((tr[0] - br[0]) ** 2) + ((tr[1] - br[1]) ** 2)))

        height_b = float(np.sqrt(((tl[0] - bl[0]) ** 2) + ((tl[1] - bl[1]) ** 2)))

        max_height = max(int(height_a), int(height_b), 1)

        dst = np.array(

            [

                [0, 0],

                [max_width - 1, 0],

                [max_width - 1, max_height - 1],

                [0, max_height - 1],

            ],

            dtype="float32",

        )

        matrix = cv2.getPerspectiveTransform(rect, dst)

        return cv2.warpPerspective(image, matrix, (max_width, max_height))

class FastQualityScanner(BaseImageProcessor):

    def process(self, image_bytes: bytes) -> dict:

        image = self._decode_bytes(image_bytes)

        if image is None:

            return {

                "available": True,

                "readable": False,

                "severe": True,

                "needs_enhancement": False,

                "issues": ["The image file could not be read. Please upload a JPG or PNG photo."],

            }

        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

        height, width = gray.shape

        issues = []

        severe = False

        needs_enhancement = False

        blur_score = float(cv2.Laplacian(gray, cv2.CV_64F).var())

        brightness = float(gray.mean())

        contrast = float(gray.std())

        if blur_score < self._blur_limit:

            issues.append("The ID photo is blurry.")

            if blur_score < 42.0:

                severe = True

            else:

                needs_enhancement = True

        if brightness < self._dark_limit:

            issues.append("The ID photo is too dark.")

            needs_enhancement = True

            if brightness < 45.0:

                severe = True

        elif brightness > self._glare_limit:

            issues.append("The ID photo has strong lighting glare.")

            severe = True

        if contrast < 38.0:

            issues.append("The ID photo has low contrast.")

            needs_enhancement = True

        if height > width * 1.15:

            needs_enhancement = True

        return {

            "available": True,

            "readable": len(issues) == 0,

            "severe": severe,

            "needs_enhancement": needs_enhancement,

            "width": width,

            "height": height,

            "blur_score": round(blur_score, 1),

            "brightness": round(brightness, 1),

            "contrast": round(contrast, 1),

            "issues": issues,

        }

class DocumentCropEnhancer(BaseImageProcessor):

    def _find_card_quad(self, gray: np.ndarray):

        h, w = gray.shape

        img_area = float(h * w)

        blurred = cv2.GaussianBlur(gray, (5, 5), 0)

        for low_t, high_t in ((40, 140), (25, 100)):

            edged = cv2.Canny(blurred, low_t, high_t)

            kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))

            edged = cv2.dilate(edged, kernel, iterations=1)

            contours, _ = cv2.findContours(edged, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)

            contours = sorted(contours, key=cv2.contourArea, reverse=True)[:8]

            for cnt in contours:

                area = cv2.contourArea(cnt)

                if 0.16 * img_area <= area <= 0.94 * img_area:

                    peri = cv2.arcLength(cnt, True)

                    approx = cv2.approxPolyDP(cnt, 0.025 * peri, True)

                    if len(approx) == 4:

                        return approx.reshape(4, 2).astype("float32")

        return None

    def _crop_bounding_card(self, image: np.ndarray, gray: np.ndarray):

        h, w = gray.shape

        img_area = float(h * w)

        blurred = cv2.GaussianBlur(gray, (7, 7), 0)

        _, thresh = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

        for candidate in (thresh, cv2.bitwise_not(thresh)):

            contours, _ = cv2.findContours(candidate, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

            if not contours:

                continue

            largest = max(contours, key=cv2.contourArea)

            x, y, cw, ch = cv2.boundingRect(largest)

            box_area = float(cw * ch)

            if 0.18 * img_area <= box_area <= 0.88 * img_area:

                pad_x = int(cw * 0.03)

                pad_y = int(ch * 0.03)

                x1 = max(0, x - pad_x)

                y1 = max(0, y - pad_y)

                x2 = min(w, x + cw + pad_x)

                y2 = min(h, y + ch + pad_y)

                return image[y1:y2, x1:x2]

        return None

    def _polish_color_image(self, bgr_img: np.ndarray) -> np.ndarray:

        lab = cv2.cvtColor(bgr_img, cv2.COLOR_BGR2LAB)

        l_chan, a_chan, b_chan = cv2.split(lab)

        clahe = cv2.createCLAHE(clipLimit=1.8, tileGridSize=(8, 8))

        l_enhanced = clahe.apply(l_chan)

        merged = cv2.merge((l_enhanced, a_chan, b_chan))

        enhanced_bgr = cv2.cvtColor(merged, cv2.COLOR_LAB2BGR)

        gaussian = cv2.GaussianBlur(enhanced_bgr, (0, 0), 1.2)

        return cv2.addWeighted(enhanced_bgr, 1.25, gaussian, -0.25, 0)

    def process(self, image_bytes: bytes):

        image = self._decode_bytes(image_bytes)

        if image is None:

            return (

                {

                    "available": True,

                    "readable": False,

                    "readability_label": "Invalid File",

                    "cropped_applied": False,

                    "issues": ["The image file could not be read. Please upload a JPG or PNG photo."],

                },

                None,

                None,

            )

        orig_h, orig_w = image.shape[:2]

        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

        issues = []

        cropped_applied = False

        deskew_applied = False

        quad = self._find_card_quad(gray)

        if quad is not None:

            try:

                warped = self._four_point_transform(image, quad)

                if warped.shape[0] > 140 and warped.shape[1] > 140:

                    if warped.shape[0] > warped.shape[1] * 1.15:

                        warped = cv2.rotate(warped, cv2.ROTATE_90_CLOCKWISE)

                    image = warped

                    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

                    cropped_applied = True

                    deskew_applied = True

            except Exception:

                pass

        if not cropped_applied:

            tight = self._crop_bounding_card(image, gray)

            if tight is not None:

                if tight.shape[0] > tight.shape[1] * 1.2:

                    tight = cv2.rotate(tight, cv2.ROTATE_90_CLOCKWISE)

                image = tight

                gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

                cropped_applied = True

        cur_h, cur_w = gray.shape

        blur_score = float(cv2.Laplacian(gray, cv2.CV_64F).var())

        if blur_score < self._blur_limit:

            issues.append("The ID photo is blurry. Please hold the camera steady.")

        brightness = float(gray.mean())

        if brightness < self._dark_limit:

            issues.append("The ID photo is too dark. Please take the picture in a well-lit area.")

        elif brightness > self._glare_limit:

            issues.append("The ID photo has glare. Avoid using direct camera flash.")

        contrast = float(gray.std())

        if contrast < 35.0:

            issues.append("The ID photo has low contrast, making details harder to read.")

        if min(cur_w, cur_h) < 400:

            issues.append("The image resolution is too low. Please upload a clearer photo.")

        orientation = "landscape" if cur_w >= cur_h else "portrait"

        if orientation == "portrait" and not deskew_applied:

            issues.append("The ID appears rotated vertically instead of horizontal.")

        coverage = 1.0 if cropped_applied else 0.85

        cropped_jpeg_bytes = None

        try:

            polished_color = self._polish_color_image(image)

            ok, buf = cv2.imencode(".jpg", polished_color, [int(cv2.IMWRITE_JPEG_QUALITY), 90])

            if ok:

                cropped_jpeg_bytes = buf.tobytes()

        except Exception:

            cropped_jpeg_bytes = None

        clahe = cv2.createCLAHE(clipLimit=2.2, tileGridSize=(8, 8))

        working = clahe.apply(gray)

        if cur_w < 1200:

            scale = 1200.0 / float(cur_w)

            working = cv2.resize(working, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)

        readability_label = "Clear"

        if len(issues) > 0:

            if blur_score < self._blur_limit:

                readability_label = "Blurry / Unclear"

            else:

                readability_label = "Needs Lighting Check"

        quality_result = {

            "available": True,

            "readable": len(issues) == 0,

            "readability_label": readability_label,

            "width": cur_w,

            "height": cur_h,

            "original_width": orig_w,

            "original_height": orig_h,

            "blur_score": round(blur_score, 1),

            "brightness": round(brightness, 1),

            "contrast": round(contrast, 1),

            "orientation": orientation,

            "coverage": round(coverage, 2),

            "deskew_applied": deskew_applied,

            "cropped_applied": cropped_applied,

            "perspective_corrected": deskew_applied,

            "issues": issues,

        }

        return quality_result, working, cropped_jpeg_bytes

_fast_scanner = FastQualityScanner()

_crop_enhancer = DocumentCropEnhancer()

def is_available() -> bool:

    return cv2 is not None

def quick_check(image_bytes: bytes) -> dict:

    return _fast_scanner.process(image_bytes)

def enhance_and_crop(image_bytes: bytes):

    return _crop_enhancer.process(image_bytes)

def check(image_bytes: bytes):

    quality_result, working, _ = _crop_enhancer.process(image_bytes)

    return quality_result, working
