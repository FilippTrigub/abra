FROM filipptri/abra-base:latest

RUN pip install --no-cache-dir "torchvision>=0.15"

COPY lib/runpod/ lib/runpod/
COPY skills/_providers/ skills/_providers/
COPY skills/frame-interpolator/ skills/frame-interpolator/

CMD ["python", "skills/frame-interpolator/runpod_handler.py"]
