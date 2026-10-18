"""
Image quality check with OpenCV.

MAJOR: Looks at the ID photo BEFORE OCR. The customer's original upload is never changed;
we make a separate "working copy" that is easier for OCR to read.
"""
try:
    import cv2
    import numpy as np
    OPENCV_OK = True
except ImportError:  # MINOR: OpenCV is not installed yet
    OPENCV_OK = False


def is_available() -> bool:
    return OPENCV_OK


def check(image_bytes: bytes):
    """Returns (quality_result, working_copy). working_copy is None if the image can't be read."""
    if not OPENCV_OK:
        return {"available": False, "readable": None, "issues": [], "note": "OpenCV is not installed."}, None

    # MINOR: turn the uploaded bytes into an image
    data = np.frombuffer(image_bytes, dtype=np.uint8)
    image = cv2.imdecode(data, cv2.IMREAD_COLOR)
    if image is None:
        return {"available": True, "readable": False, "issues": ["The file could not be opened as an image."]}, None

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    height, width = gray.shape
    issues = []

    # MAJOR: blur - low "variance of Laplacian" means few sharp edges
    blur_score = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    if blur_score < 60:
        issues.append("The photo looks blurry.")

    # MAJOR: brightness - average pixel value (0 = black, 255 = white)
    brightness = float(gray.mean())
    if brightness < 70:
        issues.append("The photo is too dark.")
    elif brightness > 200:
        issues.append("The photo is too bright.")

    # MAJOR: contrast - how spread out the pixel values are
    contrast = float(gray.std())
    if contrast < 35:
        issues.append("The photo has low contrast.")

    # MAJOR: size - very small images are hard to read
    if min(width, height) < 400:
        issues.append("The photo resolution is low.")

    # MAJOR: orientation - IDs are normally wider than tall
    orientation = "landscape" if width >= height else "portrait"
    if orientation == "portrait":
        issues.append("The ID looks rotated or is taken upright. Please use a landscape photo.")

    # MAJOR: cropping - find the biggest shape; if it's tiny the ID may be cut off or far away
    edges = cv2.Canny(cv2.GaussianBlur(gray, (5, 5), 0), 50, 150)
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if contours:
        biggest = max(contours, key=cv2.contourArea)
        x, y, w, h = cv2.boundingRect(biggest)
        coverage = (w * h) / float(width * height)
        if coverage < 0.35:
            issues.append("The ID looks small or cropped. Fill the frame with the whole card.")
    else:
        coverage = 0.0

    # MAJOR: working copy for OCR - grayscale, boosted contrast, enlarged if small
    working = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(gray)
    if width < 1000:
        scale = 1000.0 / width
        working = cv2.resize(working, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)

    result = {
        "available": True,
        "readable": len(issues) == 0,
        "width": width,
        "height": height,
        "blur_score": round(blur_score, 1),
        "brightness": round(brightness, 1),
        "contrast": round(contrast, 1),
        "orientation": orientation,
        "coverage": round(coverage, 2),
        "issues": issues,
    }
    return result, working
