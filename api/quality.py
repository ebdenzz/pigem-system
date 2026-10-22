"""
PIGEM Computer Vision Document Quality & 4-Point Perspective Transform Engine.
Powered by OpenCV (cv2).

Performs:
  1. Image validation & channel normalization
  2. Automated 4-corner document contour detection
  3. Homography perspective warping (Auto-Deskew to flat rectangular card)
  4. Laplacian variance blur detection (< 60 = blur)
  5. Mean pixel brightness analysis (< 70 dark, > 200 glare)
  6. Standard deviation contrast check (< 35 low contrast)
  7. Aspect ratio & orientation analysis
  8. Contrast Limited Adaptive Histogram Equalization (CLAHE) for OCR enhancement
"""

try:
    import cv2
    import numpy as np
    OPENCV_OK = True
except ImportError:
    OPENCV_OK = False


def is_available() -> bool:
    return OPENCV_OK


def order_points(pts: np.ndarray) -> np.ndarray:
    """Orders 4 coordinates: [top-left, top-right, bottom-right, bottom-left]."""
    rect = np.zeros((4, 2), dtype="float32")
    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)]       # Top-left has smallest sum
    rect[2] = pts[np.argmax(s)]       # Bottom-right has largest sum
    diff = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(diff)]    # Top-right has smallest difference
    rect[3] = pts[np.argmax(diff)]    # Bottom-left has largest difference
    return rect


def four_point_transform(image: np.ndarray, pts: np.ndarray) -> np.ndarray:
    """Applies homography warping to transform a tilted 4-corner quadrilateral into a flat rectangular view."""
    rect = order_points(pts)
    (tl, tr, br, bl) = rect

    # Calculate width of new warped image
    width_a = np.sqrt(((br[0] - bl[0]) ** 2) + ((br[1] - bl[1]) ** 2))
    width_b = np.sqrt(((tr[0] - tl[0]) ** 2) + ((tr[1] - tl[1]) ** 2))
    max_w = max(int(width_a), int(width_b))

    # Calculate height of new warped image
    height_a = np.sqrt(((tr[0] - br[0]) ** 2) + ((tr[1] - br[1]) ** 2))
    height_b = np.sqrt(((tl[0] - bl[0]) ** 2) + ((tl[1] - bl[1]) ** 2))
    max_h = max(int(height_a), int(height_b))

    # Guard against zero or degenerate dimensions
    if max_w < 50 or max_h < 50:
        return image

    dst = np.array([
        [0, 0],
        [max_w - 1, 0],
        [max_w - 1, max_h - 1],
        [0, max_h - 1]
    ], dtype="float32")

    transform_matrix = cv2.getPerspectiveTransform(rect, dst)
    warped = cv2.warpPerspective(image, transform_matrix, (max_w, max_h))
    return warped


def detect_document_quadrilateral(gray: np.ndarray):
    """Detects the 4 corners of an ID card in the image using edge detection and contour approximation."""
    h, w = gray.shape
    total_area = float(h * w)

    # 1. Bilateral filter to preserve strong document edges while smoothing background noise
    smoothed = cv2.bilateralFilter(gray, 9, 75, 75)

    # 2. Canny edge detector
    edges = cv2.Canny(smoothed, 40, 140)

    # 3. Morphological close to join micro-gaps in borders
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
    closed = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, kernel, iterations=2)

    # 4. Find external contours
    contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None

    # Sort contours by area descending
    sorted_contours = sorted(contours, key=cv2.contourArea, reverse=True)[:5]

    for c in sorted_contours:
        area = cv2.contourArea(c)
        # Must occupy at least 15% of the frame to be considered the ID card
        if area < (0.15 * total_area):
            continue

        peri = cv2.arcLength(c, True)
        approx = cv2.approxPolyDP(c, 0.025 * peri, True)

        # A clean quadrilateral has exactly 4 vertices and is convex
        if len(approx) == 4 and cv2.isContourConvex(approx):
            pts = approx.reshape(4, 2).astype("float32")
            return pts

    return None


