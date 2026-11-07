"""
================================================================================
FILE: api/_quality.py
PURPOSE:
  Document-Image Quality Assessment (DIQA), Safe 4-Corner Perspective Cropping,
  and Working-Copy Enhancement Module powered by OpenCV (`cv2`).

DESIGN & ACCURACY SAFEGUARDS:
  1. Preserves the Customer's original uploaded ID photo untouched—all cropping
     and contrast enhancements happen on a separate in-memory working copy.
  2. Strict Card-Geometry Validation: Only crops when a detected rectangle covers
     32%–95% of the photo AND matches valid ID card proportions (aspect ratio
     1.12 to 2.20), preventing OpenCV from ever cropping just the small 1x1 face
     photo inside an ID card.
  3. Outward Edge Padding (2.5%): Keeps a gentle safety margin around card edges
     so printed names, dates, or bottom ID numbers are never clipped.
  4. Gentle LAB-Space CLAHE Contrast Polish: Sharpens text clarity at up to
     1600px width (JPEG quality 92) so Gemini Vision OCR reads small ID fonts
     accurately.
================================================================================
"""

# ------------------------------------------------------------------------------
# IMPORTS EXPLANATION (Why each library is imported in the cloud):
# ------------------------------------------------------------------------------
# `cv2` (`opencv-python-headless`) runs computer-vision operations in Vercel's
# headless Linux cloud server (Laplacian blur check, Canny edge detection,
# 4-point perspective warp, and LAB CLAHE contrast enhancement).
# `numpy` (`np`) converts raw uploaded image bytes into multi-dimensional pixel
# matrices understood by OpenCV.
try:
    import cv2
    import numpy as np
except ImportError:
    cv2 = None
    np = None


# ------------------------------------------------------------------------------
# ABSTRACT PARENT CLASS (OOP Abstraction & Encapsulation)
# ------------------------------------------------------------------------------
class BaseImageProcessor:
    """
    Abstract parent class storing quality thresholds and shared geometric helpers
    for decoding image bytes and flattening tilted 4-corner ID cards.
    """

    def __init__(
        self,
        blur_limit: float = 55.0,
        dark_limit: float = 65.0,
        glare_limit: float = 210.0,
    ) -> None:
        # Encapsulated readability thresholds tuned for smartphone ID photos:
        # - `_blur_limit`  : Minimum Laplacian variance before flagging blur
        # - `_dark_limit`  : Minimum average grayscale brightness (0 = pure black)
        # - `_glare_limit` : Maximum average brightness before flagging flash washout
        self._blur_limit = blur_limit
        self._dark_limit = dark_limit
        self._glare_limit = glare_limit

    def process(self, image_bytes: bytes):
        """Abstract method implemented differently by Stage 1 and Stage 2 scanners."""
        raise NotImplementedError("Subclasses must implement process().")

    def _decode_bytes(self, image_bytes: bytes):
        """
        Converts raw uploaded JPEG/PNG bytes into a 3-channel BGR OpenCV image
        matrix without saving temporary files to disk.
        """
        if not image_bytes or cv2 is None or np is None:
            return None
        buffer = np.frombuffer(image_bytes, dtype=np.uint8)
        return cv2.imdecode(buffer, cv2.IMREAD_COLOR)

    def _order_points(self, pts) -> "np.ndarray":
        """
        Sorts 4 detected corner coordinates consistently as:
        [0] Top-Left, [1] Top-Right, [2] Bottom-Right, [3] Bottom-Left.
        """
        rect = np.zeros((4, 2), dtype="float32")
        # Top-Left has the smallest (x + y) sum; Bottom-Right has the largest sum
        sums = pts.sum(axis=1)
        rect[0] = pts[np.argmin(sums)]
        rect[2] = pts[np.argmax(sums)]
        # Top-Right has the smallest (y - x) diff; Bottom-Left has the largest diff
        diffs = np.diff(pts, axis=1)
        rect[1] = pts[np.argmin(diffs)]
        rect[3] = pts[np.argmax(diffs)]
        return rect

    def _expand_quad_safely(self, rect: "np.ndarray", img_w: int, img_h: int, pad_ratio: float = 0.025) -> "np.ndarray":
        """
        Expands the 4 card corners outward from the card center by 2.5% (clamped
        to image boundaries) so edge text near the ID border is never cut off.
        """
        center = rect.mean(axis=0)
        expanded = center + (rect - center) * (1.0 + pad_ratio * 2.0)
        expanded[:, 0] = np.clip(expanded[:, 0], 0, max(img_w - 1, 1))
        expanded[:, 1] = np.clip(expanded[:, 1], 0, max(img_h - 1, 1))
        return expanded.astype("float32")

    def _four_point_transform(self, image, pts):
        """
        Applies homography perspective warp to straighten and crop a tilted ID
        card on a separate matrix while keeping full card proportions intact.
        """
        h, w = image.shape[:2]
        rect = self._order_points(pts)
        rect = self._expand_quad_safely(rect, w, h, pad_ratio=0.025)
        tl, tr, br, bl = rect

        # Compute top and bottom edge lengths to determine flattened card width
        width_bottom = float(np.sqrt(((br[0] - bl[0]) ** 2) + ((br[1] - bl[1]) ** 2)))
        width_top = float(np.sqrt(((tr[0] - tl[0]) ** 2) + ((tr[1] - tl[1]) ** 2)))
        max_width = max(int(width_bottom), int(width_top), 1)

        # Compute left and right edge lengths to determine flattened card height
        height_right = float(np.sqrt(((tr[0] - br[0]) ** 2) + ((tr[1] - br[1]) ** 2)))
        height_left = float(np.sqrt(((tl[0] - bl[0]) ** 2) + ((tl[1] - bl[1]) ** 2)))
        max_height = max(int(height_right), int(height_left), 1)

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