def check(image_bytes: bytes):
    """
    Analyzes ID image quality and automatically deskews/crops using 4-point perspective transform.
    Returns: (quality_result: dict, working_copy: np.ndarray)
    """
    if not OPENCV_OK:
        return {
            "available": False,
            "readable": None,
            "issues": [],
            "note": "OpenCV is not installed in the current environment."
        }, None

    # Decode bytes to BGR image
    data = np.frombuffer(image_bytes, dtype=np.uint8)
    image = cv2.imdecode(data, cv2.IMREAD_COLOR)
    if image is None:
        return {
            "available": True,
            "readable": False,
            "issues": ["The file could not be decoded as an image. Please upload a valid PNG, JPG, or WEBP file."]
        }, None

    orig_h, orig_w = image.shape[:2]
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    issues = []

    # -------------------------------------------------------------
    # STEP 1: Automated 4-Point Perspective Transform (Auto-Deskew)
    # -------------------------------------------------------------
    deskew_applied = False
    perspective_corrected = False
    card_pts = detect_document_quadrilateral(gray)

    if card_pts is not None:
        try:
            warped_color = four_point_transform(image, card_pts)
            # Recompute working gray from deskewed image if valid
            if warped_color.shape[0] >= 100 and warped_color.shape[1] >= 100:
                image = warped_color
                gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
                deskew_applied = True
                perspective_corrected = True
        except Exception:
            pass

    cur_h, cur_w = gray.shape

    # -------------------------------------------------------------
    # STEP 2: Sharpness / Blur Detection (Variance of Laplacian)
    # -------------------------------------------------------------
    blur_score = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    if blur_score < 60:
        issues.append("The photo is blurry or out of focus. Please hold your camera steady.")

    # -------------------------------------------------------------
    # STEP 3: Brightness Analysis (Mean pixel intensity)
    # -------------------------------------------------------------
    brightness = float(gray.mean())
    if brightness < 70:
        issues.append("The photo is too dark. Please take the picture in a well-lit area.")
    elif brightness > 200:
        issues.append("The photo has excessive glare or overexposure. Avoid direct flash on plastic IDs.")

    # -------------------------------------------------------------
    # STEP 4: Contrast Analysis (Standard deviation of pixel values)
    # -------------------------------------------------------------
    contrast = float(gray.std())
    if contrast < 35:
        issues.append("The photo has low contrast. Details and text may be difficult to discern.")

    # -------------------------------------------------------------
    # STEP 5: Resolution Check
    # -------------------------------------------------------------
    if min(cur_w, cur_h) < 400:
        issues.append("The image resolution is low. Please upload a clearer, higher-resolution photo.")

    # -------------------------------------------------------------
    # STEP 6: Orientation Analysis
    # -------------------------------------------------------------
    orientation = "landscape" if cur_w >= cur_h else "portrait"
    if orientation == "portrait" and not deskew_applied:
        issues.append("The ID appears rotated or taken upright. Most Philippine IDs are landscape oriented.")

    # -------------------------------------------------------------
    # STEP 7: Card Frame Coverage
    # -------------------------------------------------------------
    if not deskew_applied:
        edges = cv2.Canny(cv2.GaussianBlur(gray, (5, 5), 0), 50, 150)
        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if contours:
            biggest = max(contours, key=cv2.contourArea)
            _, _, bw, bh = cv2.boundingRect(biggest)
            coverage = (bw * bh) / float(cur_w * cur_h)
            if coverage < 0.35:
                issues.append("The ID card appears too far away. Please frame the entire card closer to the camera.")
        else:
            coverage = 0.0
    else:
        coverage = 1.0  # Homography cropped card fills 100% of frame

    # -------------------------------------------------------------
    # STEP 8: CLAHE & OCR Pre-processing Copy
    # -------------------------------------------------------------
    clahe = cv2.createCLAHE(clipLimit=2.2, tileGridSize=(8, 8))
    working = clahe.apply(gray)

    # Scale to optimal OCR width (~1200px)
    if cur_w < 1200:
        scale = 1200.0 / cur_w
        working = cv2.resize(working, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)

    quality_result = {
        "available": True,
        "readable": len(issues) == 0,
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
        "perspective_corrected": perspective_corrected,
        "issues": issues,
    }

    return quality_result, working