# ------------------------------------------------------------------------------
# STAGE 1 CHILD CLASS: RAPID READABILITY SCANNER (OOP Inheritance)
# ------------------------------------------------------------------------------
class FastQualityScanner(BaseImageProcessor):
    """
    Stage 1 scanner: rapidly measures focus sharpness (Laplacian variance),
    ambient brightness, specular flash glare, and grayscale contrast.
    """

    def process(self, image_bytes: bytes) -> dict:
        if cv2 is None:
            return {
                "available": False,
                "readable": False,
                "severe": False,
                "needs_enhancement": False,
                "issues": [],
            }

        image = self._decode_bytes(image_bytes)
        if image is None:
            return {
                "available": True,
                "readable": False,
                "severe": True,
                "needs_enhancement": False,
                "issues": ["The image file could not be read. Please upload a clear JPG or PNG photo."],
            }

        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        height, width = gray.shape
        issues = []
        severe = False
        needs_enhancement = False

        # Compute sharpness, average brightness, contrast spread, and bright-pixel glare ratio
        blur_score = float(cv2.Laplacian(gray, cv2.CV_64F).var())
        brightness = float(gray.mean())
        contrast = float(gray.std())
        overexposed_ratio = float(np.mean(gray >= 248))

        # Nested evaluation of blur, darkness, flash glare, and contrast
        if blur_score < self._blur_limit:
            issues.append("The ID photo is blurry.")
            if blur_score < 36.0:
                severe = True
            else:
                needs_enhancement = True

        if brightness < self._dark_limit:
            issues.append("The ID photo is too dark.")
            needs_enhancement = True
            if brightness < 42.0:
                severe = True
        elif brightness > self._glare_limit or overexposed_ratio > 0.22:
            issues.append("The ID photo has strong lighting or flash glare.")
            if brightness > 225.0 or overexposed_ratio > 0.35:
                severe = True
            else:
                needs_enhancement = True

        if contrast < 34.0:
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


# ------------------------------------------------------------------------------
# STAGE 2 CHILD CLASS: SAFE CARD CROPPER & WORKING-COPY ENHANCER
# ------------------------------------------------------------------------------
class DocumentCropEnhancer(BaseImageProcessor):
    """
    Stage 2 processor: locates the outer 4-corner boundary of the ID card,
    validates card aspect ratio so inner portrait boxes are never mis-cropped,
    rotates upright cards to landscape, and polishes text contrast in LAB space.
    """

    def _is_valid_card_shape(self, w: int, h: int) -> bool:
        """
        Verifies that a candidate crop has realistic ID card proportions
        (standard ISO ID-1 card ratio is ~1.58; we accept 1.12 to 2.20).
        """
        if min(w, h) < 220:
            return False
        longer = float(max(w, h))
        shorter = float(max(min(w, h), 1))
        aspect = longer / shorter
        return 1.12 <= aspect <= 2.20

    def _find_card_quad(self, gray):
        """
        Uses nested Canny edge thresholds and contour polygon approximation to
        find a 4-corner ID boundary covering 32% to 95% of the full photo.
        """
        h, w = gray.shape
        img_area = float(h * w)
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)

        # Outer loop tries standard edge sensitivity first, then softer sensitivity
        for low_t, high_t in ((40, 140), (25, 100)):
            edged = cv2.Canny(blurred, low_t, high_t)
            kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
            edged = cv2.dilate(edged, kernel, iterations=1)
            contours, _ = cv2.findContours(edged, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
            contours = sorted(contours, key=cv2.contourArea, reverse=True)[:8]

            # Inner loop inspects the largest contours from outer card border inward
            for cnt in contours:
                area = cv2.contourArea(cnt)
                # Require >= 32% of image area so small inner face photos are ignored
                if 0.32 * img_area <= area <= 0.95 * img_area:
                    peri = cv2.arcLength(cnt, True)
                    approx = cv2.approxPolyDP(cnt, 0.022 * peri, True)
                    if len(approx) == 4 and cv2.isContourConvex(approx):
                        _, _, bw, bh = cv2.boundingRect(approx)
                        if self._is_valid_card_shape(bw, bh):
                            return approx.reshape(4, 2).astype("float32")
        return None

    def _crop_bounding_card(self, image, gray):
        """
        Fallback bounding-rectangle crop when an ID card lies flat on a plain
        table background without sharp Canny corners.
        """
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
            if 0.35 * img_area <= box_area <= 0.92 * img_area and self._is_valid_card_shape(cw, ch):
                # Keep 3.5% safety margin on all sides so edge text stays complete
                pad_x = int(cw * 0.035)
                pad_y = int(ch * 0.035)
                x1 = max(0, x - pad_x)
                y1 = max(0, y - pad_y)
                x2 = min(w, x + cw + pad_x)
                y2 = min(h, y + ch + pad_y)
                return image[y1:y2, x1:x2]
        return None

    def _polish_color_image(self, bgr_img):
        """
        Enhances text readability on the working copy using gentle Contrast
        Limited Adaptive Histogram Equalization (CLAHE) on the L (lightness)
        channel in LAB color space plus mild unsharp masking.
        """
        lab = cv2.cvtColor(bgr_img, cv2.COLOR_BGR2LAB)
        l_chan, a_chan, b_chan = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=1.5, tileGridSize=(8, 8))
        l_enhanced = clahe.apply(l_chan)
        merged = cv2.merge((l_enhanced, a_chan, b_chan))
        enhanced_bgr = cv2.cvtColor(merged, cv2.COLOR_LAB2BGR)
        gaussian = cv2.GaussianBlur(enhanced_bgr, (0, 0), 1.1)
        return cv2.addWeighted(enhanced_bgr, 1.18, gaussian, -0.18, 0)

    def process(self, image_bytes: bytes):
        """
        Runs full working-copy preparation:
          1. Decodes image bytes into memory
          2. Crops & straightens the ID card safely if outer borders are clear
          3. Evaluates sharpness, brightness, glare, contrast, and resolution
          4. Exports a crisp JPEG working copy (up to 1600px, quality 92)
        """
        if cv2 is None:
            return {
                "available": False,
                "readable": False,
                "readability_label": "Unavailable",
                "cropped_applied": False,
                "issues": [],
            }, None

        image = self._decode_bytes(image_bytes)
        if image is None:
            return (
                {
                    "available": True,
                    "readable": False,
                    "readability_label": "Invalid File",
                    "cropped_applied": False,
                    "issues": ["The image file could not be read. Please upload a clear JPG or PNG photo."],
                },
                None,
            )

        orig_h, orig_w = image.shape[:2]
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        issues = []
        cropped_applied = False
        deskew_applied = False

        # Step 1: Attempt safe 4-corner perspective flattening
        quad = self._find_card_quad(gray)
        if quad is not None:
            try:
                warped = self._four_point_transform(image, quad)
                if self._is_valid_card_shape(warped.shape[1], warped.shape[0]):
                    if warped.shape[0] > warped.shape[1] * 1.12:
                        warped = cv2.rotate(warped, cv2.ROTATE_90_CLOCKWISE)
                    image = warped
                    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
                    cropped_applied = True
                    deskew_applied = True
            except Exception:
                pass

        # Step 2: Fallback bounding-box trim if perspective corners were not distinct
        if not cropped_applied:
            tight = self._crop_bounding_card(image, gray)
            if tight is not None:
                if tight.shape[0] > tight.shape[1] * 1.15:
                    tight = cv2.rotate(tight, cv2.ROTATE_90_CLOCKWISE)
                image = tight
                gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
                cropped_applied = True

        cur_h, cur_w = gray.shape

        # Step 3: Evaluate image quality metrics on the working copy
        blur_score = float(cv2.Laplacian(gray, cv2.CV_64F).var())
        if blur_score < self._blur_limit:
            issues.append("The ID photo is blurry. Please hold the camera steady.")

        brightness = float(gray.mean())
        overexposed_ratio = float(np.mean(gray >= 248))
        if brightness < self._dark_limit:
            issues.append("The ID photo is too dark. Please take the picture in a well-lit area.")
        elif brightness > self._glare_limit or overexposed_ratio > 0.25:
            issues.append("The ID photo has glare. Avoid using direct camera flash.")

        contrast = float(gray.std())
        if contrast < 32.0:
            issues.append("The ID photo has low contrast, making details harder to read.")

        if min(cur_w, cur_h) < 360:
            issues.append("The image resolution is too low. Please upload a clearer photo.")

        orientation = "landscape" if cur_w >= cur_h else "portrait"
        if orientation == "portrait" and not deskew_applied:
            issues.append("The ID appears rotated vertically instead of horizontal.")

        # Step 4: Polish contrast and encode high-clarity JPEG working copy
        cropped_jpeg_bytes = None
        try:
            polished_color = self._polish_color_image(image)
            ph, pw = polished_color.shape[:2]
            # Keep up to 1600px width so fine printed birth dates and ID digits stay sharp
            if pw > 1600:
                scale = 1600.0 / float(pw)
                polished_color = cv2.resize(
                    polished_color,
                    None,
                    fx=scale,
                    fy=scale,
                    interpolation=cv2.INTER_AREA,
                )
            ok, buf = cv2.imencode(".jpg", polished_color, [int(cv2.IMWRITE_JPEG_QUALITY), 92])
            if ok:
                cropped_jpeg_bytes = buf.tobytes()
        except Exception:
            cropped_jpeg_bytes = None

        readability_label = "Clear"
        if len(issues) > 0:
            readability_label = (
                "Blurry / Unclear" if blur_score < self._blur_limit else "Needs Lighting Check"
            )

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
            "coverage": 1.0 if cropped_applied else 0.88,
            "deskew_applied": deskew_applied,
            "cropped_applied": cropped_applied,
            "perspective_corrected": deskew_applied,
            "issues": issues,
        }

        return quality_result, cropped_jpeg_bytes


# Shared singleton processor instances
_fast_scanner = FastQualityScanner()
_crop_enhancer = DocumentCropEnhancer()


# ------------------------------------------------------------------------------
# MODULE-LEVEL PUBLIC FUNCTIONS
# ------------------------------------------------------------------------------
def is_available() -> bool:
    """Returns True when headless OpenCV is loaded in the cloud runtime."""
    return cv2 is not None


def quick_check(image_bytes: bytes) -> dict:
    """Stage 1 rapid readability assessment."""
    return _fast_scanner.process(image_bytes)


def enhance_and_crop(image_bytes: bytes):
    """Stage 2 safe perspective crop, orientation fix, and working-copy export."""
    return _crop_enhancer.process(image_bytes)
